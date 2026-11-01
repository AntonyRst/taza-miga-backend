import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { grupoOpcionesService } from '../services/grupoOpcionesService.js';
import { opcionService } from '../services/opcionService.js';
import { crearGrupoSchema, editarGrupoSchema } from '../schemas/grupoOpcionesSchema.js';
import { crearOpcionSchema } from '../schemas/opcionSchema.js';

const router = Router();

// RN-03, RN-11: Solo gerente y dueño administran grupos de opciones
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/grupos-opciones
 * Lista todos los grupos con sus opciones.
 */
router.get('/', async (req, res, next) => {
  try {
    const soloActivos = req.query.soloActivos === 'true';
    const grupos = await grupoOpcionesService.listar(req.usuario.negocio_id, soloActivos);
    res.status(200).json(grupos);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/grupos-opciones/:id
 * Obtiene un grupo de opciones por ID (RN-01).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const grupo = await grupoOpcionesService.obtenerPorId(id, req.usuario.negocio_id);
    res.status(200).json(grupo);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grupos-opciones
 * Crea un nuevo grupo de opciones (HU-10).
 */
router.post('/', async (req, res, next) => {
  try {
    const datosValidados = crearGrupoSchema.parse(req.body);
    const nuevoGrupo = await grupoOpcionesService.crear(datosValidados, req.usuario.negocio_id);
    res.status(201).json(nuevoGrupo);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/grupos-opciones/:id
 * Actualiza un grupo de opciones.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datosValidados = editarGrupoSchema.parse(req.body);
    const actualizado = await grupoOpcionesService.actualizar(
      id,
      req.usuario.negocio_id,
      datosValidados,
      req.usuario.id
    );
    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/grupos-opciones/:id/activo
 * Activa o desactiva un grupo de opciones (RN-10).
 */
router.patch('/:id/activo', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const esquemaActivo = z.object({ activo: z.boolean() });
    const { activo } = esquemaActivo.parse(req.body);
    const actualizado = await grupoOpcionesService.actualizar(
      id,
      req.usuario.negocio_id,
      { activo },
      req.usuario.id
    );
    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/grupos-opciones/:id
 * Elimina un grupo de opciones (RN-10).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const resultado = await grupoOpcionesService.eliminar(id, req.usuario.negocio_id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/grupos-opciones/:id/opciones
 * Agrega una opción al grupo (HU-10, RN-12).
 */
router.post('/:id/opciones', async (req, res, next) => {
  try {
    const grupoId = z.coerce.number().int().positive().parse(req.params.id);
    const datosValidados = crearOpcionSchema.parse({
      ...req.body,
      grupo_id: grupoId
    });
    const nuevaOpcion = await opcionService.crear(datosValidados, req.usuario.negocio_id);
    res.status(201).json(nuevaOpcion);
  } catch (error) {
    next(error);
  }
});

export default router;
