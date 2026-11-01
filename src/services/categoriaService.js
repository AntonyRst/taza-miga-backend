import { categoriaRepository } from '../repositories/categoriaRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const categoriaService = {
  /**
   * Lista las categorías de un negocio.
   * @param {number} negocioId
   * @param {boolean} [soloActivas=false]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, soloActivas = false) {
    return await categoriaRepository.listar(negocioId, soloActivas);
  },

  /**
   * Obtiene una categoría por su ID (RN-01).
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(id, negocioId) {
    const categoria = await categoriaRepository.buscarPorId(id, negocioId);
    if (!categoria) {
      throw new ErrorApp('Categoría no encontrada', 404); // RN-01
    }
    return categoria;
  },

  /**
   * Crea una nueva categoría.
   * @param {object} datos
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async crear(datos, negocioId) {
    const nuevoId = await categoriaRepository.crear({
      negocioId,
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      orden: datos.orden ?? 0,
      activa: datos.activa !== undefined ? datos.activa : true
    });

    return await this.obtenerPorId(nuevoId, negocioId);
  },

  /**
   * Actualiza una categoría existente.
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @param {number} usuarioId
   * @returns {Promise<object>}
   */
  async actualizar(id, negocioId, datos, usuarioId) {
    await this.obtenerPorId(id, negocioId); // Valida existencia (RN-01)

    // RN-10: Si se intenta desactivar, verificar si tiene productos activos
    if (datos.activa === false) {
      const productosActivos = await categoriaRepository.contarProductosActivos(id, negocioId);
      if (productosActivos > 0) {
        throw new ErrorApp('No se puede desactivar una categoría que tiene productos activos', 409); // RN-10
      }
    }

    await categoriaRepository.actualizar(id, negocioId, {
      nombreEs: datos.nombre_es,
      nombreEn: datos.nombre_en,
      orden: datos.orden,
      activa: datos.activa
    });

    // RN-27: Auditoría ante desactivación
    if (datos.activa === false) {
      await auditoriaRepository.registrar({
        negocioId,
        usuarioId,
        accion: 'DESACTIVACION_CATEGORIA',
        descripcion: `Categoría #${id} desactivada por el usuario`
      });
    }

    return await this.obtenerPorId(id, negocioId);
  },

  /**
   * Cambia el estado de activación de una categoría (RN-10).
   * @param {number} id
   * @param {number} negocioId
   * @param {boolean} activa
   * @param {number} usuarioId
   * @returns {Promise<object>}
   */
  async cambiarEstadoActivo(id, negocioId, activa, usuarioId) {
    return await this.actualizar(id, negocioId, { activa }, usuarioId);
  },

  /**
   * Elimina una categoría si no tiene productos dependientes.
   * @param {number} id
   * @param {number} negocioId
   */
  async eliminar(id, negocioId) {
    await this.obtenerPorId(id, negocioId);

    // RN-10: Lo que tiene dependencias no se elimina
    const productos = await categoriaRepository.contarProductosActivos(id, negocioId);
    if (productos > 0) {
      throw new ErrorApp('La categoría contiene productos asociados; desactívala en su lugar', 409); // RN-10
    }

    try {
      await categoriaRepository.eliminar(id, negocioId);
      return { mensaje: 'Categoría eliminada exitosamente' };
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new ErrorApp('La categoría tiene historial y no se puede eliminar; desactívala', 409); // RN-10
      }
      throw error;
    }
  }
};
