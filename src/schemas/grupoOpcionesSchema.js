import { z } from 'zod';

export const crearGrupoSchema = z.object({
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
  tipo_seleccion: z
    .enum(['UNICA', 'MULTIPLE'], {
      errorMap: () => ({ message: 'El tipo de selección debe ser UNICA o MULTIPLE' })
    }),
  obligatorio: z
    .boolean()
    .optional()
    .default(false),
  activo: z
    .boolean()
    .optional()
    .default(true)
});

export const editarGrupoSchema = crearGrupoSchema.partial();
