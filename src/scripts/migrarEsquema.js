import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const carpetaDatabase = path.resolve(__dirname, '../../database');

/**
 * Ejecuta en orden secuencial los archivos de creación de esquema (.sql)
 * ubicados en backend/database/, omitiendo archivos de semillas para
 * mantener la base de datos limpia antes de sembrar el catálogo base.
 */
export async function migrarEsquema() {
  console.log('====================================================');
  console.log('   TAZA & MIGA - MIGRACIÓN DE ESQUEMA SQL (AIVEN)');
  console.log('====================================================\n');

  const archivos = fs
    .readdirSync(carpetaDatabase)
    .filter((archivo) => archivo.endsWith('.sql') && !archivo.includes('semillas'))
    .sort((a, b) => a.localeCompare(b));

  const conexion = await pool.getConnection();

  try {
    for (const archivo of archivos) {
      const rutaArchivo = path.join(carpetaDatabase, archivo);
      const contenido = fs.readFileSync(rutaArchivo, 'utf8');

      // Eliminar líneas de comentario y separar por punto y coma
      const sinComentarios = contenido
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('--'))
        .join('\n');

      const sentencias = sinComentarios
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const sentencia of sentencias) {
        await conexion.query(sentencia);
      }

      console.log(`✅ Ejecutado correctamente: ${archivo} (${sentencias.length} sentencia(s))`);
    }

    const [tablas] = await conexion.query('SHOW TABLES');
    console.log(`\n🎉 Esquema migrado con éxito. Total de tablas en la base de datos: ${tablas.length}`);
  } catch (error) {
    console.error('\n❌ Error durante la migración del esquema SQL:', error.message);
    throw error;
  } finally {
    conexion.release();
  }
}

if (process.argv[1]?.endsWith('migrarEsquema.js')) {
  migrarEsquema()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}
