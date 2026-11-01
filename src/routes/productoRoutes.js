import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { productoService } from '../services/productoService.js';
import { crearProductoSchema, editarProductoSchema } from '../schemas/productoSchema.js';

const router = Router();

// RN-03, RN-11: Solo gerente y dueño administran productos
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/productos
 * Lista productos con filtros opcionales.
 */
router.get('/', async (req, res, next) => {
  try {
    const filtros = {
      categoriaId: req.query.categoria_id ? Number(req.query.categoria_id) : undefined,
      disponible: req.query.disponible !== undefined ? req.query.disponible === 'true' : undefined,
      soloActivos: req.query.soloActivos === 'true',
      busqueda: req.query.q ? String(req.query.q).trim() : undefined
    };

    const productos = await productoService.listar(req.usuario.negocio_id, filtros);
    res.status(200).json(productos);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/productos/:id
 * Obtiene un producto por ID (RN-01).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const producto = await productoService.obtenerPorId(id, req.usuario.negocio_id);
    res.status(200).json(producto);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/productos
 * Crea un nuevo producto (HU-09, RN-12).
 */
router.post('/', async (req, res, next) => {
  try {
    const datosValidados = crearProductoSchema.parse(req.body);
    const nuevoProducto = await productoService.crear(datosValidados, req.usuario.negocio_id);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/productos/:id
 * Actualiza los datos de un producto (HU-09, RN-12, RN-27).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datosValidados = editarProductoSchema.parse(req.body);
    const actualizado = await productoService.actualizar(
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
 * PATCH /api/productos/:id/disponible
 * Marca el producto como disponible o agotado por hoy (HU-09).
 */
router.patch('/:id/disponible', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const esquema = z.object({ disponible: z.boolean() });
    const { disponible } = esquema.parse(req.body);
    const actualizado = await productoService.cambiarDisponibilidad(
      id,
      req.usuario.negocio_id,
      disponible
    );
    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/productos/:id/activo
 * Activa o retira un producto del menú (RN-10, RN-27).
 */
router.patch('/:id/activo', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const esquema = z.object({ activo: z.boolean() });
    const { activo } = esquema.parse(req.body);
    const actualizado = await productoService.actualizar(
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
 * DELETE /api/productos/:id
 * Elimina un producto si no tiene pedidos históricos (RN-10).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const resultado = await productoService.eliminar(id, req.usuario.negocio_id);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
