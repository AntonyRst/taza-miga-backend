import { z } from 'zod';

export const crearCategoriaSchema = z.object({
  nombre_es: z
    .string({ required_error: 'El nombre en español es obligatorio' })
    .trim()
    .min(2, 'El nombre en español debe tener al menos 2 caracteres')
    .max(80, 'El nombre en español no puede exceder 80 caracteres'),
  nombre_en: z
    .string({ required_error: 'El nombre en inglés es obligatorio' })
    .trim()
    .min(2, 'El nombre en inglés debe tener al menos 2 caracteres')
    .max(80, 'El nombre en inglés no puede exceder 80 caracteres'),
  orden: z
    .coerce.number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0),
  activa: z
    .boolean()
    .optional()
    .default(true)
});

export const editarCategoriaSchema = crearCategoriaSchema.partial();
