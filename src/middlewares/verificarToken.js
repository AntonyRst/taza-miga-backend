import jwt from 'jsonwebtoken';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Middleware para verificar la validez del token JWT.
 * Asigna los datos del usuario extraídos a req.usuario.
 * Valida RN-03 y RN-09.
 */
export function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ErrorApp('Acceso no autorizado: token no proporcionado', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const secreto = process.env.JWT_SECRET || 'secreto_desarrollo_inseguro';
    const decodificado = jwt.verify(token, secreto);

    // Asignar los datos del usuario al objeto de la petición (RN-03)
    req.usuario = {
      id: decodificado.id,
      rol: decodificado.rol,
      negocio_id: decodificado.negocio_id,
      sucursal_id: decodificado.sucursal_id,
      debe_cambiar_password: Boolean(decodificado.debe_cambiar_password)
    };

    // RN-09: Si tiene contraseña temporal, solo puede acceder a la ruta de cambiar contraseña
    if (req.usuario.debe_cambiar_password) {
      const rutaPermitida = req.baseUrl + req.path;
      if (!rutaPermitida.includes('/cambiar-password')) {
        return next(new ErrorApp('Debes cambiar tu contraseña temporal antes de acceder a otras funciones', 403));
      }
    }

    next();
  } catch (error) {
    return next(new ErrorApp('Token inválido o expirado', 401));
  }
}
