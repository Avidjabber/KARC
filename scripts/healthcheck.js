import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT 1')
    .then(() => { pool.end(); process.exit(0); })
    .catch(err => { console.error('[healthcheck] DB unreachable:', err.message); pool.end(); process.exit(1); });
