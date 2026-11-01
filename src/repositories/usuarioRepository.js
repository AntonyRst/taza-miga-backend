import pool from '../db.js';

/**
 * Repositorio para la tabla usuarios.
 * Solo ejecuta consultas SQL con parámetros (?); no contiene reglas de negocio.
 */
export const usuarioRepository = {
  /**
   * Busca un usuario por su correo electrónico.
   * @param {string} correo
   * @returns {Promise<object|null>}
   */
  async buscarPorCorreo(correo) {
    const [filas] = await pool.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        sucursal_id AS sucursalId,
        nombre,
        cargo,
        telefono,
        acceso_sistema AS accesoSistema,
        correo,
        password_hash AS passwordHash,
        rol,
        debe_cambiar_password AS debeCambiarPassword,
        activo,
        creado_en AS creadoEn
      FROM usuarios
      WHERE correo = ?
      LIMIT 1`,
      [correo]
    );

    return filas.length > 0 ? filas[0] : null;
  },

  /**
   * Busca un usuario por su ID primario.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async buscarPorId(id) {
    const [filas] = await pool.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        sucursal_id AS sucursalId,
        nombre,
        cargo,
        telefono,
        acceso_sistema AS accesoSistema,
        correo,
        rol,
        debe_cambiar_password AS debeCambiarPassword,
        activo,
        creado_en AS creadoEn
      FROM usuarios
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    return filas.length > 0 ? filas[0] : null;
  }
};
