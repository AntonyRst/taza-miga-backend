import { sucursalRepository } from '../repositories/sucursalRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Servicio para la gestión de sucursales (HU-20).
 * Aplica RN-01, RN-05, RN-10, RN-25 y RN-27.
 */
export const sucursalService = {
  /**
   * Obtiene la información de una sucursal filtrada por el negocio del usuario (RN-01).
   * Un negocio solo puede ver y modificar sus propios datos; un registro ajeno responde 404.
   * @param {number} sucursalId
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(sucursalId, negocioId) {
    // RN-01: Filtrar siempre por el negocio_id extraído del token
    const sucursal = await sucursalRepository.buscarPorIdYNegocio(sucursalId, negocioId);

    // Si no existe o pertenece a otro negocio, responder 404
    if (!sucursal) {
      throw new ErrorApp('Sucursal no encontrada', 404);
    }

    return sucursal;
  },

  /**
   * Lista todas las sucursales del negocio.
   * @param {object} usuario
   * @returns {Promise<Array>}
   */
  async listarTodas(usuario) {
    // RN-01: Consultar únicamente las sucursales del negocio del usuario autenticado
    return sucursalRepository.listarPorNegocio(usuario.negocio_id);
  },

  /**
   * Crea una nueva sucursal con coordenadas o dirección manual (HU-20, RN-05, RN-25).
   * @param {object} usuario
   * @param {object} datos
   * @returns {Promise<object>}
   */
  async crearSucursal(usuario, datos) {
    // RN-05: Solo el dueño puede registrar sucursales
    if (!usuario || usuario.rol !== 'DUENO') {
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

    const creada = await sucursalRepository.buscarPorIdYNegocio(nuevoId, usuario.negocio_id);
    if (!creada) {
      throw new ErrorApp('Error al recuperar la sucursal recién creada', 500);
    }

    return creada;
  },

  /**
   * Modifica una sucursal existente (HU-20, RN-05, RN-25).
   * @param {object} usuario
   * @param {number} id
   * @param {object} datos
   * @returns {Promise<object>}
   */
  async editarSucursal(usuario, id, datos) {
    // RN-05: Solo el dueño puede editar sucursales
    if (!usuario || usuario.rol !== 'DUENO') {
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
   * Activa o desactiva una sucursal (RN-05, RN-25, RN-27).
   * RN-25: No se puede desactivar una sucursal con personal activo asignado.
   * @param {object} usuario
   * @param {number} id
   * @param {boolean} activa
   * @returns {Promise<object>}
   */
  async actualizarActiva(usuario, id, activa) {
    // RN-05: Solo el dueño puede activar/desactivar sucursales
    if (!usuario || usuario.rol !== 'DUENO') {
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
