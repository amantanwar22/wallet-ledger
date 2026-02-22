import pg from 'pg';
import env from './env.js';
import logger from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

/**
 * Execute a single query, using pool directly.
 * @param {string} text - Parameterized SQL query
 * @param {Array} params - Query parameters
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Get a dedicated client from the pool, used for transactions.
 * Remember to call client.release() in a finally block.
 */
export const getClient = () => pool.connect();

/**
 * Run a function inside a PostgreSQL transaction.
 * Automatically commits on success or rolls back on error.
 *
 * @param {function} fn - Async function that receives (client) as argument
 * @returns {Promise<*>} resolves to the return value of fn
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Health check — ping the database.
 */
export const ping = async () => {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
};

/**
 * Gracefully close all pool connections (used on SIGTERM).
 */
export const closePool = () => pool.end();

export default pool;
