import pool from '../db.js';

/**
 * Repositorio para la tabla tickets (HU-17, RN-24).
 * Un ticket guardado no se puede modificar ni borrar.
 * Reimprimir solo suma 1 a reimpresiones.
 */
export const ticketRepository = {
  /**
   * Inserta un nuevo ticket en la base de datos (RN-24).
   * Debe ejecutarse dentro de la transacción de entrega del pedido.
   */
  async crearTicket(conexion, datos) {
    const { negocioId, ordenId, contenido, generadoPor } = datos;

    const [resultado] = await conexion.query(
      `INSERT INTO tickets (negocio_id, orden_id, contenido, generado_por)
       VALUES (?, ?, ?, ?)`,
      [negocioId, ordenId, contenido, generadoPor || null]
    );

    return resultado.insertId;
  },

  /**
   * Obtiene el ticket asociado a una orden verificando pertenencia al negocio.
   */
  async obtenerPorOrdenId(negocioId, ordenId) {
    const [filas] = await pool.query(
      `SELECT
        t.id,
        t.negocio_id AS negocioId,
        t.orden_id AS ordenId,
        t.contenido,
        t.generado_por AS generadoPor,
        u.nombre AS despachadoPorNombre,
        t.reimpresiones,
        t.creado_en AS creadoEn
      FROM tickets t
      LEFT JOIN usuarios u ON t.generado_por = u.id
      WHERE t.orden_id = ? AND t.negocio_id = ?`,
      [ordenId, negocioId]
    );

    return filas[0] || null;
  },

  /**
   * Incrementa en 1 el contador de reimpresiones de un ticket (RN-24).
   */
  async incrementarReimpresiones(ticketId) {
    await pool.query(
      `UPDATE tickets
       SET reimpresiones = reimpresiones + 1
       WHERE id = ?`,
      [ticketId]
    );
  }
};
