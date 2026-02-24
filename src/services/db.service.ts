import { Pool } from "pg";
import { config } from "../config";

let pool: Pool | null = null;

export function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            user: config.db.user,
            host: config.db.host,
            port: config.db.port,
            password: config.db.password,
            database: config.db.name,
            max: 20, // connection pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }
    return pool;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
