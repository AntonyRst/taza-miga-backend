import { ErrorApp } from '../ErrorApp.js';

/**
 * Middleware para restringir acceso a rutas según el rol del usuario (RN-03).
 * @param  {...string} rolesPermitidos Lista de roles autorizados (ej. 'DUENO', 'GERENTE', 'BARISTA')
 */
export function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(new ErrorApp('Acceso no autorizado: sesión no iniciada', 401));
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ErrorApp('No tienes permisos para acceder a este recurso', 403));
    }

    next();
  };
}
