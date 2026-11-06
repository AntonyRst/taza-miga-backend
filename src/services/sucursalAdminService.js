/**
 * Re-exportación para retrocompatibilidad de módulos administrativos (HU-20).
 * Toda la lógica de negocio reside centralizada en sucursalService.js.
 */
export { sucursalService as sucursalAdminService } from './sucursalService.js';
