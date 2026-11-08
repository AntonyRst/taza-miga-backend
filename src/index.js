import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import categoriaRoutes from './routes/categoriaRoutes.js';
import grupoOpcionesRoutes from './routes/grupoOpcionesRoutes.js';
import opcionRoutes from './routes/opcionRoutes.js';
import productoRoutes from './routes/productoRoutes.js';
import publicoRoutes from './routes/publicoRoutes.js';
import kdsRoutes from './routes/kdsRoutes.js';
import sucursalRoutes from './routes/sucursalRoutes.js';
import { manejarErrores } from './middlewares/manejarErrores.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const dominiosPermitidosRegex = [
  /^https:\/\/.*\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (curl, server-to-server, health checks)
    if (!origin) return callback(null, true);

    const esValido = dominiosPermitidosRegex.some(regex => regex.test(origin)) ||
      (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL.trim().replace(/\/$/, ''));

    if (esValido) {
      return callback(null, true);
    }

    // Usar null, false en lugar de lanzar Error para no provocar un crash 500
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Ruta de comprobación de salud de la API
const manejadorSalud = (req, res) => {
  res.json({
    estado: 'ok',
    mensaje: 'Servidor Taza & Miga API activo',
    fecha: new Date().toISOString()
  });
};
app.get('/api/salud', manejadorSalud);
app.get('/salud', manejadorSalud);

// Rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Rutas de administración básica y usuarios (RN-01, RN-02, RN-03)
app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

// Rutas de administración de catálogo y menú (HU-09, HU-10, RN-10, RN-11, RN-12)
app.use('/api/categorias', categoriaRoutes);
app.use('/categorias', categoriaRoutes);
app.use('/api/grupos-opciones', grupoOpcionesRoutes);
app.use('/grupos-opciones', grupoOpcionesRoutes);
app.use('/api/opciones', opcionRoutes);
app.use('/opciones', opcionRoutes);
app.use('/api/productos', productoRoutes);
app.use('/productos', productoRoutes);

// Rutas públicas para clientes sin cuenta (HU-05, HU-06)
app.use('/api/publico', publicoRoutes);
app.use('/publico', publicoRoutes);

// Rutas del panel KDS del barista (HU-13 a HU-17, RN-21 a RN-24)
app.use('/api/kds', kdsRoutes);
app.use('/kds', kdsRoutes);

// Rutas de administración de sucursales (HU-20, RN-05, RN-25)
app.use('/api/sucursales', sucursalRoutes);
app.use('/sucursales', sucursalRoutes);

// Manejo de rutas no encontradas (404 JSON seguro en vez de HTML)
app.use((req, res) => {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware global de manejo de errores
app.use(manejarErrores);

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor API iniciado en http://localhost:${PORT}`);
  });
}

export default app;
