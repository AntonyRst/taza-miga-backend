import { z } from 'zod';

/**
 * Esquema de validación para el inicio de sesión del personal.
 */
export const loginSchema = z.object({
  correo: z
    .string({ required_error: 'El correo electrónico es obligatorio' })
    .trim()
    .email('El formato del correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña no puede estar vacía')
});
