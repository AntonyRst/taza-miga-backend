import bcrypt from 'bcryptjs';
import { usuarioRepository } from '../repositories/usuarioRepository.js';
import { ErrorApp } from '../ErrorApp.js';

export const usuarioService = {
  /**
   * Crea un nuevo usuario en el sistema.
   * Valida unicidad de correo (RN-02) y formato de contraseña (RN-07).
   * @param {object} datos
   * @param {number} negocioId
   * @returns {Promise<object>}
   */
  async crearUsuario(datos, negocioId) {
    // RN-02: El correo de un usuario es único en todo el sistema
    const existente = await usuarioRepository.buscarPorCorreo(datos.correo);
    if (existente) {
      throw new ErrorApp('El correo ya está registrado en el sistema', 409);
    }

    // RN-07: Las contraseñas tienen mínimo 8 caracteres
    if (!datos.password || datos.password.length < 8) {
      throw new ErrorApp('La contraseña debe tener mínimo 8 caracteres', 400);
    }

    // Cifrar contraseña con bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(datos.password, salt);

    const nuevoId = await usuarioRepository.crear({
      negocioId,
      sucursalId: datos.sucursalId || null,
      nombre: datos.nombre,
      cargo: datos.cargo,
      telefono: datos.telefono,
      accesoSistema: datos.accesoSistema !== undefined ? datos.accesoSistema : true,
      correo: datos.correo,
      passwordHash,
      rol: datos.rol || 'BARISTA',
      debeCambiarPassword: Boolean(datos.debeCambiarPassword),
      activo: datos.activo !== undefined ? datos.activo : true
    });

    const creado = await usuarioRepository.buscarPorId(nuevoId);

    // RN-07: Nunca devolver hashes ni contraseñas en las respuestas
    return {
      id: creado.id,
      negocioId: creado.negocioId,
      sucursalId: creado.sucursalId,
      nombre: creado.nombre,
      cargo: creado.cargo,
      telefono: creado.telefono,
      correo: creado.correo,
      rol: creado.rol,
      debeCambiarPassword: Boolean(creado.debeCambiarPassword),
      activo: Boolean(creado.activo)
    };
  }
};
