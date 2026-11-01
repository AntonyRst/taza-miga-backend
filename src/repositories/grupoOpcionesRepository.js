import pool from '../db.js';

/**
 * Repositorio para la tabla grupos_opciones.
 * Consultas SQL parametrizadas filtradas por negocio_id (RN-01).
 */
export const grupoOpcionesRepository = {
  /**
   * Lista todos los grupos de opciones de un negocio.
   * @param {number} negocioId
   * @param {boolean} [soloActivos=false]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, soloActivos = false) {
    let sql = `
      SELECT
        id,
        negocio_id AS negocioId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        tipo_seleccion AS tipoSeleccion,
        obligatorio,
        activo,
        creado_en AS creadoEn
      FROM grupos_opciones
      WHERE negocio_id = ?
    `;
    const params = [negocioId];

    if (soloActivos) {
      sql += ' AND activo = TRUE';
    }

    sql += ' ORDER BY id ASC';

    const [filas] = await pool.query(sql, params);
    return filas;
  },

  /**
   * Busca un grupo por ID y negocio.
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
        tipo_seleccion AS tipoSeleccion,
        obligatorio,
        activo,
        creado_en AS creadoEn
      FROM grupos_opciones
      WHERE id = ? AND negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    return filas.length > 0 ? filas[0] : null;
  },

  /**
   * Crea un nuevo grupo de opciones.
   * @param {object} grupo
   * @returns {Promise<number>} ID insertado
   */
  async crear(grupo) {
    const [resultado] = await pool.query(
      `INSERT INTO grupos_opciones (negocio_id, nombre_es, nombre_en, tipo_seleccion, obligatorio, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        grupo.negocioId,
        grupo.nombreEs,
        grupo.nombreEn,
        grupo.tipoSeleccion,
        grupo.obligatorio ?? false,
        grupo.activo !== undefined ? grupo.activo : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Actualiza un grupo de opciones.
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
    if (datos.tipoSeleccion !== undefined) {
      campos.push('tipo_seleccion = ?');
      params.push(datos.tipoSeleccion);
    }
    if (datos.obligatorio !== undefined) {
      campos.push('obligatorio = ?');
      params.push(datos.obligatorio);
    }
    if (datos.activo !== undefined) {
      campos.push('activo = ?');
      params.push(datos.activo);
    }

    if (campos.length === 0) return false;

    params.push(id, negocioId);
    const [resultado] = await pool.query(
      `UPDATE grupos_opciones SET ${campos.join(', ')} WHERE id = ? AND negocio_id = ?`,
      params
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Elimina un grupo de opciones si no tiene relaciones.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<boolean>}
   */
  async eliminar(id, negocioId) {
    const [resultado] = await pool.query(
      'DELETE FROM grupos_opciones WHERE id = ? AND negocio_id = ?',
      [id, negocioId]
    );

    return resultado.affectedRows > 0;
  }
};
