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
  },

  /**
   * Lista todas las sucursales de un negocio con contador de personal activo (HU-20).
   */
  async listarPorNegocio(negocioId) {
    const [filas] = await pool.query(
      `SELECT
        s.id,
        s.negocio_id AS negocioId,
        s.nombre,
        s.direccion,
        s.latitud,
        s.longitud,
        s.telefono,
        s.cantidad_mesas AS cantidadMesas,
        s.activa,
        s.creado_en AS creadoEn,
        COUNT(u.id) AS personalAsignado
      FROM sucursales s
      LEFT JOIN usuarios u ON s.id = u.sucursal_id AND u.activo = TRUE
      WHERE s.negocio_id = ?
      GROUP BY s.id
      ORDER BY s.id ASC`,
      [negocioId]
    );

    return filas.map((s) => ({
      ...s,
      latitud: s.latitud !== null ? Number(s.latitud) : null,
      longitud: s.longitud !== null ? Number(s.longitud) : null,
      cantidadMesas: Number(s.cantidadMesas),
      activa: Boolean(s.activa),
      personalAsignado: Number(s.personalAsignado)
    }));
  },

  /**
   * Inserta una nueva sucursal (HU-20).
   */
  async crear(sucursal) {
    const [resultado] = await pool.query(
      `INSERT INTO sucursales (
        negocio_id, nombre, direccion, latitud, longitud, telefono, cantidad_mesas, activa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sucursal.negocioId,
        sucursal.nombre,
        sucursal.direccion,
        sucursal.latitud || null,
        sucursal.longitud || null,
        sucursal.telefono || null,
        sucursal.cantidadMesas,
        sucursal.activa !== undefined ? Boolean(sucursal.activa) : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Actualiza datos de una sucursal (HU-20).
   */
  async actualizar(id, negocioId, datos) {
    const [resultado] = await pool.query(
      `UPDATE sucursales
       SET nombre = ?, direccion = ?, latitud = ?, longitud = ?,
           telefono = ?, cantidad_mesas = ?, activa = ?
       WHERE id = ? AND negocio_id = ?`,
      [
        datos.nombre,
        datos.direccion,
        datos.latitud !== undefined ? datos.latitud : null,
        datos.longitud !== undefined ? datos.longitud : null,
        datos.telefono || null,
        datos.cantidadMesas,
        datos.activa !== undefined ? Boolean(datos.activa) : true,
        id,
        negocioId
      ]
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Actualiza solo el estado activa/inactiva de una sucursal (RN-25).
   */
  async actualizarActiva(id, negocioId, activa) {
    const [resultado] = await pool.query(
      `UPDATE sucursales
       SET activa = ?
       WHERE id = ? AND negocio_id = ?`,
      [Boolean(activa), id, negocioId]
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Cuenta personal activo asignado a una sucursal (RN-25).
   */
  async contarPersonalActivo(sucursalId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM usuarios
       WHERE sucursal_id = ? AND activo = TRUE`,
      [sucursalId]
    );
    return Number(filas[0]?.total || 0);
  },

  /**
   * Cuenta pedidos históricos asociados a una sucursal (RN-10).
   */
  async contarPedidosHistoricos(sucursalId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ordenes
       WHERE sucursal_id = ?`,
      [sucursalId]
    );
    return Number(filas[0]?.total || 0);
  }
};
