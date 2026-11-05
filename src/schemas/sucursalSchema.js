import { z } from 'zod';

/**
 * Esquema de validación para crear y editar sucursales (HU-20, RN-25).
 * Valida que latitud y longitud vayan juntas o ninguna (RN-25) y cantidad de mesas > 0.
 */
export const sucursalSchema = z
  .object({
    nombre: z
      .string({ required_error: 'El nombre de la sucursal es obligatorio' })
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),

    direccion: z
      .string({ required_error: 'La dirección es obligatoria' })
      .trim()
      .min(3, 'La dirección debe tener al menos 3 caracteres')
      .max(255, 'La dirección no puede exceder 255 caracteres'), // RN-25

    telefono: z
      .string()
      .trim()
      .max(20, 'El teléfono no puede exceder 20 caracteres')
      .nullable()
      .optional()
      .default(''),

    cantidadMesas: z.coerce
      .number({ invalid_type_error: 'La cantidad de mesas debe ser un número' })
      .int('La cantidad de mesas debe ser un número entero')
      .min(1, 'La sucursal debe tener al menos 1 mesa'),

    latitud: z.coerce
      .number()
      .min(-90, 'Latitud fuera de rango (-90 a 90)')
      .max(90, 'Latitud fuera de rango (-90 a 90)')
      .nullable()
      .optional(),

    longitud: z.coerce
      .number()
      .min(-180, 'Longitud fuera de rango (-180 a 180)')
      .max(180, 'Longitud fuera de rango (-180 a 180)')
      .nullable()
      .optional(),

    activa: z.boolean().optional().default(true)
  })
  .refine(
    (datos) => {
      // RN-25: Latitud y longitud van juntas o ninguna
      const tieneLat = datos.latitud !== null && datos.latitud !== undefined && !isNaN(datos.latitud);
      const tieneLng = datos.longitud !== null && datos.longitud !== undefined && !isNaN(datos.longitud);
      return (tieneLat && tieneLng) || (!tieneLat && !tieneLng);
    },
    {
      message: 'Latitud y longitud deben enviarse juntas o ninguna (RN-25)',
      path: ['latitud']
    }
  );
