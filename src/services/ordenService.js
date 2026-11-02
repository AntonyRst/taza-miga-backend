import crypto from 'crypto';
import pool from '../db.js';
import { ordenRepository } from '../repositories/ordenRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Servicio de negocio para la gestión de pedidos y seguimiento (HU-11, HU-12).
 * Aplica las reglas RN-13, RN-14, RN-15, RN-16, RN-17, RN-18, RN-19, RN-20, RN-23, RN-28, RN-29.
 */
export const ordenService = {
  /**
   * Crea un nuevo pedido recalculando el total en el servidor de forma segura (RN-15).
   * Asigna número consecutivo por sucursal mediante bloqueo transaccional (RN-19).
   */
  async crearPedido(slug, datosPedido) {
    // 1. Obtener el negocio a partir del slug (RN-01)
    const [negocios] = await pool.query(
      'SELECT id, nombre, slug FROM negocios WHERE slug = ?',
      [slug]
    );
    const negocio = negocios[0];
    if (!negocio) {
      throw new ErrorApp('Negocio no encontrado', 404);
    }

    const conexion = await pool.getConnection();

    try {
      await conexion.beginTransaction();

      // 2. Bloquear la sucursal para serializar la asignación del consecutivo (RN-19)
      const sucursal = await ordenRepository.obtenerSucursalParaBloqueo(
        conexion,
        datosPedido.sucursalId
      );

      if (!sucursal || sucursal.negocioId !== negocio.id) {
        throw new ErrorApp('Sucursal no encontrada', 404);
      }

      // RN-18: Sucursal activa
      if (!sucursal.activa) {
        throw new ErrorApp('La sucursal seleccionada no está activa', 400);
      }

      // 3. RN-17: Validar modalidad de entrega
      let numeroMesaFinal = null;
      let horaRecogidaFinal = null;

      if (datosPedido.tipoEntrega === 'MESA') {
        if (!datosPedido.numeroMesa) {
          throw new ErrorApp('El número de mesa es obligatorio para pedidos en mesa', 400);
        }
        const mesa = Number(datosPedido.numeroMesa);
        if (mesa < 1 || mesa > sucursal.cantidadMesas) {
          throw new ErrorApp(
            `El número de mesa debe estar entre 1 y ${sucursal.cantidadMesas}`,
            400
          );
        }
        numeroMesaFinal = mesa;
      } else if (datosPedido.tipoEntrega === 'LLEVAR') {
        numeroMesaFinal = null;

        if (datosPedido.horaRecogida) {
          const fechaRecogida = new Date(datosPedido.horaRecogida);
          const ahora = new Date();

          if (isNaN(fechaRecogida.getTime())) {
            throw new ErrorApp('La hora de recogida no es válida', 400);
          }

          if (fechaRecogida <= ahora) {
            throw new ErrorApp('La hora de recogida debe ser posterior a la hora actual', 400);
          }

          // Verificar que sea del mismo día (zona America/El_Salvador)
          const formatoDia = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });

          if (formatoDia.format(fechaRecogida) !== formatoDia.format(ahora)) {
            throw new ErrorApp('La hora de recogida debe ser del mismo día', 400);
          }

          // Formato MySQL DATETIME en UTC
          horaRecogidaFinal = fechaRecogida.toISOString().slice(0, 19).replace('T', ' ');
        }
      }

      // 4. RN-18: Validar líneas del pedido
      const lineas = datosPedido.lineas;
      if (!lineas || !Array.isArray(lineas) || lineas.length === 0) {
        throw new ErrorApp('El pedido debe tener al menos una línea', 400);
      }

      let totalCentavos = 0;
      const lineasProcesadas = [];

      // 5. Validar cada línea, productos y opciones (RN-13, RN-14, RN-15, RN-16, RN-28, RN-29)
      for (const linea of lineas) {
        const cantidad = Number(linea.cantidad);
        if (!cantidad || cantidad < 1 || cantidad > 20) {
          throw new ErrorApp('La cantidad por producto debe ser de 1 a 20', 400);
        }

        const producto = await ordenRepository.obtenerProductoPorId(
          conexion,
          negocio.id,
          linea.productoId
        );

        if (!producto) {
          throw new ErrorApp(`Producto ${linea.productoId} no encontrado`, 404);
        }

        // RN-14: Producto inactivo o no disponible no se puede pedir -> 409
        if (!producto.activo || !producto.disponible) {
          throw new ErrorApp(
            `El producto "${producto.nombreEs}" ya no está disponible`,
            409
          );
        }

        // Obtener grupos asignados al producto
        const gruposProducto = await ordenRepository.obtenerGruposDeProducto(
          conexion,
          negocio.id,
          producto.id
        );
        const grupoIdsValidos = new Set(gruposProducto.map((g) => g.id));

        // Obtener opciones seleccionadas
        const opcionesIds = linea.opcionesIds || [];
        let opciones = [];
        if (opcionesIds.length > 0) {
          opciones = await ordenRepository.obtenerOpcionesPorIds(
            conexion,
            negocio.id,
            opcionesIds
          );

          if (opciones.length !== opcionesIds.length) {
            throw new ErrorApp('Una o más opciones seleccionadas no están disponibles', 400);
          }
        }

        // RN-13: Verificar que toda opción pertenezca a un grupo asignado al producto
        for (const op of opciones) {
          if (!grupoIdsValidos.has(op.grupoId)) {
            throw new ErrorApp(
              `La opción "${op.nombreEs}" no corresponde a las opciones permitidas de este producto`,
              400
            );
          }
        }

        // RN-13: Agrupar opciones por grupo y validar obligatoriedad y selección única
        const opcionesPorGrupo = new Map();
        for (const op of opciones) {
          const lista = opcionesPorGrupo.get(op.grupoId) || [];
          lista.push(op);
          opcionesPorGrupo.set(op.grupoId, lista);
        }

        for (const grupo of gruposProducto) {
          const elegidas = opcionesPorGrupo.get(grupo.id) || [];

          if (grupo.obligatorio && elegidas.length === 0) {
            throw new ErrorApp(
              `El grupo de opción "${grupo.nombreEs}" es obligatorio para "${producto.nombreEs}"`,
              400
            );
          }

          if (grupo.tipoSeleccion === 'UNICA' && elegidas.length > 1) {
            throw new ErrorApp(
              `El grupo "${grupo.nombreEs}" solo permite seleccionar una opción`,
              400
            );
          }
        }

        // RN-15, RN-16, RN-28: Cálculo en centavos
        const precioBaseCentavos = Math.round(Number(producto.precio) * 100);
        const extrasCentavos = opciones.reduce(
          (acc, o) => acc + Math.round(Number(o.precioExtra) * 100),
          0
        );
        const precioUnitarioCentavos = precioBaseCentavos;
        const subtotalLineaCentavos = (precioBaseCentavos + extrasCentavos) * cantidad;

        totalCentavos += subtotalLineaCentavos;

        lineasProcesadas.push({
          productoId: producto.id,
          nombreProducto: producto.nombreEs, // RN-16: copia de nombre
          cantidad,
          precioUnitario: (precioUnitarioCentavos / 100).toFixed(2), // RN-16: copia de precio base
          notasPersonalizacion: (linea.notasPersonalizacion || '').slice(0, 255),
          opciones: opciones.map((o) => ({
            opcionId: o.id,
            nombreGrupo: o.grupoNombreEs, // RN-16: copia
            nombreOpcion: o.nombreEs,     // RN-16: copia
            precioExtra: Number(o.precioExtra).toFixed(2)
          }))
        });
      }

      // 6. RN-19: Obtener número consecutivo por sucursal dentro del bloqueo transaccional
      const siguienteNumeroOrden = await ordenRepository.obtenerSiguienteNumeroOrden(
        conexion,
        sucursal.id
      );

      // Código de seguimiento no adivinable (crypto.randomUUID)
      const codigoSeguimiento = crypto.randomUUID();

      // RN-23: Estado de pago según método
      const metodoPago = datosPedido.metodoPago;
      const estadoPago = metodoPago === 'TARJETA_DEMO' ? 'PAGADO' : 'SIN_PAGAR';
      const totalFinal = (totalCentavos / 100).toFixed(2);

      // 7. Insertar orden principal
      const ordenId = await ordenRepository.crearOrden(conexion, {
        negocioId: negocio.id,
        sucursalId: sucursal.id,
        numeroOrden: siguienteNumeroOrden,
        codigoSeguimiento,
        nombreCliente: datosPedido.nombreCliente.trim(),
        tipoEntrega: datosPedido.tipoEntrega,
        numeroMesa: numeroMesaFinal,
        horaRecogida: horaRecogidaFinal,
        metodoPago,
        estadoPago,
        estado: 'RECIBIDO',
        total: totalFinal
      });

      // 8. Insertar detalles y opciones seleccionadas (RN-16)
      for (const lin of lineasProcesadas) {
        const detalleId = await ordenRepository.crearDetalle(conexion, {
          negocioId: negocio.id,
          ordenId,
          productoId: lin.productoId,
          nombreProducto: lin.nombreProducto,
          cantidad: lin.cantidad,
          precioUnitario: lin.precioUnitario,
          notasPersonalizacion: lin.notasPersonalizacion
        });

        for (const op of lin.opciones) {
          await ordenRepository.crearDetalleOpcion(conexion, {
            negocioId: negocio.id,
            detalleId,
            opcionId: op.opcionId,
            nombreGrupo: op.nombreGrupo,
            nombreOpcion: op.nombreOpcion,
            precioExtra: op.precioExtra
          });
        }
      }

      await conexion.commit();

      return {
        id: ordenId,
        numeroOrden: siguienteNumeroOrden,
        codigoSeguimiento,
        nombreCliente: datosPedido.nombreCliente.trim(),
        tipoEntrega: datosPedido.tipoEntrega,
        numeroMesa: numeroMesaFinal,
        horaRecogida: horaRecogidaFinal,
        metodoPago,
        estadoPago,
        estado: 'RECIBIDO',
        total: Number(totalFinal),
        sucursal: {
          id: sucursal.id,
          nombre: sucursal.nombre,
          direccion: sucursal.direccion
        }
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  },

  /**
   * Obtiene la información completa de seguimiento de un pedido por su código único (HU-12, RN-20).
   */
  async obtenerSeguimiento(codigoSeguimiento) {
    if (!codigoSeguimiento || typeof codigoSeguimiento !== 'string') {
      throw new ErrorApp('Código de seguimiento inválido', 400);
    }

    const orden = await ordenRepository.buscarPorCodigoSeguimiento(codigoSeguimiento);
    if (!orden) {
      throw new ErrorApp('No encontramos ese pedido', 404); // RN-20
    }

    return orden;
  },

  /**
   * Búsqueda manual de pedido por número y nombre (HU-12, RN-20).
   * Si no coinciden exactamente, responde 404 con mensaje idéntico sin pistas.
   */
  async buscarOrdenPerdida(slug, { numeroOrden, nombreCliente }) {
    const [negocios] = await pool.query(
      'SELECT id FROM negocios WHERE slug = ?',
      [slug]
    );
    const negocio = negocios[0];
    if (!negocio) {
      throw new ErrorApp('Negocio no encontrado', 404);
    }

    const orden = await ordenRepository.buscarPorNumeroYNombre(
      negocio.id,
      numeroOrden,
      nombreCliente
    );

    // RN-20: Si no coinciden ambos, responder "No encontramos ese pedido" sin pistas
    if (!orden) {
      throw new ErrorApp('No encontramos ese pedido', 404);
    }

    return {
      codigoSeguimiento: orden.codigoSeguimiento,
      numeroOrden: orden.numeroOrden,
      nombreCliente: orden.nombreCliente,
      estado: orden.estado
    };
  }
};
