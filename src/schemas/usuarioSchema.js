import { z } from 'zod';

/**
 * Esquema base existente para compatibilidad con Entrega 1.
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

/**
 * Esquema de validación para dar de alta personal (HU-18, RN-02, RN-06, RN-07, RN-26).
 * Soporta personal con acceso (barista/gerente) y sin acceso (mesero, limpieza).
 */
export const crearPersonalSchema = z
  .object({
    nombre: z
      .string({ required_error: 'El nombre es obligatorio' })
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),

    cargo: z
      .string({ required_error: 'El cargo es obligatorio' })
      .trim()
      .min(2, 'El cargo debe tener al menos 2 caracteres')
      .max(50, 'El cargo no puede exceder 50 caracteres'),

    telefono: z
      .string({ required_error: 'El teléfono es obligatorio' })
      .trim()
      .min(6, 'El teléfono debe tener al menos 6 caracteres')
      .max(20, 'El teléfono no puede exceder 20 caracteres'),

    sucursalId: z.coerce
      .number()
      .int()
      .positive('Identificador de sucursal inválido')
      .nullable()
      .optional(),

    accesoSistema: z.boolean().default(false),

    correo: z
      .string()
      .trim()
      .email('Correo electrónico no válido')
      .nullable()
      .optional()
      .or(z.literal('')),

    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres (RN-07)')
      .nullable()
      .optional()
      .or(z.literal('')),

    rol: z
      .enum(['GERENTE', 'BARISTA', 'SIN_ACCESO'])
      .default('SIN_ACCESO')
  })
  .refine(
    (datos) => {
      // Si tiene acceso al sistema, correo y contraseña son obligatorios (RN-02, RN-07)
      if (datos.accesoSistema) {
        return Boolean(datos.correo && datos.correo.trim().length > 0);
      }
      return true;
    },
    {
      message: 'El correo electrónico es obligatorio para personal con acceso al sistema',
      path: ['correo']
    }
  )
  .refine(
    (datos) => {
      if (datos.accesoSistema) {
        return Boolean(datos.password && datos.password.length >= 8);
      }
      return true;
    },
    {
      message: 'La contraseña temporal debe tener al menos 8 caracteres (RN-07)',
      path: ['password']
    }
  )
  .refine(
    (datos) => {
      // RN-26: Barista y gerente exigen sucursal asignada
      if (datos.rol === 'BARISTA' || datos.rol === 'GERENTE') {
        return Boolean(datos.sucursalId);
      }
      return true;
    },
    {
      message: 'Baristas y gerentes exigen una sucursal asignada (RN-26)',
      path: ['sucursalId']
    }
  );

/**
 * Esquema de validación para editar datos de personal (HU-18).
 */
export const editarPersonalSchema = z
  .object({
    nombre: z
      .string({ required_error: 'El nombre es obligatorio' })
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100),

    cargo: z
      .string({ required_error: 'El cargo es obligatorio' })
      .trim()
      .min(2, 'El cargo debe tener al menos 2 caracteres')
      .max(50),

    telefono: z
      .string({ required_error: 'El teléfono es obligatorio' })
      .trim()
      .min(6)
      .max(20),

    sucursalId: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),

    accesoSistema: z.boolean().default(false),

    correo: z
      .string()
      .trim()
      .email('Correo electrónico no válido')
      .nullable()
      .optional()
      .or(z.literal('')),

    rol: z
      .enum(['DUENO', 'GERENTE', 'BARISTA', 'SIN_ACCESO'])
      .default('SIN_ACCESO'),

    activo: z.boolean().optional()
  })
  .refine(
    (datos) => {
      if (datos.accesoSistema && (!datos.correo || datos.correo.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'El correo electrónico es obligatorio para personal con acceso',
      path: ['correo']
    }
  )
  .refine(
    (datos) => {
      // RN-26: Barista y gerente exigen sucursal asignada
      if ((datos.rol === 'BARISTA' || datos.rol === 'GERENTE') && !datos.sucursalId) {
        return false;
      }
      return true;
    },
    {
      message: 'Baristas y gerentes exigen una sucursal asignada (RN-26)',
      path: ['sucursalId']
    }
  );

/**
 * Esquema para filtrar y buscar personal (HU-18).
 */
export const listarPersonalQuerySchema = z.object({
  sucursalId: z.coerce.number().int().positive().optional(),
  cargo: z.string().trim().optional(),
  q: z.string().trim().optional()
});

/**
 * Esquema para restablecer contraseña temporal a un compañero (HU-19, RN-09).
 */
export const restablecerPasswordSchema = z.object({
  passwordTemporal: z
    .string({ required_error: 'La contraseña temporal es obligatoria' })
    .min(8, 'La contraseña temporal debe tener al menos 8 caracteres (RN-07)')
});

/**
 * Esquema para trasladar personal a otra sucursal (HU-21, RN-26).
 */
export const trasladarPersonalSchema = z.object({
  nuevaSucursalId: z.coerce
    .number({ required_error: 'La nueva sucursal es obligatoria' })
    .int()
    .positive('Identificador de sucursal inválido')
});
