import { Router } from 'express';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { kdsService } from '../services/kdsService.js';
import {
  cambiarEstadoSchema,
  cancelarOrdenSchema
} from '../schemas/ordenSchema.js';

const router = Router();

// Todas las rutas de KDS requieren autenticación y rol de barista, gerente o dueño
router.use(verificarToken);
router.use(permitirRoles('BARISTA', 'GERENTE', 'DUENO'));

/**
 * GET /api/kds/pedidos
 * Lista los pedidos activos de la sucursal para la pantalla del barista (HU-13).
 */
router.get('/pedidos', async (req, res, next) => {
  try {
    const resultado = await kdsService.listarPedidosKds(
      req.usuario,
      req.query.sucursalId
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/kds/pedidos/:id/estado
 * Avanza el estado del pedido: RECIBIDO -> PREPARACION -> LISTO -> ENTREGADO (HU-14, RN-21).
 * Si pasa a ENTREGADO genera el ticket de forma atómica (RN-24).
 */
router.patch('/pedidos/:id/estado', async (req, res, next) => {
  try {
    const { estado } = cambiarEstadoSchema.parse(req.body);
    const resultado = await kdsService.avanzarEstado(
      req.usuario,
      req.params.id,
      estado
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/kds/pedidos/:id/pago
 * Registra el pago en barra pasando el estado_pago a PAGADO (HU-15, RN-23).
 */
router.patch('/pedidos/:id/pago', async (req, res, next) => {
  try {
    const resultado = await kdsService.registrarPago(
      req.usuario,
      req.params.id
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kds/pedidos/:id/cancelar
 * Cancela un pedido en RECIBIDO o PREPARACION con motivo obligatorio (HU-16, RN-22).
 */
router.post('/pedidos/:id/cancelar', async (req, res, next) => {
  try {
    const { motivo } = cancelarOrdenSchema.parse(req.body);
    const resultado = await kdsService.cancelarPedido(
      req.usuario,
      req.params.id,
      motivo
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kds/pedidos/:id/ticket
 * Consulta el ticket generado de un pedido despachado (HU-17).
 */
router.get('/pedidos/:id/ticket', async (req, res, next) => {
  try {
    const ticket = await kdsService.obtenerTicket(
      req.usuario,
      req.params.id
    );
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kds/pedidos/:id/ticket/reimprimir
 * Consulta el ticket y suma 1 al contador de reimpresiones (HU-17, RN-24).
 */
router.post('/pedidos/:id/ticket/reimprimir', async (req, res, next) => {
  try {
    const resultado = await kdsService.obtenerYReimprimirTicket(
      req.usuario,
      req.params.id
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
