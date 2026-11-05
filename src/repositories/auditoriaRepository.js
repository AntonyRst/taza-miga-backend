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
  async registrar({ negocioId, usuarioId, accion, descripcion }, conexion = null) {
    const ejecutor = conexion || pool;
    const [resultado] = await ejecutor.query(
      `INSERT INTO auditoria_logs (negocio_id, usuario_id, accion, descripcion)
       VALUES (?, ?, ?, ?)`,
      [negocioId, usuarioId, accion, descripcion]
    );

    return resultado.insertId;
  },

  /**
   * Consulta los logs de auditoría de un negocio ordenados del más reciente al más antiguo (HU-24).
   * Solo el dueño puede acceder (RN-03, RN-27).
   */
  async listarPorNegocio(negocioId, { usuarioId, accion, fechaInicio, fechaFin } = {}) {
    let sql = `
      SELECT
        a.id,
        a.negocio_id AS negocioId,
        a.usuario_id AS usuarioId,
        u.nombre AS usuarioNombre,
        u.correo AS usuarioCorreo,
        u.rol AS usuarioRol,
        a.accion,
        a.descripcion,
        a.creado_en AS creadoEn
      FROM auditoria_logs a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.negocio_id = ?
    `;
    const params = [negocioId];

    if (usuarioId) {
      sql += ' AND a.usuario_id = ?';
      params.push(usuarioId);
    }

    if (accion) {
      sql += ' AND a.accion = ?';
      params.push(accion);
    }

    if (fechaInicio) {
      sql += ' AND a.creado_en >= ?';
      params.push(fechaInicio);
    }

    if (fechaFin) {
      sql += ' AND a.creado_en <= ?';
      params.push(fechaFin);
    }

    sql += ' ORDER BY a.creado_en DESC';

    const [filas] = await pool.query(sql, params);
    return filas;
  }
};
