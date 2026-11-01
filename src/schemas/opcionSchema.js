import { z } from 'zod';

export const crearOpcionSchema = z.object({
  grupo_id: z
    .coerce.number({ required_error: 'El ID del grupo es obligatorio' })
    .int()
    .positive('El ID del grupo debe ser un entero positivo'),
  nombre_es: z
    .string({ required_error: 'El nombre en español es obligatorio' })
    .trim()
    .min(1, 'El nombre en español no puede estar vacío')
    .max(80, 'El nombre en español no puede exceder 80 caracteres'),
  nombre_en: z
    .string({ required_error: 'El nombre en inglés es obligatorio' })
    .trim()
    .min(1, 'El nombre en inglés no puede estar vacío')
    .max(80, 'El nombre en inglés no puede exceder 80 caracteres'),
  precio_extra: z
    .coerce.number()
    .min(0, 'El precio extra no puede ser negativo') // RN-12
    .default(0.00),
  es_predeterminada: z
    .boolean()
    .optional()
    .default(false),
  activa: z
    .boolean()
    .optional()
    .default(true)
});

export const editarOpcionSchema = z.object({
  nombre_es: z
    .string()
    .trim()
    .min(1, 'El nombre en español no puede estar vacío')
    .max(80)
    .optional(),
  nombre_en: z
    .string()
    .trim()
    .min(1, 'El nombre en inglés no puede estar vacío')
    .max(80)
    .optional(),
  precio_extra: z
    .coerce.number()
    .min(0, 'El precio extra no puede ser negativo') // RN-12
    .optional(),
  es_predeterminada: z
    .boolean()
    .optional(),
  activa: z
    .boolean()
    .optional()
});
