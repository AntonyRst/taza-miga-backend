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
   * Busca un usuario por su ID primario, incluyendo el hash de la contraseña.
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
        password_hash AS passwordHash,
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
  },

  /**
   * Actualiza la contraseña del usuario y retira la marca de cambio obligatorio (HU-03, RN-09).
   * @param {number} id
   * @param {string} nuevoHash
   * @returns {Promise<boolean>}
   */
  async actualizarPassword(id, nuevoHash) {
    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET password_hash = ?, debe_cambiar_password = FALSE
       WHERE id = ?`,
      [nuevoHash, id]
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Inserta un nuevo usuario en la base de datos.
   * @param {object} usuario
   * @returns {Promise<number>} ID del usuario creado
   */
  async crear(usuario) {
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (
        negocio_id, sucursal_id, nombre, cargo, telefono,
        acceso_sistema, correo, password_hash, rol,
        debe_cambiar_password, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.negocioId,
        usuario.sucursalId || null,
        usuario.nombre,
        usuario.cargo,
        usuario.telefono,
        usuario.accesoSistema !== undefined ? usuario.accesoSistema : true,
        usuario.correo,
        usuario.passwordHash,
        usuario.rol || 'BARISTA',
        usuario.debeCambiarPassword !== undefined ? usuario.debeCambiarPassword : false,
        usuario.activo !== undefined ? usuario.activo : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Lista el personal de un negocio con filtros opcionales de sucursal, cargo y búsqueda (HU-18).
   */
  async listarPorNegocio(negocioId, { sucursalId, cargo, q } = {}) {
    let sql = `
      SELECT
        u.id,
        u.negocio_id AS negocioId,
        u.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        u.nombre,
        u.cargo,
        u.telefono,
        u.acceso_sistema AS accesoSistema,
        u.correo,
        u.rol,
        u.debe_cambiar_password AS debeCambiarPassword,
        u.activo,
        u.creado_en AS creadoEn
      FROM usuarios u
      LEFT JOIN sucursales s ON u.sucursal_id = s.id
      WHERE u.negocio_id = ?
    `;
    const params = [negocioId];

    if (sucursalId) {
      sql += ' AND u.sucursal_id = ?';
      params.push(sucursalId);
    }

    if (cargo) {
      sql += ' AND LOWER(u.cargo) = LOWER(?)';
      params.push(cargo);
    }

    if (q) {
      sql += ' AND (LOWER(u.nombre) LIKE ? OR LOWER(u.correo) LIKE ?)';
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }

    sql += ' ORDER BY u.nombre ASC';

    const [filas] = await pool.query(sql, params);
    return filas.map((u) => ({
      ...u,
      accesoSistema: Boolean(u.accesoSistema),
      debeCambiarPassword: Boolean(u.debeCambiarPassword),
      activo: Boolean(u.activo)
    }));
  },

  /**
   * Busca usuario por ID y negocio sin exponer contraseña.
   */
  async buscarPorIdYNegocio(id, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        u.id,
        u.negocio_id AS negocioId,
        u.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        u.nombre,
        u.cargo,
        u.telefono,
        u.acceso_sistema AS accesoSistema,
        u.correo,
        u.rol,
        u.debe_cambiar_password AS debeCambiarPassword,
        u.activo,
        u.creado_en AS creadoEn
      FROM usuarios u
      LEFT JOIN sucursales s ON u.sucursal_id = s.id
      WHERE u.id = ? AND u.negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    if (filas.length === 0) return null;
    const u = filas[0];
    return {
      ...u,
      accesoSistema: Boolean(u.accesoSistema),
      debeCambiarPassword: Boolean(u.debeCambiarPassword),
      activo: Boolean(u.activo)
    };
  },

  /**
   * Actualiza datos de un usuario (HU-18).
   */
  async actualizar(id, negocioId, datos) {
    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET nombre = ?, cargo = ?, telefono = ?, sucursal_id = ?,
           acceso_sistema = ?, correo = ?, rol = ?, activo = ?
       WHERE id = ? AND negocio_id = ?`,
      [
        datos.nombre,
        datos.cargo,
        datos.telefono,
        datos.sucursalId || null,
        Boolean(datos.accesoSistema),
        datos.correo || null,
        datos.rol || 'SIN_ACCESO',
        datos.activo !== undefined ? Boolean(datos.activo) : true,
        id,
        negocioId
      ]
    );
    return resultado.affectedRows > 0;
  },

  /**
   * Traslada un usuario a una nueva sucursal (HU-21, RN-26).
   */
  async actualizarSucursal(id, negocioId, nuevaSucursalId) {
    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET sucursal_id = ?
       WHERE id = ? AND negocio_id = ?`,
      [nuevaSucursalId, id, negocioId]
    );
    return resultado.affectedRows > 0;
  },

  /**
   * Cambia el estado activo/inactivo de un usuario (RN-08, RN-10).
   */
  async actualizarActivo(id, negocioId, activo) {
    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET activo = ?
       WHERE id = ? AND negocio_id = ?`,
      [Boolean(activo), id, negocioId]
    );
    return resultado.affectedRows > 0;
  },

  /**
   * Asigna una contraseña temporal activando debe_cambiar_password (HU-19, RN-09).
   */
  async asignarPasswordTemporal(id, negocioId, passwordHash) {
    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET password_hash = ?, debe_cambiar_password = TRUE
       WHERE id = ? AND negocio_id = ?`,
      [passwordHash, id, negocioId]
    );
    return resultado.affectedRows > 0;
  },

  /**
   * Cuenta cuántos dueños activos tiene el negocio (RN-08).
   */
  async contarDuenosActivos(negocioId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM usuarios
       WHERE negocio_id = ? AND rol = 'DUENO' AND activo = TRUE`,
      [negocioId]
    );
    return Number(filas[0]?.total || 0);
  },

  /**
   * Verifica si el usuario ha despachado tickets (RN-10).
   */
  async tieneHistorialDespachos(usuarioId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tickets
       WHERE generado_por = ?`,
      [usuarioId]
    );
    return Number(filas[0]?.total || 0) > 0;
  },

  /**
   * Cuenta pedidos activos en una sucursal (para alertar en traslados, HU-21).
   */
  async contarPedidosEnCursoPorSucursal(sucursalId) {
    const [filas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ordenes
       WHERE sucursal_id = ? AND estado IN ('RECIBIDO', 'PREPARACION')`,
      [sucursalId]
    );
    return Number(filas[0]?.total || 0);
  }
};
