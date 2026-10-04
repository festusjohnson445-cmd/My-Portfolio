// src/db/index.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool (Object Method)
export const createPool = () => {
  if (!global._postgresPool) {
    const isSocket = Boolean(process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/'));
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      ...(isSocket ? {} : { port: 5432 }),
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.warn('PostgreSQL pool connection note:', err?.message || err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

/**
 * Extract all error messages and causes recursively
 */
function extractErrorString(err: any): string {
  if (!err) return '';
  const msg = err.message || '';
  const causeMsg = err.cause?.message || (typeof err.cause === 'string' ? err.cause : '');
  const causeStr = err.cause ? String(err.cause) : '';
  const stack = err.stack || '';
  return `${msg} ${causeMsg} ${causeStr} ${stack} ${String(err)}`.toLowerCase();
}

/**
 * Execute a database operation with automatic retry on transient connection drops
 */
export async function withDbRetry<T>(operation: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const fullErrStr = extractErrorString(err);
      
      const isConnectionIssue = 
        fullErrStr.includes('connection terminated') ||
        fullErrStr.includes('connection timeout') ||
        fullErrStr.includes('timeout') ||
        fullErrStr.includes('econnreset') ||
        fullErrStr.includes('closed connection') ||
        fullErrStr.includes('connection refused') ||
        fullErrStr.includes('terminating connection') ||
        fullErrStr.includes('unexpectedly') ||
        fullErrStr.includes('socket') ||
        fullErrStr.includes('client has already been dismissed');

      if (isConnectionIssue && attempt < maxRetries) {
        console.warn(`[DB Retry] Attempt ${attempt}/${maxRetries} connection drop detected (${err?.cause?.message || err?.message}). Re-establishing connection in ${attempt * 250}ms...`);
        
        // Ping pool to force cleanup of dead sockets
        try {
          await pool.query('SELECT 1');
        } catch (_) {
          // Ignore ping errors as pool drops dead sockets on failed query
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
