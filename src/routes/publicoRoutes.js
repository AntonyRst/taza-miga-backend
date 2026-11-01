import { Router } from 'express';
import { z } from 'zod';
import { catalogoPublicoService } from '../services/catalogoPublicoService.js';

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

export default router;
