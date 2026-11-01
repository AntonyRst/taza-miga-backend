/**
 * Clase personalizada para errores de la aplicación con código HTTP.
 */
export class ErrorApp extends Error {
  /**
   * @param {string} mensaje Mensaje explicativo del error
   * @param {number} codigoHttp Código de estado HTTP (400, 401, 403, 404, 409, 500)
   * @param {any} [detalles=null] Detalles adicionales (por ejemplo, errores de validación)
   */
  constructor(mensaje, codigoHttp = 500, detalles = null) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.codigoHttp = codigoHttp;
    this.detalles = detalles;
  }
}
