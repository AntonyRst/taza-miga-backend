import pool from '../db.js';

/**
 * Repositorio para la tabla producto_grupos.
 * Gestiona la asignación de grupos de opciones a productos.
 */
export const productoGruposRepository = {
  /**
   * Obtiene los grupos de opciones asignados a un producto, ordenados.
   * @param {number} productoId
   * @param {number} negocioId
   * @returns {Promise<Array<object>>}
   */
  async obtenerGruposDeProducto(productoId, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        g.id,
        g.negocio_id AS negocioId,
        g.nombre_es AS nombreEs,
        g.nombre_en AS nombreEn,
        g.tipo_seleccion AS tipoSeleccion,
        g.obligatorio,
        g.activo,
        pg.orden
      FROM producto_grupos pg
      INNER JOIN grupos_opciones g ON pg.grupo_id = g.id
      WHERE pg.producto_id = ? AND pg.negocio_id = ?
      ORDER BY pg.orden ASC, g.id ASC`,
      [productoId, negocioId]
    );

    return filas;
  },

  /**
   * Reemplaza las asignaciones de grupos para un producto de forma atómica.
   * @param {number} productoId
   * @param {number} negocioId
   * @param {Array<number>} gruposIds
   * @param {object} [conexionTransaccion]
   */
  async sincronizarGrupos(productoId, negocioId, gruposIds = [], conexionTransaccion = null) {
    const con = conexionTransaccion || pool;

    await con.query(
      'DELETE FROM producto_grupos WHERE producto_id = ? AND negocio_id = ?',
      [productoId, negocioId]
    );

    if (gruposIds.length > 0) {
      const valores = gruposIds.map((grupoId, index) => [negocioId, productoId, grupoId, index + 1]);
      await con.query(
        'INSERT INTO producto_grupos (negocio_id, producto_id, grupo_id, orden) VALUES ?',
        [valores]
      );
    }
  }
};
