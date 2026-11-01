import { grupoOpcionesRepository } from '../repositories/grupoOpcionesRepository.js';
import { opcionRepository } from '../repositories/opcionRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const grupoOpcionesService = {
  /**
   * Lista los grupos de opciones de un negocio, con sus opciones hijas incluidas.
   * @param {number} negocioId
   * @param {boolean} [soloActivos=false]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, soloActivos = false) {
    const grupos = await grupoOpcionesRepository.listar(negocioId, soloActivos);
    const gruposConOpciones = await Promise.all(
      grupos.map(async (g) => {
        const opciones = await opcionRepository.listarPorGrupo(g.id, negocioId, soloActivos);
        return { ...g, opciones };
      })
    );
    return gruposConOpciones;
  },

  /**
   * Obtiene un grupo por ID incluyendo sus opciones (RN-01).
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(id, negocioId) {
    const grupo = await grupoOpcionesRepository.buscarPorId(id, negocioId);
    if (!grupo) {
      throw new ErrorApp('Grupo de opciones no encontrado', 404); // RN-01
    }
    const opciones = await opcionRepository.listarPorGrupo(id, negocioId);
    return { ...grupo, opciones };
  },

  /**
   * Crea un nuevo grupo de opciones.
   * @param {object} datos
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async crear(datos, negocioId) {
    const nuevoId = await grupoOpcionesRepository.crear({
      negocioId,
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      tipoSeleccion: datos.tipo_seleccion,
      obligatorio: datos.obligatorio ?? false,
      activo: datos.activo !== undefined ? datos.activo : true
    });

    return await this.obtenerPorId(nuevoId, negocioId);
  },

  /**
   * Actualiza un grupo de opciones.
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @param {number} usuarioId
   * @returns {Promise<object>}
   */
  async actualizar(id, negocioId, datos, usuarioId) {
    await this.obtenerPorId(id, negocioId);

    await grupoOpcionesRepository.actualizar(id, negocioId, {
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      tipoSeleccion: datos.tipo_seleccion,
      obligatorio: datos.obligatorio,
      activo: datos.activo
    });

    if (datos.activo === false) {
      await auditoriaRepository.registrar({
        negocioId,
        usuarioId,
        accion: 'DESACTIVACION_GRUPO_OPCIONES',
        descripcion: `Grupo de opciones #${id} desactivado por el usuario`
      });
    }

    return await this.obtenerPorId(id, negocioId);
  },

  /**
   * Elimina un grupo de opciones si no tiene historial.
   * @param {number} id
   * @param {number} negocioId
   */
  async eliminar(id, negocioId) {
    await this.obtenerPorId(id, negocioId);

    try {
      await grupoOpcionesRepository.eliminar(id, negocioId);
      return { mensaje: 'Grupo de opciones eliminado exitosamente' };
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new ErrorApp('El grupo tiene opciones o productos asignados con historial; desactívalo', 409); // RN-10
      }
      throw error;
    }
  }
};
