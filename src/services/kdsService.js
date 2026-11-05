import pool from '../db.js';
import { ordenRepository } from '../repositories/ordenRepository.js';
import { ticketRepository } from '../repositories/ticketRepository.js';
import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Centra un texto dentro de un ancho determinado para el ticket térmico monoespaciado.
 */
function centrarTexto(texto, ancho = 40) {
  if (texto.length >= ancho) return texto;
  const margen = Math.floor((ancho - texto.length) / 2);
  return ' '.repeat(margen) + texto;
}

/**
 * Genera el contenido del ticket en texto monoespaciado (HU-17, RN-24).
 * Incluye negocio, sucursal, número de pedido, fecha/hora, cliente, modalidad,
 * cada línea con opciones y precios originales congelados (RN-16), total y quién despachó.
 */
function generarTextoTicket(datos) {
  const separadorDoble = '='.repeat(40);
  const separadorSimple = '-'.repeat(40);
  const lineas = [];

  // Encabezado
  lineas.push(separadorDoble);
  lineas.push(centrarTexto(datos.negocioNombre.toUpperCase(), 40));
  lineas.push(centrarTexto(datos.sucursalNombre, 40));
  if (datos.sucursalDireccion) {
    lineas.push(centrarTexto(datos.sucursalDireccion, 40));
  }
  lineas.push(separadorDoble);

  // Metadatos del pedido
  lineas.push(`PEDIDO: #${datos.numeroOrden}`);
  lineas.push(`FECHA:  ${datos.fechaHora}`);
  lineas.push(`CLIENTE: ${datos.nombreCliente}`);

  const modalidad =
    datos.tipoEntrega === 'MESA'
      ? `MESA ${datos.numeroMesa}`
      : `PARA LLEVAR${datos.horaRecogida ? ` (${datos.horaRecogida})` : ''}`;
  lineas.push(`ENTREGA: ${modalidad}`);

  lineas.push(separadorSimple);
  lineas.push('CANT. DESCRIPCIÓN                 TOTAL');
  lineas.push(separadorSimple);

  // Líneas de producto y opciones congeladas (RN-16)
  for (const item of datos.detalles) {
    const precioBase = Number(item.precioUnitario);
    const extraOpciones = (item.opciones || []).reduce(
      (acc, op) => acc + Number(op.precioExtra || 0),
      0
    );
    const subtotalLinea = (precioBase + extraOpciones) * item.cantidad;

    const colCant = `${item.cantidad}x`.padEnd(5);
    const colTotal = `$${subtotalLinea.toFixed(2)}`.padStart(8);
    const nombreProd =
      item.nombreProducto.length > 27
        ? item.nombreProducto.slice(0, 24) + '...'
        : item.nombreProducto;
    lineas.push(`${colCant}${nombreProd.padEnd(27)}${colTotal}`);

    // Opciones personalizadas de la línea
    if (item.opciones && item.opciones.length > 0) {
      for (const op of item.opciones) {
        const extraStr =
          Number(op.precioExtra) > 0
            ? ` (+$${Number(op.precioExtra).toFixed(2)})`
            : '';
        lineas.push(`     + ${op.nombreOpcion}${extraStr}`);
      }
    }

    if (item.notasPersonalizacion) {
      lineas.push(`     Nota: ${item.notasPersonalizacion}`);
    }
  }

  // Totales y pago
  lineas.push(separadorSimple);
  const totalFormateado = `$${Number(datos.total).toFixed(2)}`.padStart(8);
  lineas.push(`TOTAL A PAGAR:              ${totalFormateado}`);
  lineas.push(`MÉTODO DE PAGO: ${datos.metodoPago} (PAGADO)`);
  lineas.push(`DESPACHADO POR: ${datos.despachadoPor}`);
  lineas.push(separadorDoble);
  lineas.push(centrarTexto('¡Gracias por tu preferencia!', 40));
  lineas.push(separadorDoble);

  return lineas.join('\n');
}

/**
 * Servicio de negocio para el panel KDS del barista, transiciones de estado,
 * cobros, cancelaciones y generación atómica de tickets (HU-13 a HU-17).
 */
export const kdsService = {
  /**
   * Lista los pedidos activos (RECIBIDO, PREPARACION, LISTO) de la sucursal (HU-13).
   * Solo el barista/gerente de la sucursal o el dueño pueden consultarlos (RN-03, RN-04).
   */
  async listarPedidosKds(usuario, sucursalIdQuery = null) {
    let sucursalId = usuario.sucursal_id;

    // El dueño puede elegir la sucursal o ver la primera activa
    if (usuario.rol === 'DUENO') {
      if (sucursalIdQuery) {
        sucursalId = Number(sucursalIdQuery);
      } else {
        const [sucursales] = await pool.query(
          'SELECT id FROM sucursales WHERE negocio_id = ? AND activa = TRUE LIMIT 1',
          [usuario.negocio_id]
        );
        if (sucursales.length === 0) {
          return { sucursalId: null, ordenes: [] };
        }
        sucursalId = sucursales[0].id;
      }
    }

    if (!sucursalId) {
      throw new ErrorApp('Usuario sin sucursal asignada', 400);
    }

    // Comprobar que la sucursal pertenece al negocio del usuario (RN-01)
    const [sucursalesValidas] = await pool.query(
      'SELECT id, nombre FROM sucursales WHERE id = ? AND negocio_id = ?',
      [sucursalId, usuario.negocio_id]
    );

    if (sucursalesValidas.length === 0) {
      throw new ErrorApp('Sucursal no encontrada', 404);
    }

    const ordenes = await ordenRepository.listarActivasPorSucursal(
      usuario.negocio_id,
      sucursalId
    );

    return {
      sucursalId,
      sucursalNombre: sucursalesValidas[0].nombre,
      ordenes
    };
  },

  /**
   * Avanza el estado de un pedido según la máquina de estados permitida (RN-21).
   * Si pasa a ENTREGADO:
   *  - Valida que esté PAGADO (RN-23).
   *  - Genera y guarda el ticket en la misma transacción atómica (RN-24).
   */
  async avanzarEstado(usuario, ordenId, nuevoEstado) {
    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      // Bloquear orden para validación segura
      const orden = await ordenRepository.obtenerOrdenPorIdParaActualizar(
        conexion,
        usuario.negocio_id,
        ordenId
      );

      if (!orden) {
        throw new ErrorApp('Pedido no encontrado', 404);
      }

      // Barista y gerente solo acceden a su sucursal (RN-04)
      if (usuario.rol !== 'DUENO' && orden.sucursalId !== usuario.sucursal_id) {
        throw new ErrorApp('Pedido no encontrado en tu sucursal', 404);
      }

      // Máquina de estados: validar transiciones (RN-21)
      if (orden.estado === 'ENTREGADO' || orden.estado === 'CANCELADO') {
        throw new ErrorApp(
          'El pedido ya se encuentra finalizado y no puede cambiar de estado',
          409
        );
      }

      let campoTimestamp = null;

      if (orden.estado === 'RECIBIDO') {
        if (nuevoEstado !== 'PREPARACION') {
          throw new ErrorApp(
            'Un pedido en estado RECIBIDO solo puede pasar a PREPARACION',
            409
          );
        }
        campoTimestamp = 'iniciado_en';
      } else if (orden.estado === 'PREPARACION') {
        if (nuevoEstado !== 'LISTO') {
          throw new ErrorApp(
            'Un pedido en estado PREPARACION solo puede pasar a LISTO',
            409
          );
        }
        campoTimestamp = 'listo_en';
      } else if (orden.estado === 'LISTO') {
        if (nuevoEstado !== 'ENTREGADO') {
          throw new ErrorApp(
            'Un pedido en estado LISTO solo puede pasar a ENTREGADO',
            409
          );
        }

        // RN-23: Un pedido no puede pasar a ENTREGADO si está SIN_PAGAR
        if (orden.estadoPago !== 'PAGADO') {
          throw new ErrorApp(
            'No se puede entregar un pedido que no ha sido pagado. Registra el pago primero.',
            409
          );
        }

        campoTimestamp = 'entregado_en';
      } else {
        throw new ErrorApp('Transición de estado no permitida', 409);
      }

      // Actualizar estado y timestamp
      await ordenRepository.actualizarEstadoOrden(
        conexion,
        orden.id,
        nuevoEstado,
        campoTimestamp
      );

      let ticketGenerado = null;

      // RN-24: Al pasar a ENTREGADO, generar y guardar el ticket en la misma transacción
      if (nuevoEstado === 'ENTREGADO') {
        const ordenCompleta = await ordenRepository.obtenerOrdenCompletaPorId(
          conexion,
          usuario.negocio_id,
          orden.id
        );

        const fechaFormateada = new Intl.DateTimeFormat('es-SV', {
          timeZone: 'America/El_Salvador',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(new Date());

        const contenidoTicket = generarTextoTicket({
          negocioNombre: ordenCompleta.negocioNombre,
          sucursalNombre: ordenCompleta.sucursalNombre,
          sucursalDireccion: ordenCompleta.sucursalDireccion,
          numeroOrden: ordenCompleta.numeroOrden,
          fechaHora: fechaFormateada,
          nombreCliente: ordenCompleta.nombreCliente,
          tipoEntrega: ordenCompleta.tipoEntrega,
          numeroMesa: ordenCompleta.numeroMesa,
          horaRecogida: ordenCompleta.horaRecogida,
          total: ordenCompleta.total,
          metodoPago: ordenCompleta.metodoPago,
          despachadoPor: usuario.nombre || 'Personal de Turno',
          detalles: ordenCompleta.detalles
        });

        const ticketId = await ticketRepository.crearTicket(conexion, {
          negocioId: usuario.negocio_id,
          ordenId: orden.id,
          contenido: contenidoTicket,
          generadoPor: usuario.id
        });

        ticketGenerado = {
          id: ticketId,
          ordenId: orden.id,
          contenido: contenidoTicket,
          reimpresiones: 0
        };
      }

      await conexion.commit();

      return {
        id: orden.id,
        numeroOrden: orden.numeroOrden,
        estadoAnterior: orden.estado,
        nuevoEstado,
        ticket: ticketGenerado
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  },

  /**
   * Registra el cobro en barra marcando el pedido como PAGADO (HU-15, RN-23).
   */
  async registrarPago(usuario, ordenId) {
    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      const orden = await ordenRepository.obtenerOrdenPorIdParaActualizar(
        conexion,
        usuario.negocio_id,
        ordenId
      );

      if (!orden) {
        throw new ErrorApp('Pedido no encontrado', 404);
      }

      // Barista y gerente solo acceden a su sucursal (RN-04)
      if (usuario.rol !== 'DUENO' && orden.sucursalId !== usuario.sucursal_id) {
        throw new ErrorApp('Pedido no encontrado en tu sucursal', 404);
      }

      // RN-23: Un pedido PAGADO no puede volver a SIN_PAGAR ni pagarse dos veces
      if (orden.estadoPago === 'PAGADO') {
        throw new ErrorApp('El pedido ya se encuentra pagado', 409);
      }

      if (orden.estado === 'CANCELADO') {
        throw new ErrorApp(
          'No se puede registrar el pago de un pedido cancelado',
          409
        );
      }

      await ordenRepository.actualizarEstadoPagoOrden(
        conexion,
        orden.id,
        'PAGADO'
      );

      await conexion.commit();

      return {
        id: orden.id,
        numeroOrden: orden.numeroOrden,
        estadoPago: 'PAGADO',
        mensaje: 'Pago registrado con éxito'
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  },

  /**
   * Cancela un pedido indicando el motivo obligatorio (HU-16, RN-22).
   * Solo se permite cancelar desde RECIBIDO o PREPARACION.
   * Deja registro en auditoria_logs (RN-27).
   */
  async cancelarPedido(usuario, ordenId, motivo) {
    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      const orden = await ordenRepository.obtenerOrdenPorIdParaActualizar(
        conexion,
        usuario.negocio_id,
        ordenId
      );

      if (!orden) {
        throw new ErrorApp('Pedido no encontrado', 404);
      }

      // Barista y gerente solo acceden a su sucursal (RN-04)
      if (usuario.rol !== 'DUENO' && orden.sucursalId !== usuario.sucursal_id) {
        throw new ErrorApp('Pedido no encontrado en tu sucursal', 404);
      }

      // RN-22: Solo se cancela un pedido RECIBIDO o PREPARACION; uno LISTO no
      if (orden.estado === 'LISTO') {
        throw new ErrorApp(
          'No se puede cancelar un pedido en estado LISTO',
          409
        );
      }

      if (orden.estado === 'ENTREGADO' || orden.estado === 'CANCELADO') {
        throw new ErrorApp(
          'El pedido ya se encuentra finalizado y no se puede cancelar',
          409
        );
      }

      if (orden.estado !== 'RECIBIDO' && orden.estado !== 'PREPARACION') {
        throw new ErrorApp(
          'No se puede cancelar el pedido en su estado actual',
          409
        );
      }

      // Actualizar orden a CANCELADO con su motivo
      await ordenRepository.cancelarOrden(conexion, orden.id, motivo);

      // RN-27: Registrar en auditoria_logs
      await auditoriaRepository.registrar(
        {
          negocioId: usuario.negocio_id,
          usuarioId: usuario.id,
          accion: 'CANCELAR_PEDIDO',
          descripcion: `Pedido #${orden.numeroOrden} cancelado por ${usuario.nombre || 'personal'}: ${motivo}`
        },
        conexion
      );

      await conexion.commit();

      return {
        id: orden.id,
        numeroOrden: orden.numeroOrden,
        estado: 'CANCELADO',
        motivoCancelacion: motivo,
        mensaje: 'Pedido cancelado con éxito'
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  },

  /**
   * Obtiene el ticket de una orden y suma 1 al contador de reimpresiones (HU-17, RN-24).
   */
  async obtenerYReimprimirTicket(usuario, ordenId) {
    const ticket = await ticketRepository.obtenerPorOrdenId(
      usuario.negocio_id,
      ordenId
    );

    if (!ticket) {
      throw new ErrorApp('Ticket no encontrado para este pedido', 404);
    }

    // RN-24: Reimprimir solo suma 1 a reimpresiones
    await ticketRepository.incrementarReimpresiones(ticket.id);

    return {
      ...ticket,
      reimpresiones: ticket.reimpresiones + 1
    };
  },

  /**
   * Consulta el ticket sin sumar reimpresión.
   */
  async obtenerTicket(usuario, ordenId) {
    const ticket = await ticketRepository.obtenerPorOrdenId(
      usuario.negocio_id,
      ordenId
    );

    if (!ticket) {
      throw new ErrorApp('Ticket no encontrado para este pedido', 404);
    }

    return ticket;
  }
};
