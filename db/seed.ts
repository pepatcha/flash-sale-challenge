import { Pool } from "pg";
import { config } from "../src/config";

const pool = new Pool({
    user: config.db.user,
    host: config.db.host,
    port: config.db.port,
    password: config.db.password,
    database: config.db.name,
});

async function seed() {
    const client = await pool.connect();

    try {
        await client.query("DELETE FROM orders");
        await client.query("DELETE FROM products");
        await client.query("ALTER SEQUENCE products_id_seq RESTART WITH 1");
        await client.query("ALTER SEQUENCE orders_id_seq RESTART WITH 1");

        const result = await client.query(
            "INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING id, name, stock",
            ["Limited Edition Item", `Exclusive flash sale product — only ${config.initialStock} available!`, 1990.0, config.initialStock]
        );

        const product = result.rows[0];
        console.log(`seeded product: ${product.name} (id: ${product.id}, stock: ${product.stock})`);
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch((e) => {
    console.error("seed failed:", e);
    process.exit(1);
});
