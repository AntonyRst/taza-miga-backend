import pool from '../db.js';

/**
 * Repositorio para la tabla opciones.
 * Consultas SQL parametrizadas filtradas por negocio_id (RN-01).
 */
export const opcionRepository = {
  /**
   * Lista todas las opciones pertenecientes a un grupo.
   * @param {number} grupoId
   * @param {number} negocioId
   * @param {boolean} [soloActivas=false]
   * @returns {Promise<Array<object>>}
   */
  async listarPorGrupo(grupoId, negocioId, soloActivas = false) {
    let sql = `
      SELECT
        id,
        negocio_id AS negocioId,
        grupo_id AS grupoId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        precio_extra AS precioExtra,
        es_predeterminada AS esPredeterminada,
        activa,
        creado_en AS creadoEn
      FROM opciones
      WHERE grupo_id = ? AND negocio_id = ?
    `;
    const params = [grupoId, negocioId];

    if (soloActivas) {
      sql += ' AND activa = TRUE';
    }

    sql += ' ORDER BY id ASC';

    const [filas] = await pool.query(sql, params);
    return filas;
  },

  /**
   * Busca una opción por ID y negocio.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object|null>}
   */
  async buscarPorId(id, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        grupo_id AS grupoId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        precio_extra AS precioExtra,
        es_predeterminada AS esPredeterminada,
        activa,
        creado_en AS creadoEn
      FROM opciones
      WHERE id = ? AND negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    return filas.length > 0 ? filas[0] : null;
  },

  /**
   * Desmarca otras opciones predeterminadas de un grupo (para grupos de tipo UNICA).
   * @param {number} grupoId
   * @param {number} negocioId
   * @returns {Promise<boolean>}
   */
  async desmarcarPredeterminadas(grupoId, negocioId) {
    const [resultado] = await pool.query(
      `UPDATE opciones SET es_predeterminada = FALSE WHERE grupo_id = ? AND negocio_id = ?`,
      [grupoId, negocioId]
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Crea una nueva opción en un grupo.
   * @param {object} opcion
   * @returns {Promise<number>} ID insertado
   */
  async crear(opcion) {
    const [resultado] = await pool.query(
      `INSERT INTO opciones (negocio_id, grupo_id, nombre_es, nombre_en, precio_extra, es_predeterminada, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        opcion.negocioId,
        opcion.grupoId,
        opcion.nombreEs,
        opcion.nombreEn,
        opcion.precioExtra ?? 0.00,
        opcion.esPredeterminada ?? false,
        opcion.activa !== undefined ? opcion.activa : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Actualiza una opción.
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
    if (datos.precioExtra !== undefined) {
      campos.push('precio_extra = ?');
      params.push(datos.precioExtra);
    }
    if (datos.esPredeterminada !== undefined) {
      campos.push('es_predeterminada = ?');
      params.push(datos.esPredeterminada);
    }
    if (datos.activa !== undefined) {
      campos.push('activa = ?');
      params.push(datos.activa);
    }

    if (campos.length === 0) return false;

    params.push(id, negocioId);
    const [resultado] = await pool.query(
      `UPDATE opciones SET ${campos.join(', ')} WHERE id = ? AND negocio_id = ?`,
      params
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Elimina una opción si no tiene historial.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<boolean>}
   */
  async eliminar(id, negocioId) {
    const [resultado] = await pool.query(
      'DELETE FROM opciones WHERE id = ? AND negocio_id = ?',
      [id, negocioId]
    );

    return resultado.affectedRows > 0;
  }
};
