import { z } from 'zod';

/**
 * Esquema para filtrar métricas de ventas y desgloses (HU-22, RN-30 a RN-35).
 */
export const metricasQuerySchema = z.object({
  periodo: z.enum(['hoy', '7dias', 'mes', 'personalizado']).optional().default('hoy'),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  sucursalId: z.coerce.number().int().positive().optional()
});

/**
 * Esquema para consultar el historial de pedidos y tickets (HU-23).
 */
export const historialPedidosQuerySchema = z.object({
  estado: z
    .enum(['TODOS', 'RECIBIDO', 'PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'])
    .optional()
    .default('TODOS'),
  metodoPago: z
    .enum(['TODOS', 'BARRA', 'TARJETA_DEMO'])
    .optional()
    .default('TODOS'),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  sucursalId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().optional()
});

/**
 * Esquema para consultar logs de auditoría (HU-24, RN-27).
 */
export const auditoriaQuerySchema = z.object({
  usuarioId: z.coerce.number().int().positive().optional(),
  accion: z.string().trim().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional()
});
