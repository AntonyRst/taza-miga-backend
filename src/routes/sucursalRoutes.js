import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { sucursalService } from '../services/sucursalService.js';
import { sucursalSchema } from '../schemas/sucursalSchema.js';

const router = Router();

// Rutas administrativas de sucursales: exigen token y rol GERENTE o DUENO (RN-03)
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/sucursales
 * Lista todas las sucursales del negocio (HU-20).
 */
router.get('/', async (req, res, next) => {
  try {
    const sucursales = await sucursalService.listarTodas(req.usuario);
    res.json(sucursales);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sucursales/:id
 * Consulta los datos de una sucursal del negocio (RN-01).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const sucursalId = z.coerce.number().int().positive().parse(req.params.id);
    const sucursal = await sucursalService.obtenerPorId(sucursalId, req.usuario.negocio_id);
    res.status(200).json(sucursal);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sucursales/:id/mesas-qr
 * Genera la lista de mesas con sus URLs y firmas HMAC para códigos QR imprimibles.
 */
router.get('/:id/mesas-qr', async (req, res, next) => {
  try {
    const sucursalId = z.coerce.number().int().positive().parse(req.params.id);
    const mesas = await sucursalService.generarMesasQr(req.usuario, sucursalId);
    res.status(200).json(mesas);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sucursales
 * Registra una nueva sucursal con coordenadas GPS o dirección manual (HU-20, RN-05, RN-25).
 */
router.post('/', async (req, res, next) => {
  try {
    const datos = sucursalSchema.parse(req.body);
    const creada = await sucursalService.crearSucursal(req.usuario, datos);
    res.status(201).json(creada);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/sucursales/:id
 * Modifica los datos de una sucursal existente (HU-20, RN-05, RN-25).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datos = sucursalSchema.parse(req.body);
    const actualizada = await sucursalService.editarSucursal(req.usuario, id, datos);
    res.json(actualizada);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/sucursales/:id/activa
 * Activa o desactiva una sucursal validando personal asignado (RN-05, RN-25).
 */
router.patch('/:id/activa', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { activa } = z.object({ activa: z.boolean() }).parse(req.body);
    const resultado = await sucursalService.actualizarActiva(req.usuario, id, activa);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
