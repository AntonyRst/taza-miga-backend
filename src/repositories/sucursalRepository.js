import pool from '../db.js';

/**
 * Repositorio para la tabla sucursales.
 * Solo ejecuta consultas SQL con parámetros (?); no contiene reglas de negocio.
 */
export const sucursalRepository = {
  /**
   * Busca una sucursal por su ID primario y el ID del negocio (RN-01).
   * @param {number} id - Identificador de la sucursal
   * @param {number} negocioId - Identificador del negocio al que pertenece
   * @returns {Promise<object|null>}
   */
  async buscarPorIdYNegocio(id, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        nombre,
        direccion,
        latitud,
        longitud,
        telefono,
        cantidad_mesas AS cantidadMesas,
        activa,
        creado_en AS creadoEn
      FROM sucursales
      WHERE id = ? AND negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    return filas.length > 0 ? filas[0] : null;
  }
};
