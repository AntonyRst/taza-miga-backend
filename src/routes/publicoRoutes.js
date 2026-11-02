import { Router } from 'express';
import { z } from 'zod';
import { catalogoPublicoService } from '../services/catalogoPublicoService.js';
import { ordenService } from '../services/ordenService.js';
import { crearOrdenSchema, buscarOrdenSchema } from '../schemas/ordenSchema.js';

const router = Router();

/**
 * GET /api/publico/:slug/menu
 * Devuelve el menú y catálogo completo del negocio para clientes sin cuenta (HU-05, HU-06).
 */
router.get('/:slug/menu', async (req, res, next) => {
  try {
    const slug = z.string().trim().min(1).parse(req.params.slug);
    const menu = await catalogoPublicoService.obtenerMenu(slug);
    res.status(200).json(menu);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/publico/:slug/sucursales
 * Devuelve las sucursales activas del negocio para selección de pedidos.
 */
router.get('/:slug/sucursales', async (req, res, next) => {
  try {
    const slug = z.string().trim().min(1).parse(req.params.slug);
    const sucursales = await catalogoPublicoService.obtenerSucursales(slug);
    res.status(200).json(sucursales);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/publico/:slug/ordenes
 * Crea un nuevo pedido recalculando el total en el servidor de forma segura (HU-11, RN-15, RN-19).
 */
router.post('/:slug/ordenes', async (req, res, next) => {
  try {
    const slug = z.string().trim().min(1).parse(req.params.slug);
    const datosValidados = crearOrdenSchema.parse(req.body);
    const orden = await ordenService.crearPedido(slug, datosValidados);
    res.status(201).json(orden);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/publico/ordenes/seguimiento/:codigo
 * Consulta en vivo el estado y detalle de un pedido por su código de seguimiento (HU-12, RN-20).
 */
router.get('/ordenes/seguimiento/:codigo', async (req, res, next) => {
  try {
    const codigo = z.string().trim().min(1, 'Código requerido').parse(req.params.codigo);
    const orden = await ordenService.obtenerSeguimiento(codigo);
    res.status(200).json(orden);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/publico/:slug/ordenes/buscar
 * Búsqueda manual de pedido perdido por número de pedido y nombre de cliente (HU-12, RN-20).
 */
router.post('/:slug/ordenes/buscar', async (req, res, next) => {
  try {
    const slug = z.string().trim().min(1).parse(req.params.slug);
    const datos = buscarOrdenSchema.parse(req.body);
    const resultado = await ordenService.buscarOrdenPerdida(slug, datos);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
