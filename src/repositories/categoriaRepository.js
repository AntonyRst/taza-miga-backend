import pool from '../db.js';

/**
 * Repositorio para la tabla categorias.
 * Consultas SQL parametrizadas filtradas por negocio_id (RN-01).
 */
export const categoriaRepository = {
  /**
   * Lista todas las categorías de un negocio.
   * @param {number} negocioId
   * @param {boolean} [soloActivas=false]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, soloActivas = false) {
    let sql = `
      SELECT
        id,
        negocio_id AS negocioId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        orden,
        activa,
        creado_en AS creadoEn
      FROM categorias
      WHERE negocio_id = ?
    `;
    const params = [negocioId];

    if (soloActivas) {
      sql += ' AND activa = TRUE';
    }

    sql += ' ORDER BY orden ASC, id ASC';

    const [filas] = await pool.query(sql, params);
    return filas;
  },

  /**
   * Busca una categoría por ID y negocio.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object|null>}
   */
  async buscarPorId(id, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        orden,
        activa,
        creado_en AS creadoEn
      FROM categorias
      WHERE id = ? AND negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    return filas.length > 0 ? filas[0] : null;
  },

  /**
   * Cuenta cuántos productos activos tiene una categoría (para RN-10).
   * @param {number} categoriaId
   * @param {number} negocioId
   * @returns {Promise<number>}
   */
  async contarProductosActivos(categoriaId, negocioId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM productos
       WHERE categoria_id = ? AND negocio_id = ? AND activo = TRUE`,
      [categoriaId, negocioId]
    );

    return filas[0]?.total || 0;
  },

  /**
   * Crea una nueva categoría.
   * @param {object} categoria
   * @returns {Promise<number>} ID insertado
   */
  async crear(categoria) {
    const [resultado] = await pool.query(
      `INSERT INTO categorias (negocio_id, nombre_es, nombre_en, orden, activa)
       VALUES (?, ?, ?, ?, ?)`,
      [
        categoria.negocioId,
        categoria.nombreEs,
        categoria.nombreEn,
        categoria.orden ?? 0,
        categoria.activa !== undefined ? categoria.activa : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Actualiza los datos de una categoría.
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @returns {Promise<boolean>}
   */
  async actualizar(id, negocioId, datos) {
    const campos = [];
    const params = [];

    if (datos.nombreEs !== undefined) {
      campos.push('nombre_es = ?');
      params.push(datos.nombreEs);
    }
    if (datos.nombreEn !== undefined) {
      campos.push('nombre_en = ?');
      params.push(datos.nombreEn);
    }
    if (datos.orden !== undefined) {
      campos.push('orden = ?');
      params.push(datos.orden);
    }
    if (datos.activa !== undefined) {
      campos.push('activa = ?');
      params.push(datos.activa);
    }

    if (campos.length === 0) return false;

    params.push(id, negocioId);
    const [resultado] = await pool.query(
      `UPDATE categorias SET ${campos.join(', ')} WHERE id = ? AND negocio_id = ?`,
      params
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Elimina una categoría si no tiene registros dependientes.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<boolean>}
   */
  async eliminar(id, negocioId) {
    const [resultado] = await pool.query(
      'DELETE FROM categorias WHERE id = ? AND negocio_id = ?',
      [id, negocioId]
    );

    return resultado.affectedRows > 0;
  }
};
