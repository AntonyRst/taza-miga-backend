import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { sucursalService } from '../services/sucursalService.js';
import { usuarioService } from '../services/usuarioService.js';
import { crearUsuarioSchema } from '../schemas/usuarioSchema.js';

const router = Router();

// Todas las rutas de administración exigen autenticación y rol de GERENTE o DUENO (RN-03)
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/admin/prueba-acceso
 * Ruta de verificación de acceso a panel administrativo (RN-03, HU-02).
 */
router.get('/prueba-acceso', (req, res) => {
  res.status(200).json({
    mensaje: 'Acceso autorizado al panel de administración',
    usuario: req.usuario
  });
});

/**
 * GET /api/admin/sucursales/:id
 * Obtiene los detalles de una sucursal del negocio del token (RN-01).
 * Si la sucursal pertenece a otro negocio, responde 404.
 */
router.get('/sucursales/:id', async (req, res, next) => {
  try {
    const sucursalId = z.coerce.number().int().positive().parse(req.params.id);
    const sucursal = await sucursalService.obtenerPorId(sucursalId, req.usuario.negocio_id);

    res.status(200).json(sucursal);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/usuarios
 * Crea un nuevo usuario validando que el correo no esté duplicado en el sistema (RN-02).
 * Si el correo ya existe, responde 409.
 */
router.post('/usuarios', async (req, res, next) => {
  try {
    const datosValidados = crearUsuarioSchema.parse(req.body);
    const nuevoUsuario = await usuarioService.crearUsuario(
      datosValidados,
      req.usuario.negocio_id
    );

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    next(error);
  }
});

export default router;
