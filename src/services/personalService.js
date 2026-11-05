import bcrypt from 'bcryptjs';
import { usuarioRepository } from '../repositories/usuarioRepository.js';
import { sucursalRepository } from '../repositories/sucursalRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Servicio de administración del personal y usuarios (HU-18, HU-19, HU-21).
 * Implementa las reglas RN-02, RN-04, RN-06, RN-07, RN-08, RN-09, RN-10, RN-26 y RN-27.
 */
export const personalService = {
  /**
   * Lista el personal del negocio (HU-18).
   * RN-04: El gerente solo ve su sucursal; el dueño ve todas.
   */
  async listarPersonal(usuario, filtros = {}) {
    let sucursalId = filtros.sucursalId ? Number(filtros.sucursalId) : null;

    if (usuario.rol === 'GERENTE') {
      sucursalId = usuario.sucursal_id; // RN-04
    }

    return usuarioRepository.listarPorNegocio(usuario.negocio_id, {
      ...filtros,
      sucursalId
    });
  },

  /**
   * Da de alta a un miembro del personal (HU-18).
   */
  async crearPersonal(usuario, datos) {
    let sucursalFinal = datos.sucursalId ? Number(datos.sucursalId) : null;

    // RN-04: El gerente solo crea personal en su propia sucursal
    if (usuario.rol === 'GERENTE') {
      sucursalFinal = usuario.sucursal_id;
    }

    // RN-06: Nadie crea un usuario con rol superior o igual al suyo
    if (usuario.rol === 'GERENTE') {
      if (datos.rol === 'GERENTE' || datos.rol === 'DUENO') {
        throw new ErrorApp('Un gerente solo puede crear baristas o personal sin acceso (RN-06)', 403);
      }
    }

    // RN-26: Barista y gerente exigen sucursal asignada
    if ((datos.rol === 'BARISTA' || datos.rol === 'GERENTE') && !sucursalFinal) {
      throw new ErrorApp('Baristas y gerentes exigen una sucursal asignada (RN-26)', 400);
    }

    if (sucursalFinal) {
      const sucursal = await sucursalRepository.buscarPorIdYNegocio(sucursalFinal, usuario.negocio_id);
      if (!sucursal) {
        throw new ErrorApp('Sucursal no encontrada', 404);
      }
    }

    let passwordHash = null;
    let correoFinal = null;
    let rolFinal = datos.rol || 'SIN_ACCESO';

    if (datos.accesoSistema) {
      // RN-02: Unicidad de correo
      const existente = await usuarioRepository.buscarPorCorreo(datos.correo);
      if (existente) {
        throw new ErrorApp('El correo electrónico ya está registrado en el sistema (RN-02)', 409);
      }

      // RN-07: Contraseña mínimo 8 caracteres
      if (!datos.password || datos.password.length < 8) {
        throw new ErrorApp('La contraseña debe tener mínimo 8 caracteres (RN-07)', 400);
      }

      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(datos.password, salt);
      correoFinal = datos.correo.trim().toLowerCase();
    } else {
      rolFinal = 'SIN_ACCESO';
    }

    const nuevoId = await usuarioRepository.crear({
      negocioId: usuario.negocio_id,
      sucursalId: sucursalFinal,
      nombre: datos.nombre,
      cargo: datos.cargo,
      telefono: datos.telefono,
      accesoSistema: Boolean(datos.accesoSistema),
      correo: correoFinal,
      passwordHash,
      rol: rolFinal,
      debeCambiarPassword: Boolean(datos.accesoSistema), // Clave temporal por defecto (RN-09)
      activo: true
    });

    const creado = await usuarioRepository.buscarPorIdYNegocio(nuevoId, usuario.negocio_id);

    return creado;
  },

  /**
   * Edita datos de un empleado (HU-18).
   */
  async editarPersonal(usuario, id, datos) {
    const empleado = await usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!empleado) {
      throw new ErrorApp('Empleado no encontrado', 404);
    }

    // RN-04: Gerente solo edita empleados de su propia sucursal
    if (usuario.rol === 'GERENTE' && empleado.sucursalId !== usuario.sucursal_id) {
      throw new ErrorApp('No tienes permiso para modificar personal de otra sucursal', 404);
    }

    // RN-06: Nadie modifica o asigna un rol superior o igual al suyo
    if (usuario.rol === 'GERENTE') {
      if (empleado.rol === 'GERENTE' || empleado.rol === 'DUENO' || datos.rol === 'GERENTE' || datos.rol === 'DUENO') {
        throw new ErrorApp('No puedes modificar a un usuario con rol igual o superior al tuyo (RN-06)', 403);
      }
    }

    let sucursalFinal = datos.sucursalId ? Number(datos.sucursalId) : empleado.sucursalId;
    if (usuario.rol === 'GERENTE') {
      sucursalFinal = usuario.sucursal_id;
    }

    if (datos.accesoSistema && datos.correo && datos.correo !== empleado.correo) {
      const duplicado = await usuarioRepository.buscarPorCorreo(datos.correo);
      if (duplicado && duplicado.id !== id) {
        throw new ErrorApp('El correo electrónico ya está en uso (RN-02)', 409);
      }
    }

    await usuarioRepository.actualizar(id, usuario.negocio_id, {
      ...datos,
      sucursalId: sucursalFinal,
      correo: datos.accesoSistema ? datos.correo : null,
      rol: datos.accesoSistema ? datos.rol : 'SIN_ACCESO',
      activo: datos.activo !== undefined ? datos.activo : empleado.activo
    });

    return usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
  },

  /**
   * Activa o desactiva a un miembro del personal (RN-08, RN-10).
   */
  async actualizarActivo(usuario, id, activo) {
    const empleado = await usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!empleado) {
      throw new ErrorApp('Empleado no encontrado', 404);
    }

    if (usuario.rol === 'GERENTE' && empleado.sucursalId !== usuario.sucursal_id) {
      throw new ErrorApp('No tienes permiso para modificar personal de otra sucursal', 404);
    }

    // RN-08, RN-10: El último dueño activo no se puede desactivar
    if (!activo && empleado.rol === 'DUENO') {
      const duenosActivos = await usuarioRepository.contarDuenosActivos(usuario.negocio_id);
      if (duenosActivos <= 1) {
        throw new ErrorApp('No se puede desactivar al único dueño activo del negocio (RN-08, RN-10)', 409);
      }
    }

    await usuarioRepository.actualizarActivo(id, usuario.negocio_id, activo);

    // RN-27: Registro en auditoría
    await auditoriaRepository.registrar({
      negocioId: usuario.negocio_id,
      usuarioId: usuario.id,
      accion: activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      descripcion: `${activo ? 'Activado' : 'Desactivado'} usuario: ${empleado.nombre} (${empleado.rol})`
    });

    return {
      id,
      nombre: empleado.nombre,
      activo: Boolean(activo),
      mensaje: `Empleado ${activo ? 'activado' : 'desactivado'} con éxito`
    };
  },

  /**
   * Asigna una contraseña temporal activando debe_cambiar_password (HU-19, RN-09).
   */
  async restablecerPassword(usuario, id, passwordTemporal) {
    const empleado = await usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!empleado) {
      throw new ErrorApp('Empleado no encontrado', 404);
    }

    if (!empleado.accesoSistema) {
      throw new ErrorApp('El empleado no tiene acceso al sistema', 400);
    }

    // RN-09: Nadie restablece la del dueño por este mecanismo
    if (empleado.rol === 'DUENO') {
      throw new ErrorApp('No se puede restablecer la contraseña de un dueño mediante este mecanismo (RN-09)', 403);
    }

    // RN-09: El gerente restablece a un barista de su sucursal; el dueño a un gerente o barista
    if (usuario.rol === 'GERENTE') {
      if (empleado.rol !== 'BARISTA' || empleado.sucursalId !== usuario.sucursal_id) {
        throw new ErrorApp('Un gerente solo puede restablecer contraseñas de baristas de su sucursal (RN-09)', 403);
      }
    }

    // RN-07: Mínimo 8 caracteres
    if (!passwordTemporal || passwordTemporal.length < 8) {
      throw new ErrorApp('La contraseña temporal debe tener al menos 8 caracteres (RN-07)', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordTemporal, salt);

    await usuarioRepository.asignarPasswordTemporal(id, usuario.negocio_id, passwordHash);

    // RN-27: Registro en auditoría
    await auditoriaRepository.registrar({
      negocioId: usuario.negocio_id,
      usuarioId: usuario.id,
      accion: 'RESET_PASSWORD',
      descripcion: `Contraseña temporal asignada a ${empleado.nombre} (${empleado.correo}) por ${usuario.nombre}`
    });

    return {
      mensaje: 'Contraseña temporal asignada con éxito. El usuario deberá cambiarla al iniciar sesión.',
      id,
      debeCambiarPassword: true
    };
  },

  /**
   * Consulta los pedidos en curso de la sucursal de un empleado (HU-21).
   */
  async consultarPedidosEnCursoEmpleado(usuario, id) {
    const empleado = await usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!empleado) {
      throw new ErrorApp('Empleado no encontrado', 404);
    }

    let pedidosEnCurso = 0;
    if (empleado.sucursalId) {
      pedidosEnCurso = await usuarioRepository.contarPedidosEnCursoPorSucursal(empleado.sucursalId);
    }

    return {
      id: empleado.id,
      nombre: empleado.nombre,
      sucursalId: empleado.sucursalId,
      sucursalNombre: empleado.sucursalNombre,
      pedidosEnCurso
    };
  },

  /**
   * Traslada a un empleado entre sucursales (HU-21, RN-05, RN-26).
   */
  async trasladarPersonal(usuario, id, nuevaSucursalId) {
    // RN-05: Solo el dueño traslada personal entre sucursales
    if (usuario.rol !== 'DUENO') {
      throw new ErrorApp('Solo el dueño puede trasladar personal entre sucursales (RN-05)', 403);
    }

    const empleado = await usuarioRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!empleado) {
      throw new ErrorApp('Empleado no encontrado', 404);
    }

    if (empleado.rol === 'DUENO') {
      throw new ErrorApp('El dueño no se asigna a una sucursal específica (opera todas)', 400);
    }

    if (empleado.sucursalId === nuevaSucursalId) {
      throw new ErrorApp('El empleado ya está asignado a esa sucursal', 400);
    }

    const nuevaSucursal = await sucursalRepository.buscarPorIdYNegocio(nuevaSucursalId, usuario.negocio_id);
    if (!nuevaSucursal || !nuevaSucursal.activa) {
      throw new ErrorApp('La sucursal de destino no existe o está inactiva', 400);
    }

    // Verificar si hay pedidos en curso en la sucursal actual (HU-21)
    let pedidosEnCurso = 0;
    if (empleado.sucursalId) {
      pedidosEnCurso = await usuarioRepository.contarPedidosEnCursoPorSucursal(empleado.sucursalId);
    }

    await usuarioRepository.actualizarSucursal(id, usuario.negocio_id, nuevaSucursalId);

    // RN-27: Registro en auditoría
    await auditoriaRepository.registrar({
      negocioId: usuario.negocio_id,
      usuarioId: usuario.id,
      accion: 'TRASLADO_PERSONAL',
      descripcion: `Traslado de ${empleado.nombre} de sucursal ${empleado.sucursalNombre || 'Sin asignar'} a ${nuevaSucursal.nombre}`
    });

    return {
      id,
      nombre: empleado.nombre,
      sucursalAnteriorId: empleado.sucursalId,
      nuevaSucursalId,
      nuevaSucursalNombre: nuevaSucursal.nombre,
      pedidosEnCursoSucursalAnterior: pedidosEnCurso,
      mensaje: 'Personal trasladado con éxito'
    };
  }
};
