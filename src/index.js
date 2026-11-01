import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
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

// Rutas de administración (RN-01, RN-02, RN-03)
app.use('/api/admin', adminRoutes);

// Middleware global de manejo de errores
app.use(manejarErrores);

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor API iniciado en http://localhost:${PORT}`);
  });
}

export default app;
