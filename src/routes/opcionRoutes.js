import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { opcionService } from '../services/opcionService.js';
import { editarOpcionSchema } from '../schemas/opcionSchema.js';

const router = Router();

// RN-03, RN-11: Solo gerente y dueño administran opciones
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/opciones/:id
 * Obtiene una opción por ID (RN-01).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const opcion = await opcionService.obtenerPorId(id, req.usuario.negocio_id);
    res.status(200).json(opcion);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/opciones/:id
 * Modifica una opción (RN-12).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datosValidados = editarOpcionSchema.parse(req.body);
    const actualizada = await opcionService.actualizar(
      id,
      req.usuario.negocio_id,
      datosValidados,
      req.usuario.id
    );
    res.status(200).json(actualizada);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/opciones/:id/activo
 * Activa o desactiva una opción (RN-10).
 */
router.patch('/:id/activo', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const esquemaActivo = z.object({ activa: z.boolean() });
    const { activa } = esquemaActivo.parse(req.body);
    const actualizada = await opcionService.actualizar(
      id,
      req.usuario.negocio_id,
      { activa },
      req.usuario.id
    );
    res.status(200).json(actualizada);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/opciones/:id
 * Elimina una opción si no tiene pedidos históricos (RN-10).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const resultado = await opcionService.eliminar(id, req.usuario.negocio_id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
