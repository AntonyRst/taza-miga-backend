import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { categoriaService } from '../services/categoriaService.js';
import { crearCategoriaSchema, editarCategoriaSchema } from '../schemas/categoriaSchema.js';

const router = Router();

// RN-03, RN-11: Solo gerente y dueño administran categorías
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/categorias
 * Lista categorías del negocio del usuario.
 */
router.get('/', async (req, res, next) => {
  try {
    const soloActivas = req.query.soloActivas === 'true';
    const categorias = await categoriaService.listar(req.usuario.negocio_id, soloActivas);
    res.status(200).json(categorias);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/categorias/:id
 * Obtiene una categoría por su ID (RN-01).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const categoria = await categoriaService.obtenerPorId(id, req.usuario.negocio_id);
    res.status(200).json(categoria);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/categorias
 * Crea una nueva categoría.
 */
router.post('/', async (req, res, next) => {
  try {
    const datosValidados = crearCategoriaSchema.parse(req.body);
    const nuevaCategoria = await categoriaService.crear(datosValidados, req.usuario.negocio_id);
    res.status(201).json(nuevaCategoria);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categorias/:id
 * Actualiza los datos de una categoría.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datosValidados = editarCategoriaSchema.parse(req.body);
    const actualizada = await categoriaService.actualizar(
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
 * PATCH /api/categorias/:id/activo
 * Activa o desactiva una categoría (RN-10).
 */
router.patch('/:id/activo', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const esquemaActivo = z.object({ activa: z.boolean() });
    const { activa } = esquemaActivo.parse(req.body);
    const actualizada = await categoriaService.cambiarEstadoActivo(
      id,
      req.usuario.negocio_id,
      activa,
      req.usuario.id
    );
    res.status(200).json(actualizada);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/categorias/:id
 * Elimina una categoría si no tiene dependencias (RN-10).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const resultado = await categoriaService.eliminar(id, req.usuario.negocio_id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
