import { z } from 'zod';

/**
 * Esquema de validación para la creación de un nuevo pedido (HU-11, RN-17, RN-18).
 */
export const crearOrdenSchema = z.object({
  sucursalId: z.coerce
    .number({ invalid_type_error: 'La sucursal es requerida' })
    .int()
    .positive('Identificador de sucursal inválido'),

  nombreCliente: z
    .string({ required_error: 'El nombre del cliente es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'), // RN-18

  tipoEntrega: z
    .enum(['MESA', 'EN_MESA', 'LLEVAR'], {
      errorMap: () => ({ message: 'El tipo de entrega debe ser MESA o LLEVAR' })
    })
    .transform((val) => (val === 'EN_MESA' ? 'MESA' : val)), // RN-17

  numeroMesa: z.coerce
    .number()
    .int()
    .positive('El número de mesa debe ser un entero positivo')
    .nullable()
    .optional(),

  tokenMesa: z.string().trim().nullable().optional(),
  token: z.string().trim().nullable().optional(),

  horaRecogida: z
    .string()
    .trim()
    .nullable()
    .optional(),

  metodoPago: z
    .enum(['TARJETA_DEMO', 'BARRA', 'EN_BARRA'], {
      errorMap: () => ({ message: 'El método de pago debe ser TARJETA_DEMO o BARRA' })
    })
    .transform((val) => (val === 'EN_BARRA' ? 'BARRA' : val)), // RN-23

  lineas: z
    .array(
      z.object({
        productoId: z.coerce
          .number({ invalid_type_error: 'El producto es requerido' })
          .int()
          .positive('Identificador de producto inválido'),

        cantidad: z.coerce
          .number({ invalid_type_error: 'La cantidad es requerida' })
          .int()
          .min(1, 'La cantidad mínima es 1')
          .max(20, 'La cantidad máxima por línea es 20'), // RN-18

        notasPersonalizacion: z
          .string()
          .trim()
          .max(255, 'Las notas de personalización no pueden exceder 255 caracteres')
          .nullable()
          .optional()
          .default(''),

        opcionesIds: z
          .array(z.coerce.number().int().positive())
          .optional()
          .default([])
      })
    )
    .min(1, 'El pedido debe tener al menos una línea de producto') // RN-18
});

/**
 * Esquema de validación para la búsqueda manual de un pedido perdido (HU-12, RN-20).
 */
export const buscarOrdenSchema = z.object({
  numeroOrden: z.coerce
    .number({ invalid_type_error: 'El número de pedido es requerido' })
    .int()
    .positive('El número de pedido debe ser positivo'),

  nombreCliente: z
    .string({ required_error: 'El nombre del cliente es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres')
});

/**
 * Esquema de validación para el cambio de estado de un pedido (HU-14, RN-21).
 */
export const cambiarEstadoSchema = z.object({
  estado: z.enum(['RECIBIDO', 'PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'], {
    errorMap: () => ({ message: 'Estado inválido' })
  })
});

/**
 * Esquema de validación para la cancelación de un pedido con motivo (HU-16, RN-22).
 */
export const cancelarOrdenSchema = z.object({
  motivo: z
    .string({ required_error: 'El motivo de cancelación es obligatorio' })
    .trim()
    .min(2, 'El motivo de cancelación debe tener al menos 2 caracteres')
    .max(255, 'El motivo no puede exceder 255 caracteres')
});
