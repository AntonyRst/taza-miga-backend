import pool from '../db.js';

/**
 * Repositorio para la tabla auditoria_logs.
 * Registra acciones críticas del sistema (RN-27).
 */
export const auditoriaRepository = {
  /**
   * Registra una acción crítica en la bitácora de auditoría.
   * @param {object} datos
   * @param {number} datos.negocioId
   * @param {number} datos.usuarioId
   * @param {string} datos.accion
   * @param {string} datos.descripcion
   * @returns {Promise<number>}
   */
  async registrar({ negocioId, usuarioId, accion, descripcion }) {
    const [resultado] = await pool.query(
      `INSERT INTO auditoria_logs (negocio_id, usuario_id, accion, descripcion)
       VALUES (?, ?, ?, ?)`,
      [negocioId, usuarioId, accion, descripcion]
    );

    return resultado.insertId;
  }
};
