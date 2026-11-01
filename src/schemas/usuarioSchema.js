import { z } from 'zod';

/**
 * Esquema de validación para la creación de usuarios en el sistema.
 * Valida RN-07 (contraseña mínimo 8 caracteres).
 */
export const crearUsuarioSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres'),
  cargo: z
    .string({ required_error: 'El cargo es obligatorio' })
    .trim()
    .min(2, 'El cargo debe tener al menos 2 caracteres'),
  telefono: z
    .string({ required_error: 'El teléfono es obligatorio' })
    .trim()
    .min(6, 'El teléfono debe tener al menos 6 caracteres'),
  correo: z
    .string({ required_error: 'El correo electrónico es obligatorio' })
    .trim()
    .email('El correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(8, 'La contraseña debe tener un mínimo de 8 caracteres'), // RN-07
  rol: z
    .enum(['DUENO', 'GERENTE', 'BARISTA', 'SIN_ACCESO'])
    .default('BARISTA'),
  sucursalId: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
  debeCambiarPassword: z
    .boolean()
    .optional(),
  activo: z
    .boolean()
    .optional()
});
