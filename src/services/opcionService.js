import { opcionRepository } from '../repositories/opcionRepository.js';
import { grupoOpcionesRepository } from '../repositories/grupoOpcionesRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const opcionService = {
  /**
   * Obtiene una opción por ID (RN-01).
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(id, negocioId) {
    const opcion = await opcionRepository.buscarPorId(id, negocioId);
    if (!opcion) {
      throw new ErrorApp('Opción no encontrada', 404); // RN-01
    }
    return opcion;
  },

  /**
   * Crea una nueva opción dentro de un grupo.
   * Valida RN-12 (precio extra no negativo).
   * @param {object} datos
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async crear(datos, negocioId) {
    // Verificar que el grupo pertenezca al negocio
    const grupo = await grupoOpcionesRepository.buscarPorId(datos.grupo_id, negocioId);
    if (!grupo) {
      throw new ErrorApp('El grupo de opciones no existe o no pertenece a tu negocio', 404); // RN-01
    }

    // RN-12: El precio extra de una opción no puede ser negativo
    const precioExtra = Number(datos.precio_extra || 0);
    if (precioExtra < 0) {
      throw new ErrorApp('El precio extra no puede ser negativo', 400); // RN-12
    }

    // Si es predeterminada en un grupo UNICA, desmarcar las demás
    if (datos.es_predeterminada && grupo.tipoSeleccion === 'UNICA') {
      await opcionRepository.desmarcarPredeterminadas(grupo.id, negocioId);
    }

    const nuevoId = await opcionRepository.crear({
      negocioId,
      grupoId: datos.grupo_id,
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      precioExtra,
      esPredeterminada: Boolean(datos.es_predeterminada),
      activa: datos.activa !== undefined ? datos.activa : true
    });

    return await this.obtenerPorId(nuevoId, negocioId);
  },

  /**
   * Actualiza una opción existente.
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @param {number} usuarioId
   * @returns {Promise<object>}
   */
  async actualizar(id, negocioId, datos, usuarioId) {
    const opcionActual = await this.obtenerPorId(id, negocioId);

    // RN-12: Validar precio extra no negativo
    let precioExtra = undefined;
    if (datos.precio_extra !== undefined) {
      precioExtra = Number(datos.precio_extra);
      if (precioExtra < 0) {
        throw new ErrorApp('El precio extra no puede ser negativo', 400); // RN-12
      }
    }

    // Si se marca como predeterminada y el grupo es UNICA, desmarcar otras
    if (datos.es_predeterminada) {
      const grupo = await grupoOpcionesRepository.buscarPorId(opcionActual.grupoId, negocioId);
      if (grupo && grupo.tipoSeleccion === 'UNICA') {
        await opcionRepository.desmarcarPredeterminadas(grupo.id, negocioId);
      }
    }

    await opcionRepository.actualizar(id, negocioId, {
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      precioExtra,
      esPredeterminada: datos.es_predeterminada,
      activa: datos.activa
    });

    if (datos.activa === false) {
      await auditoriaRepository.registrar({
        negocioId,
        usuarioId,
        accion: 'DESACTIVACION_OPCION',
        descripcion: `Opción #${id} desactivada por el usuario`
      });
    }

    return await this.obtenerPorId(id, negocioId);
  },

  /**
   * Elimina una opción si no tiene historial en pedidos (RN-10).
   * @param {number} id
   * @param {number} negocioId
   */
  async eliminar(id, negocioId) {
    await this.obtenerPorId(id, negocioId);

    try {
      await opcionRepository.eliminar(id, negocioId);
      return { mensaje: 'Opción eliminada exitosamente' };
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new ErrorApp('La opción tiene historial en pedidos anteriores; desactívala', 409); // RN-10
      }
      throw error;
    }
  }
};
