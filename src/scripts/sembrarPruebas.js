import bcrypt from 'bcryptjs';
import pool from '../db.js';

/**
 * Script para sembrar datos de prueba necesarios para verificar las reglas
 * RN-01, RN-02, RN-03, RN-07, RN-08 y RN-09 en pruebas.http.
 */
async function sembrar() {
  console.log('Sembrando datos de prueba en MariaDB...');
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    // 1. Asegurar Negocio 1 (Taza & Miga) y Sucursal 1
    const [negocios] = await conexion.query('SELECT id FROM negocios WHERE id = 1');
    let negocio1Id = 1;
    if (negocios.length === 0) {
      const [resN1] = await conexion.query(
        "INSERT INTO negocios (id, nombre, slug) VALUES (1, 'Taza & Miga', 'taza-miga')"
      );
      negocio1Id = resN1.insertId;
    }

    const [sucursales] = await conexion.query('SELECT id FROM sucursales WHERE id = 1');
    if (sucursales.length === 0) {
      await conexion.query(
        "INSERT INTO sucursales (id, negocio_id, nombre, direccion, telefono, cantidad_mesas, activa) VALUES (1, ?, 'Casa Central', 'Av. Las Palmas #102', '2222-3333', 12, TRUE)",
        [negocio1Id]
      );
    }

    // 2. Asegurar Negocio 2 (Café París) y sucursal para RN-01 (aislamiento multinegocio)
    let negocio2Id;
    const [negocios2] = await conexion.query("SELECT id FROM negocios WHERE slug = 'cafe-paris'");
    if (negocios2.length === 0) {
      const [resN2] = await conexion.query(
        "INSERT INTO negocios (nombre, slug) VALUES ('Café París', 'cafe-paris')"
      );
      negocio2Id = resN2.insertId;
    } else {
      negocio2Id = negocios2[0].id;
    }

    const [sucursales2] = await conexion.query('SELECT id FROM sucursales WHERE negocio_id = ?', [negocio2Id]);
    if (sucursales2.length === 0) {
      await conexion.query(
        "INSERT INTO sucursales (negocio_id, nombre, direccion, telefono, cantidad_mesas, activa) VALUES (?, 'Sucursal París Centro', 'Boulevard Francia #45', '2222-9999', 8, TRUE)",
        [negocio2Id]
      );
    }

    // Hashes para contraseñas de prueba
    const hashDueno = await bcrypt.hash('PasswordSeguro123', 10);
    const hashBarista = await bcrypt.hash('Barista123', 10);
    const hashInactivo = await bcrypt.hash('Inactivo123', 10);
    const hashTemporal = await bcrypt.hash('Temporal123', 10);
    const hashDueno2 = await bcrypt.hash('ParisSeguro123', 10);

    // 3. Usuarios de prueba de Negocio 1
    // Dueño de Taza & Miga
    await conexion.query(`
      INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
      VALUES (?, NULL, 'Dueño Principal', 'Dueño', '7000-0001', TRUE, 'dueno@tazamiga.com', ?, 'DUENO', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE, debe_cambiar_password = FALSE
    `, [negocio1Id, hashDueno]);

    // Barista de Taza & Miga (RN-03)
    await conexion.query(`
      INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
      VALUES (?, 1, 'Carlos Barista', 'Barista', '7000-0002', TRUE, 'barista@tazamiga.com', ?, 'BARISTA', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), rol = 'BARISTA', activo = TRUE, debe_cambiar_password = FALSE
    `, [negocio1Id, hashBarista]);

    // Usuario inactivo (RN-08)
    await conexion.query(`
      INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
      VALUES (?, 1, 'Usuario Inactivo', 'Barista', '7000-0003', TRUE, 'inactivo@tazamiga.com', ?, 'BARISTA', FALSE, FALSE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = FALSE
    `, [negocio1Id, hashInactivo]);

    // Usuario con contraseña temporal (RN-09)
    await conexion.query(`
      INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
      VALUES (?, 1, 'Usuario Temporal', 'Barista', '7000-0004', TRUE, 'temporal@tazamiga.com', ?, 'BARISTA', TRUE, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE, debe_cambiar_password = TRUE
    `, [negocio1Id, hashTemporal]);

    // 4. Dueño de Negocio 2 (RN-01)
    await conexion.query(`
      INSERT INTO usuarios (negocio_id, sucursal_id, nombre, cargo, telefono, acceso_sistema, correo, password_hash, rol, debe_cambiar_password, activo)
      VALUES (?, NULL, 'Dueño Café París', 'Dueño', '7000-0005', TRUE, 'dueno@cafeparis.com', ?, 'DUENO', FALSE, TRUE)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), activo = TRUE
    `, [negocio2Id, hashDueno2]);

    await conexion.commit();
    console.log('✅ Semillas de prueba insertadas correctamente.');
  } catch (error) {
    await conexion.rollback();
    console.error('❌ Error al sembrar datos de prueba:', error);
    process.exit(1);
  } finally {
    conexion.release();
    await pool.end();
  }
}

sembrar();
