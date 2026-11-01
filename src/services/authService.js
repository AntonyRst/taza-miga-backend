import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usuarioRepository } from '../repositories/usuarioRepository.js';
import { ErrorApp } from '../ErrorApp.js';

// RN-07: Mensaje idéntico ante cualquier fallo de autenticación
const MENSAJE_ERROR_AUTENTICACION = 'Correo o contraseña incorrectos';

export const authService = {
  /**
   * Inicia sesión para el personal de la cafetería.
   * Aplica RN-07 y RN-08.
   */
  async iniciarSesion(correo, password) {
    const usuario = await usuarioRepository.buscarPorCorreo(correo);

    // RN-07: Si el usuario no existe, devuelve 401 con el mensaje genérico
    if (!usuario) {
      throw new ErrorApp(MENSAJE_ERROR_AUTENTICACION, 401);
    }

    // RN-08: Un usuario inactivo no puede iniciar sesión
    if (!usuario.activo) {
      throw new ErrorApp(MENSAJE_ERROR_AUTENTICACION, 401);
    }

    // El usuario debe tener acceso al sistema y contraseña registrada
    if (!usuario.accesoSistema || !usuario.passwordHash) {
      throw new ErrorApp(MENSAJE_ERROR_AUTENTICACION, 401);
    }

    // RN-07: Compara contraseña con hash bcrypt
    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) {
      throw new ErrorApp(MENSAJE_ERROR_AUTENTICACION, 401);
    }

    // Generar token JWT con vigencia de 8 horas
    const secreto = process.env.JWT_SECRET || 'secreto_desarrollo_inseguro';
    const payload = {
      id: usuario.id,
      rol: usuario.rol,
      negocio_id: usuario.negocioId,
      sucursal_id: usuario.sucursalId,
      debe_cambiar_password: Boolean(usuario.debeCambiarPassword)
    };

    const token = jwt.sign(payload, secreto, { expiresIn: '8h' });

    // RN-07: Jamás devolver hashes ni contraseñas en la respuesta
    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        cargo: usuario.cargo,
        correo: usuario.correo,
        rol: usuario.rol,
        negocioId: usuario.negocioId,
        sucursalId: usuario.sucursalId,
        debeCambiarPassword: Boolean(usuario.debeCambiarPassword)
      }
    };
  },

  /**
   * Obtiene la información del perfil del usuario autenticado.
   */
  async obtenerPerfil(usuarioId) {
    const usuario = await usuarioRepository.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) {
      throw new ErrorApp('Usuario no encontrado o inactivo', 404);
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      cargo: usuario.cargo,
      correo: usuario.correo,
      rol: usuario.rol,
      negocioId: usuario.negocioId,
      sucursalId: usuario.sucursalId,
      debeCambiarPassword: Boolean(usuario.debeCambiarPassword)
    };
  },

  /**
   * Cambia la contraseña del usuario autenticado (HU-03).
   * Valida RN-07 y retira la marca de contraseña temporal RN-09.
   */
  async cambiarPassword(usuarioId, passwordActual, passwordNueva) {
    const usuario = await usuarioRepository.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) {
      throw new ErrorApp('Usuario no encontrado o inactivo', 404);
    }

    // Validar contraseña actual con bcrypt
    const coincide = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!coincide) {
      throw new ErrorApp('La contraseña actual es incorrecta', 400);
    }

    // RN-07: Contraseñas mínimo 8 caracteres
    if (passwordNueva.length < 8) {
      throw new ErrorApp('La nueva contraseña debe tener mínimo 8 caracteres', 400);
    }

    // Cifrar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const nuevoHash = await bcrypt.hash(passwordNueva, salt);

    // Actualizar en base de datos y retirar debe_cambiar_password (RN-09)
    await usuarioRepository.actualizarPassword(usuario.id, nuevoHash);

    // Generar un nuevo token actualizado sin la marca de cambio obligatorio
    const secreto = process.env.JWT_SECRET || 'secreto_desarrollo_inseguro';
    const payload = {
      id: usuario.id,
      rol: usuario.rol,
      negocio_id: usuario.negocioId,
      sucursal_id: usuario.sucursalId,
      debe_cambiar_password: false
    };

    const nuevoToken = jwt.sign(payload, secreto, { expiresIn: '8h' });

    // RN-07: Ninguna respuesta devuelve contraseñas ni hashes
    return {
      mensaje: 'Contraseña actualizada exitosamente',
      token: nuevoToken
    };
  }
};
