import { Router } from 'express';
import { z } from 'zod';
import { verificarToken } from '../middlewares/verificarToken.js';
import { permitirRoles } from '../middlewares/permitirRoles.js';
import { sucursalService } from '../services/sucursalService.js';
import { sucursalAdminService } from '../services/sucursalAdminService.js';
import { usuarioService } from '../services/usuarioService.js';
import { personalService } from '../services/personalService.js';
import { reportesService } from '../services/reportesService.js';
import { auditoriaService } from '../services/auditoriaService.js';
import {
  crearUsuarioSchema,
  crearPersonalSchema,
  editarPersonalSchema,
  listarPersonalQuerySchema,
  restablecerPasswordSchema,
  trasladarPersonalSchema
} from '../schemas/usuarioSchema.js';
import { sucursalSchema } from '../schemas/sucursalSchema.js';
import {
  metricasQuerySchema,
  historialPedidosQuerySchema,
  auditoriaQuerySchema
} from '../schemas/reportesSchema.js';

const router = Router();

// Todas las rutas de administración exigen autenticación y rol de GERENTE o DUENO (RN-03)
router.use(verificarToken);
router.use(permitirRoles('GERENTE', 'DUENO'));

/**
 * GET /api/admin/prueba-acceso
 * Ruta de verificación de acceso a panel administrativo (RN-03, HU-02).
 */
router.get('/prueba-acceso', (req, res) => {
  res.status(200).json({
    mensaje: 'Acceso autorizado al panel de administración',
    usuario: req.usuario
  });
});

/* ==========================================================================
   PERSONAL Y USUARIOS (HU-18, HU-19, HU-21)
   ========================================================================== */

/**
 * GET /api/admin/personal
 * Lista el personal del negocio (HU-18). Gerente solo ve su sucursal (RN-04).
 */
router.get('/personal', async (req, res, next) => {
  try {
    const filtros = listarPersonalQuerySchema.parse(req.query);
    const personal = await personalService.listarPersonal(req.usuario, filtros);
    res.json(personal);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/personal
 * Da de alta a personal con o sin acceso al sistema (HU-18, RN-06, RN-07, RN-26).
 */
router.post('/personal', async (req, res, next) => {
  try {
    const datos = crearPersonalSchema.parse(req.body);
    const nuevo = await personalService.crearPersonal(req.usuario, datos);
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/personal/:id
 * Edita los datos de un empleado (HU-18).
 */
router.put('/personal/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datos = editarPersonalSchema.parse(req.body);
    const actualizado = await personalService.editarPersonal(req.usuario, id, datos);
    res.json(actualizado);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/personal/:id/activo
 * Activa o desactiva personal (RN-08, RN-10).
 */
router.patch('/personal/:id/activo', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
    const resultado = await personalService.actualizarActivo(req.usuario, id, activo);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/personal/:id/reset-password
 * Asigna una contraseña temporal con cambio obligatorio (HU-19, RN-09).
 */
router.post('/personal/:id/reset-password', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { passwordTemporal } = restablecerPasswordSchema.parse(req.body);
    const resultado = await personalService.restablecerPassword(
      req.usuario,
      id,
      passwordTemporal
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/personal/:id/pedidos-en-curso
 * Consulta los pedidos activos de la sucursal de un empleado antes de trasladar (HU-21).
 */
router.get('/personal/:id/pedidos-en-curso', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const resultado = await personalService.consultarPedidosEnCursoEmpleado(req.usuario, id);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/personal/:id/trasladar
 * Traslada personal entre sucursales. Solo DUENO (HU-21, RN-05, RN-26).
 */
router.post('/personal/:id/trasladar', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { nuevaSucursalId } = trasladarPersonalSchema.parse(req.body);
    const resultado = await personalService.trasladarPersonal(
      req.usuario,
      id,
      nuevaSucursalId
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   SUCURSALES (HU-20)
   ========================================================================== */

/**
 * GET /api/admin/sucursales
 * Lista todas las sucursales del negocio (HU-20).
 */
router.get('/sucursales', async (req, res, next) => {
  try {
    const sucursales = await sucursalAdminService.listarTodas(req.usuario);
    res.json(sucursales);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/sucursales/:id
 * Obtiene los detalles de una sucursal del negocio del token (RN-01).
 */
router.get('/sucursales/:id', async (req, res, next) => {
  try {
    const sucursalId = z.coerce.number().int().positive().parse(req.params.id);
    const sucursal = await sucursalService.obtenerPorId(sucursalId, req.usuario.negocio_id);
    res.status(200).json(sucursal);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/sucursales
 * Registra una nueva sucursal con coordenadas o manual (HU-20, RN-05, RN-25).
 */
router.post('/sucursales', async (req, res, next) => {
  try {
    const datos = sucursalSchema.parse(req.body);
    const creada = await sucursalAdminService.crearSucursal(req.usuario, datos);
    res.status(201).json(creada);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/sucursales/:id
 * Modifica datos de una sucursal (HU-20, RN-05, RN-25).
 */
router.put('/sucursales/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const datos = sucursalSchema.parse(req.body);
    const actualizada = await sucursalAdminService.editarSucursal(req.usuario, id, datos);
    res.json(actualizada);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/sucursales/:id/activa
 * Activa o desactiva una sucursal (RN-05, RN-25).
 */
router.patch('/sucursales/:id/activa', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { activa } = z.object({ activa: z.boolean() }).parse(req.body);
    const resultado = await sucursalAdminService.actualizarActiva(req.usuario, id, activa);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   MÉTRICAS Y REGISTRO DE PEDIDOS (HU-22, HU-23, RN-30 a RN-35)
   ========================================================================== */

/**
 * GET /api/admin/metricas
 * Dashboard de ventas, cifras y gráficos calculados en base de datos (HU-22).
 */
router.get('/metricas', async (req, res, next) => {
  try {
    const filtros = metricasQuerySchema.parse(req.query);
    const metricas = await reportesService.obtenerDashboard(req.usuario, filtros);
    res.json(metricas);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/pedidos-historial
 * Historial de pedidos y consulta de tickets (HU-23, RN-24).
 */
router.get('/pedidos-historial', async (req, res, next) => {
  try {
    const filtros = historialPedidosQuerySchema.parse(req.query);
    const historial = await reportesService.listarHistorialPedidos(req.usuario, filtros);
    res.json(historial);
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   AUDITORÍA (HU-24, RN-27)
   ========================================================================== */

/**
 * GET /api/admin/auditoria
 * Historial de acciones críticas del negocio. Exclusivo para DUENO (RN-03, RN-27).
 */
router.get('/auditoria', async (req, res, next) => {
  try {
    const filtros = auditoriaQuerySchema.parse(req.query);
    const logs = await auditoriaService.listarLogs(req.usuario, filtros);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

/* ==========================================================================
   COMPATIBILIDAD CON ENTREGA 1
   ========================================================================== */

/**
 * POST /api/admin/usuarios
 */
router.post('/usuarios', async (req, res, next) => {
  try {
    const datosValidados = crearUsuarioSchema.parse(req.body);
    const nuevoUsuario = await usuarioService.crearUsuario(
      datosValidados,
      req.usuario.negocio_id
    );
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    next(error);
  }
});

export default router;
