import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import { manejarErrores } from './middlewares/manejarErrores.js';
import { verificarToken } from './middlewares/verificarToken.js';
import { permitirRoles } from './middlewares/permitirRoles.js';

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

// Ruta protegida de prueba para verificar roles (RN-03, HU-02)
app.get('/api/admin/prueba-acceso', verificarToken, permitirRoles('GERENTE', 'DUENO'), (req, res) => {
  res.json({ mensaje: 'Acceso autorizado al panel de administración', usuario: req.usuario });
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
