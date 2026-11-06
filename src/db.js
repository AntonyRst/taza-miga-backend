import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const configuracionSsl = process.env.DB_SSL === 'true'
  ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
    }
  : undefined;

/**
 * Pool de conexiones a MariaDB.
 * Las consultas SQL se ejecutan a través de este pool en los repositorios.
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taza_miga',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: '+00:00',
  ...(configuracionSsl ? { ssl: configuracionSsl } : {})
});

export default pool;
