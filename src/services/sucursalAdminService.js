import { sucursalRepository } from '../repositories/sucursalRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Servicio administrativo para la gestión de sucursales (HU-20).
 * Aplica RN-01, RN-05, RN-10, RN-25 y RN-27.
 */
export const sucursalAdminService = {
  /**
   * Lista todas las sucursales del negocio.
   */
  async listarTodas(usuario) {
    return sucursalRepository.listarPorNegocio(usuario.negocio_id);
  },

  /**
   * Crea una nueva sucursal con coordenadas o dirección manual (HU-20, RN-25).
   */
  async crearSucursal(usuario, datos) {
    // RN-05: Solo el dueño crea sucursales
    if (usuario.rol !== 'DUENO') {
      throw new ErrorApp('Solo el dueño puede registrar sucursales (RN-05)', 403);
    }

    const nuevoId = await sucursalRepository.crear({
      negocioId: usuario.negocio_id,
      nombre: datos.nombre,
      direccion: datos.direccion,
      latitud: datos.latitud,
      longitud: datos.longitud,
      telefono: datos.telefono,
      cantidadMesas: datos.cantidadMesas,
      activa: datos.activa !== undefined ? Boolean(datos.activa) : true
    });

    return sucursalRepository.buscarPorIdYNegocio(nuevoId, usuario.negocio_id);
  },

  /**
   * Modifica una sucursal existente (HU-20).
   */
  async editarSucursal(usuario, id, datos) {
    // RN-05: Solo el dueño edita sucursales
    if (usuario.rol !== 'DUENO') {
      throw new ErrorApp('Solo el dueño puede editar sucursales (RN-05)', 403);
    }

    const sucursal = await sucursalRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!sucursal) {
      throw new ErrorApp('Sucursal no encontrada', 404);
    }

    await sucursalRepository.actualizar(id, usuario.negocio_id, datos);

    return sucursalRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
  },

  /**
   * Activa o desactiva una sucursal (RN-25).
   * RN-25: No se puede desactivar una sucursal con personal activo asignado.
   */
  async actualizarActiva(usuario, id, activa) {
    // RN-05: Solo el dueño desactiva sucursales
    if (usuario.rol !== 'DUENO') {
      throw new ErrorApp('Solo el dueño puede desactivar sucursales (RN-05)', 403);
    }

    const sucursal = await sucursalRepository.buscarPorIdYNegocio(id, usuario.negocio_id);
    if (!sucursal) {
      throw new ErrorApp('Sucursal no encontrada', 404);
    }

    // RN-25: Comprobar si tiene personal activo asignado antes de desactivar
    if (!activa) {
      const personalActivo = await sucursalRepository.contarPersonalActivo(id);
      if (personalActivo > 0) {
        throw new ErrorApp(
          `No se puede desactivar la sucursal porque tiene ${personalActivo} empleado(s) activo(s) asignado(s) (RN-25)`,
          409
        );
      }
    }

    await sucursalRepository.actualizarActiva(id, usuario.negocio_id, activa);

    // RN-27: Registrar en auditoría
    await auditoriaRepository.registrar({
      negocioId: usuario.negocio_id,
      usuarioId: usuario.id,
      accion: activa ? 'ACTIVAR_SUCURSAL' : 'DESACTIVAR_SUCURSAL',
      descripcion: `Sucursal ${sucursal.nombre} ${activa ? 'activada' : 'desactivada'} por ${usuario.nombre}`
    });

    return {
      id,
      nombre: sucursal.nombre,
      activa: Boolean(activa),
      mensaje: `Sucursal ${activa ? 'activada' : 'desactivada'} con éxito`
    };
  }
};
