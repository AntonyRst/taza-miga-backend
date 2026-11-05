import { auditoriaRepository } from '../repositories/auditoriaRepository.js';
import { ErrorApp } from '../ErrorApp.js';

/**
 * Servicio de auditoría del sistema (HU-24).
 * RN-03: Solo el dueño puede acceder a la auditoría (403 para otros roles).
 * RN-27: Los registros son inmutables.
 */
export const auditoriaService = {
  async listarLogs(usuario, filtros = {}) {
    if (usuario.rol !== 'DUENO') {
      throw new ErrorApp('Solo el dueño puede revisar la auditoría (RN-03)', 403);
    }

    return auditoriaRepository.listarPorNegocio(usuario.negocio_id, filtros);
  }
};
