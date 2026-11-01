import { sucursalRepository } from '../repositories/sucursalRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const sucursalService = {
  /**
   * Obtiene la información de una sucursal filtrada por el negocio del usuario (RN-01).
   * Un negocio solo puede ver y modificar sus propios datos; un registro ajeno responde 404.
   * @param {number} sucursalId
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async obtenerPorId(sucursalId, negocioId) {
    // RN-01: Filtrar siempre por el negocio_id extraído del token
    const sucursal = await sucursalRepository.buscarPorIdYNegocio(sucursalId, negocioId);

    // Si no existe o pertenece a otro negocio, responder 404
    if (!sucursal) {
      throw new ErrorApp('Sucursal no encontrada', 404);
    }

    return sucursal;
  }
};
