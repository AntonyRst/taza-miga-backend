import pool from '../db.js';

/**
 * Repositorio de consultas SQL analíticas para el dashboard de métricas
 * y el historial de pedidos y tickets (HU-22, HU-23, RN-30 a RN-35).
 * Todas las cifras y desgloses se calculan en la base de datos (RN-Cálculos).
 */
export const reportesRepository = {
  /**
   * Obtiene las cifras de resumen clave del periodo (RN-30 a RN-34).
   * Solo cuentan pedidos ENTREGADO para ventas; CANCELADO no es venta (RN-30).
   */
  async obtenerCifrasResumen(negocioId, { sucursalId, fechaInicio, fechaFin } = {}) {
    // 1. Métricas de pedidos entregados (Ventas, cantidad, ticket promedio, tiempos promedio)
    let sqlEntregados = `
      SELECT
        COALESCE(SUM(total), 0) AS totalVentas,
        COUNT(*) AS totalPedidosEntregados,
        COALESCE(AVG(total), 0) AS ticketPromedio,
        COALESCE(AVG(TIMESTAMPDIFF(MINUTE, iniciado_en, listo_en)), 0) AS tiempoPromedioPreparacion,
        COALESCE(AVG(TIMESTAMPDIFF(MINUTE, creado_en, entregado_en)), 0) AS tiempoPromedioEspera
      FROM ordenes
      WHERE negocio_id = ? AND estado = 'ENTREGADO'
    `;
    const paramsEntregados = [negocioId];

    if (sucursalId) {
      sqlEntregados += ' AND sucursal_id = ?';
      paramsEntregados.push(sucursalId);
    }
    if (fechaInicio) {
      sqlEntregados += ' AND entregado_en >= ?';
      paramsEntregados.push(fechaInicio);
    }
    if (fechaFin) {
      sqlEntregados += ' AND entregado_en <= ?';
      paramsEntregados.push(fechaFin);
    }

    const [filasEntregados] = await pool.query(sqlEntregados, paramsEntregados);
    const resumenEntregados = filasEntregados[0] || {};

    // 2. Métricas de pedidos totales y cancelados para tasa de cancelación (RN-34)
    let sqlCancelados = `
      SELECT
        COUNT(*) AS pedidosTotales,
        SUM(CASE WHEN estado = 'CANCELADO' THEN 1 ELSE 0 END) AS pedidosCancelados
      FROM ordenes
      WHERE negocio_id = ?
    `;
    const paramsCancelados = [negocioId];

    if (sucursalId) {
      sqlCancelados += ' AND sucursal_id = ?';
      paramsCancelados.push(sucursalId);
    }
    if (fechaInicio) {
      sqlCancelados += ' AND creado_en >= ?';
      paramsCancelados.push(fechaInicio);
    }
    if (fechaFin) {
      sqlCancelados += ' AND creado_en <= ?';
      paramsCancelados.push(fechaFin);
    }

    const [filasCancelados] = await pool.query(sqlCancelados, paramsCancelados);
    const resumenCancelados = filasCancelados[0] || {};

    const pedidosTotales = Number(resumenCancelados.pedidosTotales || 0);
    const pedidosCancelados = Number(resumenCancelados.pedidosCancelados || 0);
    const tasaCancelacion =
      pedidosTotales > 0 ? (pedidosCancelados / pedidosTotales) * 100 : 0;

    // 3. Motivos de cancelación agrupados (RN-34)
    let sqlMotivos = `
      SELECT
        COALESCE(motivo_cancelacion, 'Sin motivo especificado') AS motivo,
        COUNT(*) AS cantidad
      FROM ordenes
      WHERE negocio_id = ? AND estado = 'CANCELADO'
    `;
    const paramsMotivos = [negocioId];

    if (sucursalId) {
      sqlMotivos += ' AND sucursal_id = ?';
      paramsMotivos.push(sucursalId);
    }
    if (fechaInicio) {
      sqlMotivos += ' AND creado_en >= ?';
      paramsMotivos.push(fechaInicio);
    }
    if (fechaFin) {
      sqlMotivos += ' AND creado_en <= ?';
      paramsMotivos.push(fechaFin);
    }
    sqlMotivos += ' GROUP BY motivo_cancelacion ORDER BY cantidad DESC';

    const [motivosCancelacion] = await pool.query(sqlMotivos, paramsMotivos);

    return {
      totalVentas: Number(Number(resumenEntregados.totalVentas || 0).toFixed(2)),
      totalPedidosEntregados: Number(resumenEntregados.totalPedidosEntregados || 0),
      ticketPromedio: Number(Number(resumenEntregados.ticketPromedio || 0).toFixed(2)),
      tiempoPromedioPreparacionMin: Math.round(Number(resumenEntregados.tiempoPromedioPreparacion || 0)),
      tiempoPromedioEsperaMin: Math.round(Number(resumenEntregados.tiempoPromedioEspera || 0)),
      pedidosTotales,
      pedidosCancelados,
      tasaCancelacion: Number(tasaCancelacion.toFixed(1)),
      motivosCancelacion
    };
  },

  /**
   * Obtiene los productos más vendidos por unidades (RN-32).
   */
  async obtenerProductosMasVendidos(negocioId, { sucursalId, fechaInicio, fechaFin, limite = 5 } = {}) {
    let sql = `
      SELECT
        d.producto_id AS productoId,
        d.nombre_producto AS nombreProducto,
        SUM(d.cantidad) AS unidadesVendidas,
        SUM(d.cantidad * d.precio_unitario) AS ingresosTotales
      FROM detalles_orden d
      INNER JOIN ordenes o ON d.orden_id = o.id
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const params = [negocioId];

    if (sucursalId) {
      sql += ' AND o.sucursal_id = ?';
      params.push(sucursalId);
    }
    if (fechaInicio) {
      sql += ' AND o.entregado_en >= ?';
      params.push(fechaInicio);
    }
    if (fechaFin) {
      sql += ' AND o.entregado_en <= ?';
      params.push(fechaFin);
    }

    sql += ' GROUP BY d.producto_id, d.nombre_producto ORDER BY unidadesVendidas DESC LIMIT ?';
    params.push(Number(limite));

    const [filas] = await pool.query(sql, params);
    return filas.map((p) => ({
      ...p,
      unidadesVendidas: Number(p.unidadesVendidas),
      ingresosTotales: Number(Number(p.ingresosTotales).toFixed(2))
    }));
  },

  /**
   * Obtiene desgloses para gráficos (RN-35): día, hora, categorías, pago, modalidad, barista.
   */
  async obtenerDesgloses(negocioId, { sucursalId, fechaInicio, fechaFin } = {}) {
    // A. Ventas por día
    let sqlDias = `
      SELECT
        DATE(o.entregado_en) AS fecha,
        SUM(o.total) AS totalVentas,
        COUNT(*) AS pedidos
      FROM ordenes o
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsDias = [negocioId];
    if (sucursalId) { sqlDias += ' AND o.sucursal_id = ?'; paramsDias.push(sucursalId); }
    if (fechaInicio) { sqlDias += ' AND o.entregado_en >= ?'; paramsDias.push(fechaInicio); }
    if (fechaFin) { sqlDias += ' AND o.entregado_en <= ?'; paramsDias.push(fechaFin); }
    sqlDias += ' GROUP BY DATE(o.entregado_en) ORDER BY fecha ASC';
    const [ventasPorDia] = await pool.query(sqlDias, paramsDias);

    // B. Ventas por hora
    let sqlHoras = `
      SELECT
        HOUR(o.entregado_en) AS hora,
        SUM(o.total) AS totalVentas,
        COUNT(*) AS pedidos
      FROM ordenes o
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsHoras = [negocioId];
    if (sucursalId) { sqlHoras += ' AND o.sucursal_id = ?'; paramsHoras.push(sucursalId); }
    if (fechaInicio) { sqlHoras += ' AND o.entregado_en >= ?'; paramsHoras.push(fechaInicio); }
    if (fechaFin) { sqlHoras += ' AND o.entregado_en <= ?'; paramsHoras.push(fechaFin); }
    sqlHoras += ' GROUP BY HOUR(o.entregado_en) ORDER BY hora ASC';
    const [ventasPorHora] = await pool.query(sqlHoras, paramsHoras);

    // C. Ventas por categoría
    let sqlCategorias = `
      SELECT
        c.nombre_es AS categoriaNombreEs,
        c.nombre_en AS categoriaNombreEn,
        SUM(d.cantidad * d.precio_unitario) AS totalVentas,
        SUM(d.cantidad) AS unidades
      FROM detalles_orden d
      INNER JOIN ordenes o ON d.orden_id = o.id
      INNER JOIN productos p ON d.producto_id = p.id
      INNER JOIN categorias c ON p.categoria_id = c.id
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsCategorias = [negocioId];
    if (sucursalId) { sqlCategorias += ' AND o.sucursal_id = ?'; paramsCategorias.push(sucursalId); }
    if (fechaInicio) { sqlCategorias += ' AND o.entregado_en >= ?'; paramsCategorias.push(fechaInicio); }
    if (fechaFin) { sqlCategorias += ' AND o.entregado_en <= ?'; paramsCategorias.push(fechaFin); }
    sqlCategorias += ' GROUP BY c.id, c.nombre_es, c.nombre_en ORDER BY totalVentas DESC';
    const [ventasPorCategoria] = await pool.query(sqlCategorias, paramsCategorias);

    // D. Ventas por método de pago
    let sqlPago = `
      SELECT
        o.metodo_pago AS metodoPago,
        SUM(o.total) AS totalVentas,
        COUNT(*) AS pedidos
      FROM ordenes o
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsPago = [negocioId];
    if (sucursalId) { sqlPago += ' AND o.sucursal_id = ?'; paramsPago.push(sucursalId); }
    if (fechaInicio) { sqlPago += ' AND o.entregado_en >= ?'; paramsPago.push(fechaInicio); }
    if (fechaFin) { sqlPago += ' AND o.entregado_en <= ?'; paramsPago.push(fechaFin); }
    sqlPago += ' GROUP BY o.metodo_pago';
    const [ventasPorMetodoPago] = await pool.query(sqlPago, paramsPago);

    // E. Ventas por modalidad (MESA o LLEVAR)
    let sqlModalidad = `
      SELECT
        o.tipo_entrega AS tipoEntrega,
        SUM(o.total) AS totalVentas,
        COUNT(*) AS pedidos
      FROM ordenes o
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsModalidad = [negocioId];
    if (sucursalId) { sqlModalidad += ' AND o.sucursal_id = ?'; paramsModalidad.push(sucursalId); }
    if (fechaInicio) { sqlModalidad += ' AND o.entregado_en >= ?'; paramsModalidad.push(fechaInicio); }
    if (fechaFin) { sqlModalidad += ' AND o.entregado_en <= ?'; paramsModalidad.push(fechaFin); }
    sqlModalidad += ' GROUP BY o.tipo_entrega';
    const [ventasPorModalidad] = await pool.query(sqlModalidad, paramsModalidad);

    // F. Ventas por barista (quien despachó según el ticket)
    let sqlBaristas = `
      SELECT
        COALESCE(u.nombre, 'Sin registrar') AS baristaNombre,
        SUM(o.total) AS totalVentas,
        COUNT(DISTINCT o.id) AS pedidosDespachados
      FROM ordenes o
      INNER JOIN tickets t ON o.id = t.orden_id
      LEFT JOIN usuarios u ON t.generado_por = u.id
      WHERE o.negocio_id = ? AND o.estado = 'ENTREGADO'
    `;
    const paramsBaristas = [negocioId];
    if (sucursalId) { sqlBaristas += ' AND o.sucursal_id = ?'; paramsBaristas.push(sucursalId); }
    if (fechaInicio) { sqlBaristas += ' AND o.entregado_en >= ?'; paramsBaristas.push(fechaInicio); }
    if (fechaFin) { sqlBaristas += ' AND o.entregado_en <= ?'; paramsBaristas.push(fechaFin); }
    sqlBaristas += ' GROUP BY t.generado_por, u.nombre ORDER BY totalVentas DESC';
    const [ventasPorBarista] = await pool.query(sqlBaristas, paramsBaristas);

    return {
      ventasPorDia: ventasPorDia.map((d) => ({
        fecha: d.fecha instanceof Date ? d.fecha.toISOString().split('T')[0] : String(d.fecha),
        totalVentas: Number(Number(d.totalVentas).toFixed(2)),
        pedidos: Number(d.pedidos)
      })),
      ventasPorHora: ventasPorHora.map((h) => ({
        hora: `${h.hora}:00`,
        totalVentas: Number(Number(h.totalVentas).toFixed(2)),
        pedidos: Number(h.pedidos)
      })),
      ventasPorCategoria: ventasPorCategoria.map((c) => ({
        nombreEs: c.categoriaNombreEs,
        nombreEn: c.categoriaNombreEn,
        totalVentas: Number(Number(c.totalVentas).toFixed(2)),
        unidades: Number(c.unidades)
      })),
      ventasPorMetodoPago: ventasPorMetodoPago.map((p) => ({
        metodoPago: p.metodoPago,
        totalVentas: Number(Number(p.totalVentas).toFixed(2)),
        pedidos: Number(p.pedidos)
      })),
      ventasPorModalidad: ventasPorModalidad.map((m) => ({
        tipoEntrega: m.tipoEntrega,
        totalVentas: Number(Number(m.totalVentas).toFixed(2)),
        pedidos: Number(m.pedidos)
      })),
      ventasPorBarista: ventasPorBarista.map((b) => ({
        baristaNombre: b.baristaNombre,
        totalVentas: Number(Number(b.totalVentas).toFixed(2)),
        pedidosDespachados: Number(b.pedidosDespachados)
      }))
    };
  },

  /**
   * Consulta el registro histórico de pedidos y tickets (HU-23).
   */
  async listarHistorialPedidos(negocioId, { sucursalId, estado, metodoPago, fechaInicio, fechaFin, q } = {}) {
    let sql = `
      SELECT
        o.id,
        o.negocio_id AS negocioId,
        o.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        o.numero_orden AS numeroOrden,
        o.codigo_seguimiento AS codigoSeguimiento,
        o.nombre_cliente AS nombreCliente,
        o.tipo_entrega AS tipoEntrega,
        o.numero_mesa AS numeroMesa,
        o.hora_recogida AS horaRecogida,
        o.metodo_pago AS metodoPago,
        o.estado_pago AS estadoPago,
        o.estado,
        o.total,
        o.motivo_cancelacion AS motivoCancelacion,
        o.iniciado_en AS iniciadoEn,
        o.listo_en AS listoEn,
        o.entregado_en AS entregadoEn,
        o.creado_en AS creadoEn,
        t.id AS ticketId,
        t.reimpresiones AS ticketReimpresiones
      FROM ordenes o
      INNER JOIN sucursales s ON o.sucursal_id = s.id
      LEFT JOIN tickets t ON o.id = t.orden_id
      WHERE o.negocio_id = ?
    `;
    const params = [negocioId];

    if (sucursalId) {
      sql += ' AND o.sucursal_id = ?';
      params.push(sucursalId);
    }
    if (estado && estado !== 'TODOS') {
      sql += ' AND o.estado = ?';
      params.push(estado);
    }
    if (metodoPago && metodoPago !== 'TODOS') {
      sql += ' AND o.metodo_pago = ?';
      params.push(metodoPago);
    }
    if (fechaInicio) {
      sql += ' AND o.creado_en >= ?';
      params.push(fechaInicio);
    }
    if (fechaFin) {
      sql += ' AND o.creado_en <= ?';
      params.push(fechaFin);
    }
    if (q) {
      sql += ' AND (LOWER(o.nombre_cliente) LIKE ? OR o.numero_orden = ?)';
      params.push(`%${q.toLowerCase()}%`, Number(q) || 0);
    }

    sql += ' ORDER BY o.creado_en DESC LIMIT 100';

    const [filas] = await pool.query(sql, params);
    return filas.map((o) => ({
      ...o,
      total: Number(o.total),
      tieneTicket: Boolean(o.ticketId),
      ticketReimpresiones: o.ticketReimpresiones ? Number(o.ticketReimpresiones) : 0
    }));
  }
};
