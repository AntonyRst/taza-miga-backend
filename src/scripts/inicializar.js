import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../db.js';

// Esquema de validación para los datos ingresados en la inicialización completa
const esquemaInicializacion = z.object({
  negocioNombre: z.string().trim().min(2, 'El nombre del negocio debe tener al menos 2 caracteres'),
  negocioSlug: z.string().trim().min(2, 'El slug debe tener al menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  sucursalNombre: z.string().trim().min(2, 'El nombre de la sucursal debe tener al menos 2 caracteres'),
  sucursalDireccion: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres'),
  sucursalTelefono: z.string().trim().optional(),
  sucursalMesas: z.coerce.number().int().positive('La cantidad de mesas debe ser un número entero mayor que 0'),
  duenoNombre: z.string().trim().min(2, 'El nombre del dueño debe tener al menos 2 caracteres'),
  duenoTelefono: z.string().trim().min(6, 'El teléfono debe tener al menos 6 caracteres'),
  duenoCorreo: z.string().trim().email('El correo electrónico no es válido'),
  duenoPassword: z.string().min(8, 'La contraseña debe tener un mínimo de 8 caracteres') // RN-07
});

// Esquema de validación para el alta de Dueño sobre un negocio preexistente
const esquemaDueno = z.object({
  duenoNombre: z.string().trim().min(2, 'El nombre del dueño debe tener al menos 2 caracteres'),
  duenoTelefono: z.string().trim().min(6, 'El teléfono debe tener al menos 6 caracteres'),
  duenoCorreo: z.string().trim().email('El correo electrónico no es válido'),
  duenoPassword: z.string().min(8, 'La contraseña debe tener un mínimo de 8 caracteres') // RN-07
});

/**
 * Crea un lector de líneas secuencial compatible tanto con entrada interactiva
 * en terminal (TTY) como con entrada redirigida por tubería (pipe).
 */
function crearLectorInteractivo() {
  const rl = readline.createInterface({ input, output });
  const colaLineas = [];
  const esperadores = [];

  rl.on('line', (linea) => {
    if (esperadores.length > 0) {
      const resolver = esperadores.shift();
      resolver(linea);
    } else {
      colaLineas.push(linea);
    }
  });

  return {
    async preguntar(textoPregunta) {
      output.write(textoPregunta);
      if (colaLineas.length > 0) {
        const respuesta = colaLineas.shift();
        output.write('\n');
        return respuesta;
      }
      return new Promise((resolve) => {
        esperadores.push(resolve);
      });
    },
    cerrar() {
      rl.close();
    }
  };
}

async function inicializar() {
  console.log('====================================================');
  console.log('   TAZA & MIGA - INICIALIZACIÓN DEL SISTEMA (HU-04)');
  console.log('====================================================\n');

  const lector = crearLectorInteractivo();
  const conexion = await pool.getConnection();

  try {
    // 1. Verificar si ya existe algún Dueño activo en el sistema
    const [duenosExistentes] = await conexion.query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'DUENO' AND activo = TRUE"
    );
    if (duenosExistentes[0].total > 0) {
      lector.cerrar();
      console.error('❌ Error: El sistema ya ha sido inicializado previamente.');
      console.error('Por seguridad, este script solo se puede ejecutar una vez.');
      process.exit(1);
    }

    // 2. Verificar si ya existe el negocio y su catálogo preconfigurado
    const [negociosExistentes] = await conexion.query('SELECT id, nombre, slug FROM negocios ORDER BY id ASC LIMIT 1');
    const negocioPreexistente = negociosExistentes.length > 0 ? negociosExistentes[0] : null;

    if (negocioPreexistente) {
      console.log(`ℹ️ Negocio detectado: "${negocioPreexistente.nombre}" (ID: ${negocioPreexistente.id}, Slug: ${negocioPreexistente.slug}) con catálogo cargado.`);
      console.log('Se procederá a dar de alta la cuenta del Dueño/Administrador principal para este negocio.\n');

      console.log('--- Cuenta del Propietario (Dueño) ---');
      const duenoNombre = (await lector.preguntar('Nombre completo del dueño: ')).trim();
      const duenoTelefono = (await lector.preguntar('Teléfono de contacto (para validación): ')).trim();
      const duenoCorreo = (await lector.preguntar('Correo electrónico (será el usuario de acceso): ')).trim();
      const duenoPassword = (await lector.preguntar('Contraseña del dueño (mínimo 8 caracteres): ')).trim();
      const duenoPasswordConfirm = (await lector.preguntar('Confirmar contraseña: ')).trim();

      lector.cerrar();

      if (duenoPassword !== duenoPasswordConfirm) {
        console.error('\n❌ Error: Las contraseñas no coinciden.');
        process.exit(1);
      }

      const datosValidados = esquemaDueno.parse({
        duenoNombre,
        duenoTelefono,
        duenoCorreo,
        duenoPassword
      });

      console.log('\nGuardando información en la base de datos...');
      await conexion.beginTransaction();

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(datosValidados.duenoPassword, salt);

      const [resUsuario] = await conexion.query(
        `INSERT INTO usuarios (
          negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema,
          correo, password_hash, rol, debe_cambiar_password, activo
        ) VALUES (?, NULL, ?, 'Dueño', ?, TRUE, ?, ?, 'DUENO', FALSE, TRUE)`,
        [
          negocioPreexistente.id,
          datosValidados.duenoNombre,
          datosValidados.duenoTelefono,
          datosValidados.duenoCorreo,
          passwordHash
        ]
      );
      const usuarioId = resUsuario.insertId;

      await conexion.query(
        'INSERT INTO auditoria_logs (negocio_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
        [negocioPreexistente.id, usuarioId, 'INICIALIZACION_SISTEMA', 'Sistema inicializado: alta de cuenta de dueño principal']
      );

      await conexion.commit();

      console.log('\n✅ ¡Sistema inicializado exitosamente!');
      console.log(`- Negocio: ${negocioPreexistente.nombre} (ID: ${negocioPreexistente.id}, Slug: ${negocioPreexistente.slug})`);
      console.log(`- Dueño: ${datosValidados.duenoNombre} (${datosValidados.duenoCorreo}, Rol: DUENO)`);
      console.log('\nPuedes iniciar sesión con estas credenciales en /staff-access.');
      return;
    }

    console.log('--- 1. Datos del Negocio ---');
    const negocioNombre = (await lector.preguntar('Nombre del negocio: ')).trim();
    let negocioSlug = (await lector.preguntar(`Slug del negocio (deja vacío para generar desde el nombre): `)).trim();
    if (!negocioSlug) {
      negocioSlug = negocioNombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    console.log('\n--- 2. Primera Sucursal ---');
    const sucursalNombre = (await lector.preguntar('Nombre de la sucursal (ej. Casa Central): ')).trim();
    const sucursalDireccion = (await lector.preguntar('Dirección física: ')).trim();
    const sucursalTelefono = (await lector.preguntar('Teléfono de la sucursal (opcional): ')).trim();
    const sucursalMesas = (await lector.preguntar('Cantidad de mesas: ')).trim();

    console.log('\n--- 3. Cuenta del Propietario (Dueño) ---');
    const duenoNombre = (await lector.preguntar('Nombre completo del dueño: ')).trim();
    const duenoTelefono = (await lector.preguntar('Teléfono de contacto (para validación): ')).trim();
    const duenoCorreo = (await lector.preguntar('Correo electrónico (será el usuario de acceso): ')).trim();
    const duenoPassword = (await lector.preguntar('Contraseña del dueño (mínimo 8 caracteres): ')).trim();
    const duenoPasswordConfirm = (await lector.preguntar('Confirmar contraseña: ')).trim();

    lector.cerrar();

    if (duenoPassword !== duenoPasswordConfirm) {
      console.error('\n❌ Error: Las contraseñas no coinciden.');
      process.exit(1);
    }

    // Validar todos los datos con Zod
    const datosValidados = esquemaInicializacion.parse({
      negocioNombre,
      negocioSlug,
      sucursalNombre,
      sucursalDireccion,
      sucursalTelefono: sucursalTelefono || undefined,
      sucursalMesas,
      duenoNombre,
      duenoTelefono,
      duenoCorreo,
      duenoPassword
    });

    console.log('\nGuardando información en la base de datos...');

    // Iniciar transacción atómica: o se crea todo o no se crea nada
    await conexion.beginTransaction();

    // 1. Insertar negocio
    const [resNegocio] = await conexion.query(
      'INSERT INTO negocios (nombre, slug) VALUES (?, ?)',
      [datosValidados.negocioNombre, datosValidados.negocioSlug]
    );
    const negocioId = resNegocio.insertId;

    // 2. Insertar primera sucursal
    const [resSucursal] = await conexion.query(
      'INSERT INTO sucursales (negocio_id, nombre, direccion, telefono, cantidad_mesas, activa) VALUES (?, ?, ?, ?, ?, TRUE)',
      [
        negocioId,
        datosValidados.sucursalNombre,
        datosValidados.sucursalDireccion,
        datosValidados.sucursalTelefono || null,
        datosValidados.sucursalMesas
      ]
    );
    const sucursalId = resSucursal.insertId;

    // 3. Cifrar contraseña con bcryptjs (RN-07)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(datosValidados.duenoPassword, salt);

    // 4. Insertar usuario Dueño (sucursal_id es NULL para el dueño según modelo)
    const [resUsuario] = await conexion.query(
      `INSERT INTO usuarios (
        negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema,
        correo, password_hash, rol, debe_cambiar_password, activo
      ) VALUES (?, NULL, ?, 'Dueño', ?, TRUE, ?, ?, 'DUENO', FALSE, TRUE)`,
      [
        negocioId,
        datosValidados.duenoNombre,
        datosValidados.duenoTelefono,
        datosValidados.duenoCorreo,
        passwordHash
      ]
    );
    const usuarioId = resUsuario.insertId;

    // 5. Registrar auditoría (RN-27)
    await conexion.query(
      'INSERT INTO auditoria_logs (negocio_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
      [negocioId, usuarioId, 'INICIALIZACION_SISTEMA', 'Sistema inicializado: creación de negocio, sucursal principal y dueño']
    );

    // Confirmar transacción
    await conexion.commit();

    console.log('\n✅ ¡Sistema inicializado exitosamente!');
    console.log(`- Negocio: ${datosValidados.negocioNombre} (ID: ${negocioId}, Slug: ${datosValidados.negocioSlug})`);
    console.log(`- Sucursal: ${datosValidados.sucursalNombre} (ID: ${sucursalId}, Mesas: ${datosValidados.sucursalMesas})`);
    console.log(`- Dueño: ${datosValidados.duenoNombre} (${datosValidados.duenoCorreo}, Rol: DUENO)`);
    console.log('\nPuedes iniciar sesión con estas credenciales en /staff-access.');
  } catch (error) {
    await conexion.rollback();
    console.error('\n❌ Ocurrió un error al inicializar el sistema:');
    if (error instanceof z.ZodError) {
      error.issues.forEach(issue => console.error(` - ${issue.message}`));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  } finally {
    conexion.release();
    await pool.end();
  }
}

inicializar();
