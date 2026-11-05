import pool from '../db.js';

/**
 * Repositorio para tablas ordenes, detalles_orden y detalle_orden_opciones.
 * Consultas SQL puras con parámetros (?) y columnas mapeadas a camelCase.
 */
export const ordenRepository = {
  /**
   * Bloquea la fila de la sucursal con FOR UPDATE para serializar la asignación
   * del número consecutivo por sucursal sin condiciones de carrera (RN-19).
   */
  async obtenerSucursalParaBloqueo(conexion, sucursalId) {
    const [filas] = await conexion.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        nombre,
        direccion,
        cantidad_mesas AS cantidadMesas,
        activa
      FROM sucursales
      WHERE id = ?
      FOR UPDATE`,
      [sucursalId]
    );
    return filas[0] || null;
  },

  /**
   * Obtiene el siguiente número de orden consecutivo para una sucursal (RN-19).
   */
  async obtenerSiguienteNumeroOrden(conexion, sucursalId) {
    const [filas] = await conexion.query(
      `SELECT COALESCE(MAX(numero_orden), 0) + 1 AS siguiente
       FROM ordenes
       WHERE sucursal_id = ?`,
      [sucursalId]
    );
    return Number(filas[0]?.siguiente || 1);
  },

  /**
   * Inserta un nuevo pedido en la tabla ordenes.
   */
  async crearOrden(conexion, datos) {
    const {
      negocioId,
      sucursalId,
      numeroOrden,
      codigoSeguimiento,
      nombreCliente,
      tipoEntrega,
      numeroMesa,
      horaRecogida,
      metodoPago,
      estadoPago,
      estado,
      total
    } = datos;

    const [resultado] = await conexion.query(
      `INSERT INTO ordenes (
        negocio_id, sucursal_id, numero_orden, codigo_seguimiento,
        nombre_cliente, tipo_entrega, numero_mesa, hora_recogida,
        metodo_pago, estado_pago, estado, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        negocioId,
        sucursalId,
        numeroOrden,
        codigoSeguimiento,
        nombreCliente,
        tipoEntrega,
        numeroMesa,
        horaRecogida,
        metodoPago,
        estadoPago,
        estado,
        total
      ]
    );
    return resultado.insertId;
  },

  /**
   * Inserta una línea de pedido en la tabla detalles_orden (RN-16).
   */
  async crearDetalle(conexion, datos) {
    const {
      negocioId,
      ordenId,
      productoId,
      nombreProducto,
      cantidad,
      precioUnitario,
      notasPersonalizacion
    } = datos;

    const [resultado] = await conexion.query(
      `INSERT INTO detalles_orden (
        negocio_id, orden_id, producto_id, nombre_producto,
        cantidad, precio_unitario, notas_personalizacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        negocioId,
        ordenId,
        productoId,
        nombreProducto,
        cantidad,
        precioUnitario,
        notasPersonalizacion || null
      ]
    );
    return resultado.insertId;
  },

  /**
   * Inserta una opción elegida en la tabla detalle_orden_opciones (RN-16).
   */
  async crearDetalleOpcion(conexion, datos) {
    const {
      negocioId,
      detalleId,
      opcionId,
      nombreGrupo,
      nombreOpcion,
      precioExtra
    } = datos;

    const [resultado] = await conexion.query(
      `INSERT INTO detalle_orden_opciones (
        negocio_id, detalle_id, opcion_id, nombre_grupo,
        nombre_opcion, precio_extra
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        negocioId,
        detalleId,
        opcionId,
        nombreGrupo,
        nombreOpcion,
        precioExtra
      ]
    );
    return resultado.insertId;
  },

  /**
   * Obtiene un producto por su ID verificando negocio (RN-01, RN-14).
   */
  async obtenerProductoPorId(conexion, negocioId, productoId) {
    const [filas] = await conexion.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        categoria_id AS categoriaId,
        nombre_es AS nombreEs,
        nombre_en AS nombreEn,
        precio,
        disponible,
        activo
      FROM productos
      WHERE id = ? AND negocio_id = ?`,
      [productoId, negocioId]
    );
    return filas[0] || null;
  },

  /**
   * Obtiene los grupos de opciones asignados a un producto (RN-13).
   */
  async obtenerGruposDeProducto(conexion, negocioId, productoId) {
    const [filas] = await conexion.query(
      `SELECT
        g.id,
        g.nombre_es AS nombreEs,
        g.nombre_en AS nombreEn,
        g.tipo_seleccion AS tipoSeleccion,
        g.obligatorio,
        g.activo
      FROM grupos_opciones g
      INNER JOIN producto_grupos pg ON g.id = pg.grupo_id
      WHERE pg.producto_id = ? AND g.negocio_id = ? AND g.activo = TRUE
      ORDER BY pg.orden ASC`,
      [productoId, negocioId]
    );
    return filas;
  },

  /**
   * Obtiene opciones específicas por lista de IDs pertenecientes al negocio (RN-13, RN-16).
   */
  async obtenerOpcionesPorIds(conexion, negocioId, opcionesIds = []) {
    if (!opcionesIds.length) return [];
    const [filas] = await conexion.query(
      `SELECT
        o.id,
        o.grupo_id AS grupoId,
        g.nombre_es AS grupoNombreEs,
        g.nombre_en AS grupoNombreEn,
        g.tipo_seleccion AS tipoSeleccion,
        g.obligatorio,
        o.nombre_es AS nombreEs,
        o.nombre_en AS nombreEn,
        o.precio_extra AS precioExtra,
        o.activa
      FROM opciones o
      INNER JOIN grupos_opciones g ON o.grupo_id = g.id
      WHERE o.id IN (?) AND o.negocio_id = ? AND o.activa = TRUE AND g.activo = TRUE`,
      [opcionesIds, negocioId]
    );
    return filas;
  },

  /**
   * Busca un pedido completo por su código de seguimiento aleatorio (HU-12, RN-20).
   */
  async buscarPorCodigoSeguimiento(codigoSeguimiento) {
    const [filasOrden] = await pool.query(
      `SELECT
        o.id,
        o.negocio_id AS negocioId,
        n.nombre AS negocioNombre,
        o.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        s.direccion AS sucursalDireccion,
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
        o.creado_en AS creadoEn
      FROM ordenes o
      INNER JOIN negocios n ON o.negocio_id = n.id
      INNER JOIN sucursales s ON o.sucursal_id = s.id
      WHERE o.codigo_seguimiento = ?`,
      [codigoSeguimiento]
    );

    const orden = filasOrden[0];
    if (!orden) return null;

    // Obtener detalles del pedido
    const [filasDetalles] = await pool.query(
      `SELECT
        d.id,
        d.orden_id AS ordenId,
        d.producto_id AS productoId,
        d.nombre_producto AS nombreProducto,
        d.cantidad,
        d.precio_unitario AS precioUnitario,
        d.notas_personalizacion AS notasPersonalizacion,
        d.creado_en AS creadoEn
      FROM detalles_orden d
      WHERE d.orden_id = ?
      ORDER BY d.id ASC`,
      [orden.id]
    );

    if (filasDetalles.length === 0) {
      return { ...orden, detalles: [] };
    }

    const detalleIds = filasDetalles.map((d) => d.id);
    const [filasOpciones] = await pool.query(
      `SELECT
        op.id,
        op.detalle_id AS detalleId,
        op.opcion_id AS opcionId,
        op.nombre_grupo AS nombreGrupo,
        op.nombre_opcion AS nombreOpcion,
        op.precio_extra AS precioExtra
      FROM detalle_orden_opciones op
      WHERE op.detalle_id IN (?)
      ORDER BY op.id ASC`,
      [detalleIds]
    );

    // Mapear opciones a sus respectivos detalles
    const detallesConOpciones = filasDetalles.map((det) => {
      const opciones = filasOpciones.filter((op) => op.detalleId === det.id);
      return {
        ...det,
        precioUnitario: Number(det.precioUnitario),
        totalLinea: (
          (Number(det.precioUnitario) +
            opciones.reduce((acc, o) => acc + Number(o.precioExtra || 0), 0)) *
          det.cantidad
        ).toFixed(2),
        opciones: opciones.map((o) => ({
          ...o,
          precioExtra: Number(o.precioExtra)
        }))
      };
    });

    return {
      ...orden,
      total: Number(orden.total),
      detalles: detallesConOpciones
    };
  },

  /**
   * Búsqueda manual de pedido por número y nombre del cliente (HU-12, RN-20).
   */
  async buscarPorNumeroYNombre(negocioId, numeroOrden, nombreCliente) {
    const [filas] = await pool.query(
      `SELECT
        o.id,
        o.negocio_id AS negocioId,
        o.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        o.numero_orden AS numeroOrden,
        o.codigo_seguimiento AS codigoSeguimiento,
        o.nombre_cliente AS nombreCliente,
        o.tipo_entrega AS tipoEntrega,
        o.numero_mesa AS numeroMesa,
        o.estado,
        o.total,
        o.creado_en AS creadoEn
      FROM ordenes o
      INNER JOIN sucursales s ON o.sucursal_id = s.id
      WHERE o.negocio_id = ?
        AND o.numero_orden = ?
        AND LOWER(TRIM(o.nombre_cliente)) = LOWER(TRIM(?))
      LIMIT 1`,
      [negocioId, numeroOrden, nombreCliente]
    );
    return filas[0] || null;
  },

  /**
   * Obtiene todos los pedidos activos (RECIBIDO, PREPARACION, LISTO) de una sucursal (HU-13).
   * Ordenados cronológicamente del más antiguo al más nuevo (creado_en ASC).
   */
  async listarActivasPorSucursal(negocioId, sucursalId) {
    const [filasOrdenes] = await pool.query(
      `SELECT
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
        o.iniciado_en AS iniciadoEn,
        o.listo_en AS listoEn,
        o.entregado_en AS entregadoEn,
        o.creado_en AS creadoEn
      FROM ordenes o
      INNER JOIN sucursales s ON o.sucursal_id = s.id
      WHERE o.negocio_id = ?
        AND o.sucursal_id = ?
        AND o.estado IN ('RECIBIDO', 'PREPARACION', 'LISTO')
      ORDER BY o.creado_en ASC`,
      [negocioId, sucursalId]
    );

    if (filasOrdenes.length === 0) {
      return [];
    }

    const ordenIds = filasOrdenes.map((o) => o.id);

    // Obtener detalles de todos los pedidos activos
    const [filasDetalles] = await pool.query(
      `SELECT
        d.id,
        d.orden_id AS ordenId,
        d.producto_id AS productoId,
        d.nombre_producto AS nombreProducto,
        d.cantidad,
        d.precio_unitario AS precioUnitario,
        d.notas_personalizacion AS notasPersonalizacion
      FROM detalles_orden d
      WHERE d.orden_id IN (?)
      ORDER BY d.id ASC`,
      [ordenIds]
    );

    let filasOpciones = [];
    if (filasDetalles.length > 0) {
      const detalleIds = filasDetalles.map((d) => d.id);
      const [resOpciones] = await pool.query(
        `SELECT
          op.id,
          op.detalle_id AS detalleId,
          op.nombre_grupo AS nombreGrupo,
          op.nombre_opcion AS nombreOpcion,
          op.precio_extra AS precioExtra
        FROM detalle_orden_opciones op
        WHERE op.detalle_id IN (?)
        ORDER BY op.id ASC`,
        [detalleIds]
      );
      filasOpciones = resOpciones;
    }

    // Armar estructura anidada para el KDS
    return filasOrdenes.map((orden) => {
      const detallesDeOrden = filasDetalles
        .filter((d) => d.ordenId === orden.id)
        .map((det) => {
          const opciones = filasOpciones.filter((op) => op.detalleId === det.id);
          return {
            ...det,
            precioUnitario: Number(det.precioUnitario),
            opciones: opciones.map((op) => ({
              ...op,
              precioExtra: Number(op.precioExtra)
            }))
          };
        });

      return {
        ...orden,
        total: Number(orden.total),
        detalles: detallesDeOrden
      };
    });
  },

  /**
   * Bloquea la fila del pedido con FOR UPDATE dentro de una transacción para
   * validar y aplicar cambios de estado o pago de forma segura (RN-21, RN-23).
   */
  async obtenerOrdenPorIdParaActualizar(conexion, negocioId, ordenId) {
    const [filas] = await conexion.query(
      `SELECT
        id,
        negocio_id AS negocioId,
        sucursal_id AS sucursalId,
        numero_orden AS numeroOrden,
        codigo_seguimiento AS codigoSeguimiento,
        nombre_cliente AS nombreCliente,
        tipo_entrega AS tipoEntrega,
        numero_mesa AS numeroMesa,
        hora_recogida AS horaRecogida,
        metodo_pago AS metodoPago,
        estado_pago AS estadoPago,
        estado,
        total,
        motivo_cancelacion AS motivoCancelacion,
        iniciado_en AS iniciadoEn,
        listo_en AS listoEn,
        entregado_en AS entregadoEn,
        creado_en AS creadoEn
      FROM ordenes
      WHERE id = ? AND negocio_id = ?
      FOR UPDATE`,
      [ordenId, negocioId]
    );

    return filas[0] || null;
  },

  /**
   * Actualiza el estado y estampa la hora correspondiente en UTC (RN-21).
   */
  async actualizarEstadoOrden(conexion, ordenId, nuevoEstado, campoTimestamp = null) {
    if (campoTimestamp) {
      await conexion.query(
        `UPDATE ordenes
         SET estado = ?, ${campoTimestamp} = UTC_TIMESTAMP()
         WHERE id = ?`,
        [nuevoEstado, ordenId]
      );
    } else {
      await conexion.query(
        `UPDATE ordenes
         SET estado = ?
         WHERE id = ?`,
        [nuevoEstado, ordenId]
      );
    }
  },

  /**
   * Actualiza el estado de pago del pedido (RN-23).
   */
  async actualizarEstadoPagoOrden(conexion, ordenId, nuevoEstadoPago) {
    await conexion.query(
      `UPDATE ordenes
       SET estado_pago = ?
       WHERE id = ?`,
      [nuevoEstadoPago, ordenId]
    );
  },

  /**
   * Cancela un pedido guardando el motivo de cancelación (RN-22).
   */
  async cancelarOrden(conexion, ordenId, motivo) {
    await conexion.query(
      `UPDATE ordenes
       SET estado = 'CANCELADO', motivo_cancelacion = ?
       WHERE id = ?`,
      [motivo, ordenId]
    );
  },

  /**
   * Obtiene la información completa de una orden con su sucursal, negocio,
   * líneas y opciones (usada para generar el ticket al despachar, RN-24).
   */
  async obtenerOrdenCompletaPorId(conexion, negocioId, ordenId) {
    const [filas] = await conexion.query(
      `SELECT
        o.id,
        o.negocio_id AS negocioId,
        n.nombre AS negocioNombre,
        o.sucursal_id AS sucursalId,
        s.nombre AS sucursalNombre,
        s.direccion AS sucursalDireccion,
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
        o.creado_en AS creadoEn,
        o.iniciado_en AS iniciadoEn,
        o.listo_en AS listoEn,
        o.entregado_en AS entregadoEn
      FROM ordenes o
      INNER JOIN negocios n ON o.negocio_id = n.id
      INNER JOIN sucursales s ON o.sucursal_id = s.id
      WHERE o.id = ? AND o.negocio_id = ?`,
      [ordenId, negocioId]
    );

    const orden = filas[0];
    if (!orden) return null;

    const [detalles] = await conexion.query(
      `SELECT
        d.id,
        d.nombre_producto AS nombreProducto,
        d.cantidad,
        d.precio_unitario AS precioUnitario,
        d.notas_personalizacion AS notasPersonalizacion
      FROM detalles_orden d
      WHERE d.orden_id = ?
      ORDER BY d.id ASC`,
      [orden.id]
    );

    if (detalles.length === 0) {
      return { ...orden, total: Number(orden.total), detalles: [] };
    }

    const detalleIds = detalles.map((d) => d.id);
    const [opciones] = await conexion.query(
      `SELECT
        op.detalle_id AS detalleId,
        op.nombre_grupo AS nombreGrupo,
        op.nombre_opcion AS nombreOpcion,
        op.precio_extra AS precioExtra
      FROM detalle_orden_opciones op
      WHERE op.detalle_id IN (?)
      ORDER BY op.id ASC`,
      [detalleIds]
    );

    const detallesCompletos = detalles.map((d) => {
      const ops = opciones.filter((op) => op.detalleId === d.id);
      return {
        ...d,
        precioUnitario: Number(d.precioUnitario),
        opciones: ops.map((op) => ({
          ...op,
          precioExtra: Number(op.precioExtra)
        }))
      };
    });

    return {
      ...orden,
      total: Number(orden.total),
      detalles: detallesCompletos
    };
  }
};
