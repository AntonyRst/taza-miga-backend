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

/**
 * Esquema de validación para el cambio de contraseña (HU-03, RN-07).
 */
export const cambiarPasswordSchema = z.object({
  passwordActual: z
    .string({ required_error: 'La contraseña actual es obligatoria' })
    .min(1, 'La contraseña actual no puede estar vacía'),
  passwordNueva: z
    .string({ required_error: 'La nueva contraseña es obligatoria' })
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres') // RN-07
});
