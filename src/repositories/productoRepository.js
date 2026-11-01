import pool from '../db.js';

/**
 * Repositorio para la tabla productos.
 * Consultas SQL parametrizadas filtradas por negocio_id (RN-01).
 */
export const productoRepository = {
  /**
   * Lista productos con filtros opcionales de categoría, disponibilidad, actividad y búsqueda.
   * @param {number} negocioId
   * @param {object} [filtros={}]
   * @returns {Promise<Array<object>>}
   */
  async listar(negocioId, { categoriaId, disponible, soloActivos = false, busqueda } = {}) {
    let sql = `
      SELECT
        p.id,
        p.negocio_id AS negocioId,
        p.categoria_id AS categoriaId,
        c.nombre_es AS categoriaNombreEs,
        c.nombre_en AS categoriaNombreEn,
        p.nombre_es AS nombreEs,
        p.nombre_en AS nombreEn,
        p.descripcion_es AS descripcionEs,
        p.descripcion_en AS descripcionEn,
        p.precio,
        p.imagen_url AS imagenUrl,
        p.disponible,
        p.activo,
        p.creado_en AS creadoEn
      FROM productos p
      INNER JOIN categorias c ON p.categoria_id = c.id
      WHERE p.negocio_id = ?
    `;
    const params = [negocioId];

    if (categoriaId) {
      sql += ' AND p.categoria_id = ?';
      params.push(categoriaId);
    }

    if (disponible !== undefined) {
      sql += ' AND p.disponible = ?';
      params.push(disponible);
    }

    if (soloActivos) {
      sql += ' AND p.activo = TRUE';
    }

    if (busqueda) {
      sql += ' AND (p.nombre_es LIKE ? OR p.nombre_en LIKE ?)';
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }

    sql += ' ORDER BY c.orden ASC, p.id ASC';

    const [filas] = await pool.query(sql, params);
    return filas;
  },

  /**
   * Busca un producto por ID y negocio.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<object|null>}
   */
  async buscarPorId(id, negocioId) {
    const [filas] = await pool.query(
      `SELECT
        p.id,
        p.negocio_id AS negocioId,
        p.categoria_id AS categoriaId,
        c.nombre_es AS categoriaNombreEs,
        c.nombre_en AS categoriaNombreEn,
        p.nombre_es AS nombreEs,
        p.nombre_en AS nombreEn,
        p.descripcion_es AS descripcionEs,
        p.descripcion_en AS descripcionEn,
        p.precio,
        p.imagen_url AS imagenUrl,
        p.disponible,
        p.activo,
        p.creado_en AS creadoEn
      FROM productos p
      INNER JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ? AND p.negocio_id = ?
      LIMIT 1`,
      [id, negocioId]
    );

    return filas.length > 0 ? filas[0] : null;
  },

  /**
   * Inserta un nuevo producto.
   * @param {object} producto
   * @param {object} [conexionTransaccion]
   * @returns {Promise<number>}
   */
  async crear(producto, conexionTransaccion = null) {
    const con = conexionTransaccion || pool;
    const [resultado] = await con.query(
      `INSERT INTO productos (
        negocio_id, categoria_id, nombre_es, nombre_en,
        descripcion_es, descripcion_en, precio, imagen_url,
        disponible, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        producto.negocioId,
        producto.categoriaId,
        producto.nombreEs,
        producto.nombreEn,
        producto.descripcionEs || null,
        producto.descripcionEn || null,
        producto.precio,
        producto.imagenUrl || null,
        producto.disponible !== undefined ? producto.disponible : true,
        producto.activo !== undefined ? producto.activo : true
      ]
    );

    return resultado.insertId;
  },

  /**
   * Actualiza los datos de un producto.
   * @param {number} id
   * @param {number} negocioId
   * @param {object} datos
   * @param {object} [conexionTransaccion]
   * @returns {Promise<boolean>}
   */
  async actualizar(id, negocioId, datos, conexionTransaccion = null) {
    const con = conexionTransaccion || pool;
    const campos = [];
    const params = [];

    if (datos.categoriaId !== undefined) {
      campos.push('categoria_id = ?');
      params.push(datos.categoriaId);
    }
    if (datos.nombreEs !== undefined) {
      campos.push('nombre_es = ?');
      params.push(datos.nombreEs);
    }
    if (datos.nombreEn !== undefined) {
      campos.push('nombre_en = ?');
      params.push(datos.nombreEn);
    }
    if (datos.descripcionEs !== undefined) {
      campos.push('descripcion_es = ?');
      params.push(datos.descripcionEs);
    }
    if (datos.descripcionEn !== undefined) {
      campos.push('descripcion_en = ?');
      params.push(datos.descripcionEn);
    }
    if (datos.precio !== undefined) {
      campos.push('precio = ?');
      params.push(datos.precio);
    }
    if (datos.imagenUrl !== undefined) {
      campos.push('imagen_url = ?');
      params.push(datos.imagenUrl);
    }
    if (datos.disponible !== undefined) {
      campos.push('disponible = ?');
      params.push(datos.disponible);
    }
    if (datos.activo !== undefined) {
      campos.push('activo = ?');
      params.push(datos.activo);
    }

    if (campos.length === 0) return false;

    params.push(id, negocioId);
    const [resultado] = await con.query(
      `UPDATE productos SET ${campos.join(', ')} WHERE id = ? AND negocio_id = ?`,
      params
    );

    return resultado.affectedRows > 0;
  },

  /**
   * Elimina un producto.
   * @param {number} id
   * @param {number} negocioId
   * @returns {Promise<boolean>}
   */
  async eliminar(id, negocioId) {
    const [resultado] = await pool.query(
      'DELETE FROM productos WHERE id = ? AND negocio_id = ?',
      [id, negocioId]
    );

    return resultado.affectedRows > 0;
  }
};
