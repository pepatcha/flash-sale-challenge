import { Pool } from "pg";
import { config } from "../src/config";

const pool = new Pool({
    user: config.db.user,
    host: config.db.host,
    port: config.db.port,
    password: config.db.password,
    database: config.db.name,
});

async function migrate() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id),
                user_id VARCHAR(255) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        await client.query("CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders (product_id);");
        await client.query("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);");

        await client.query("COMMIT");
        console.log("migration completed");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((e) => {
    console.error("migration failed:", e);
    process.exit(1);
});
