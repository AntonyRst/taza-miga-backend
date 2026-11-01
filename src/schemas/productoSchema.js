import { z } from 'zod';

export const crearProductoSchema = z.object({
  categoria_id: z
    .coerce.number({ required_error: 'La categoría es obligatoria' })
    .int()
    .positive('La categoría debe ser un ID válido'),
  nombre_es: z
    .string({ required_error: 'El nombre en español es obligatorio' })
    .trim()
    .min(2, 'El nombre en español debe tener al menos 2 caracteres')
    .max(100, 'El nombre en español no puede exceder 100 caracteres'),
  nombre_en: z
    .string({ required_error: 'El nombre en inglés es obligatorio' })
    .trim()
    .min(2, 'El nombre en inglés debe tener al menos 2 caracteres')
    .max(100, 'El nombre en inglés no puede exceder 100 caracteres'),
  descripcion_es: z
    .string()
    .trim()
    .max(255, 'La descripción en español no puede exceder 255 caracteres')
    .optional()
    .nullable(),
  descripcion_en: z
    .string()
    .trim()
    .max(255, 'La descripción en inglés no puede exceder 255 caracteres')
    .optional()
    .nullable(),
  precio: z
    .coerce.number({ required_error: 'El precio es obligatorio' })
    .gt(0, 'El precio del producto debe ser mayor que 0'), // RN-12
  imagen_url: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),
  disponible: z
    .boolean()
    .optional()
    .default(true),
  activo: z
    .boolean()
    .optional()
    .default(true),
  grupos_ids: z
    .array(z.coerce.number().int().positive())
    .optional()
    .default([])
});

export const editarProductoSchema = z.object({
  categoria_id: z.coerce.number().int().positive().optional(),
  nombre_es: z.string().trim().min(2).max(100).optional(),
  nombre_en: z.string().trim().min(2).max(100).optional(),
  descripcion_es: z.string().trim().max(255).optional().nullable(),
  descripcion_en: z.string().trim().max(255).optional().nullable(),
  precio: z.coerce.number().gt(0, 'El precio del producto debe ser mayor que 0').optional(), // RN-12
  imagen_url: z.string().trim().max(255).optional().nullable(),
  disponible: z.boolean().optional(),
  activo: z.boolean().optional(),
  grupos_ids: z.array(z.coerce.number().int().positive()).optional()
});
