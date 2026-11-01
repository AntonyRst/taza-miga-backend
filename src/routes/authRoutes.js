import { Router } from 'express';
import { loginSchema, cambiarPasswordSchema } from '../schemas/authSchema.js';
import { authService } from '../services/authService.js';
import { verificarToken } from '../middlewares/verificarToken.js';

const router = Router();

/**
 * POST /api/auth/login
 * Inicia sesión para el personal de la cafetería.
 */
router.post('/login', async (req, res, next) => {
  try {
    const datosValidados = loginSchema.parse(req.body);
    const resultado = await authService.iniciarSesion(
      datosValidados.correo,
      datosValidados.password
    );

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/perfil
 * Devuelve los datos del usuario autenticado actual (RN-03).
 */
router.get('/perfil', verificarToken, async (req, res, next) => {
  try {
    const perfil = await authService.obtenerPerfil(req.usuario.id);
    res.status(200).json(perfil);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/cambiar-password
 * Permite al usuario cambiar su contraseña actual (HU-03, RN-07, RN-09).
 */
router.put('/cambiar-password', verificarToken, async (req, res, next) => {
  try {
    const datosValidados = cambiarPasswordSchema.parse(req.body);
    const resultado = await authService.cambiarPassword(
      req.usuario.id,
      datosValidados.passwordActual,
      datosValidados.passwordNueva
    );

    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
