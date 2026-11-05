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
import { manejarErrores } from './middlewares/manejarErrores.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS configurado solo para el origen del frontend
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// Ruta de comprobación de salud de la API
app.get('/api/salud', (req, res) => {
  res.json({
    estado: 'ok',
    mensaje: 'Servidor Taza & Miga API activo',
    fecha: new Date().toISOString()
  });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de administración básica y usuarios (RN-01, RN-02, RN-03)
app.use('/api/admin', adminRoutes);

// Rutas de administración de catálogo y menú (HU-09, HU-10, RN-10, RN-11, RN-12)
app.use('/api/categorias', categoriaRoutes);
app.use('/api/grupos-opciones', grupoOpcionesRoutes);
app.use('/api/opciones', opcionRoutes);
app.use('/api/productos', productoRoutes);

// Rutas públicas para clientes sin cuenta (HU-05, HU-06)
app.use('/api/publico', publicoRoutes);

// Rutas del panel KDS del barista (HU-13 a HU-17, RN-21 a RN-24)
app.use('/api/kds', kdsRoutes);

// Middleware global de manejo de errores
app.use(manejarErrores);

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor API iniciado en http://localhost:${PORT}`);
  });
}

export default app;
