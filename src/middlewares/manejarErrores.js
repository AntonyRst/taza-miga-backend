import { ErrorApp } from '../ErrorApp.js';
import { ZodError } from 'zod';

/**
 * Middleware centralizado de manejo de errores de Express.
 */
export function manejarErrores(err, req, res, next) {
  // Errores controlados de la aplicación
  if (err instanceof ErrorApp) {
    return res.status(err.codigoHttp).json({
      error: err.message,
      mensaje: err.message,
      detalles: err.detalles || null
    });
  }

  // Errores de validación de esquemas Zod
  if (err instanceof ZodError) {
    const mensajes = err.issues ? err.issues.map(e => e.message) : err.errors?.map(e => e.message);
    const primerMensaje = mensajes && mensajes.length > 0 ? mensajes[0] : 'Datos inválidos';
    return res.status(400).json({
      error: primerMensaje,
      mensaje: primerMensaje,
      detalles: mensajes
    });
  }

  // Errores de sintaxis JSON en el cuerpo de la petición
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Formato JSON inválido',
      mensaje: 'Formato JSON inválido'
    });
  }

  // Errores de base de datos MySQL/MariaDB
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'El registro ya existe o viola una restricción de unicidad',
      mensaje: 'El registro ya existe o viola una restricción de unicidad'
    });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: 'El registro tiene historial y no se puede eliminar; desactívalo',
      mensaje: 'El registro tiene historial y no se puede eliminar; desactívalo'
    });
  }

  // Error inesperado del servidor
  console.error('[Error interno no controlado]:', err);
  return res.status(500).json({
    error: 'Error interno del servidor',
    mensaje: 'Error interno del servidor'
  });
}
