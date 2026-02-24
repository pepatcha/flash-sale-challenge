import { Pool } from "pg";
import Redis from "ioredis";
import { config } from "../src/config";

async function reset() {
    const pool = new Pool({
        user: config.db.user,
        host: config.db.host,
        port: config.db.port,
        password: config.db.password,
        database: config.db.name,
    });
    const redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
    });

    await pool.query("DELETE FROM orders");
    await pool.query("DELETE FROM products");
    await pool.query("ALTER SEQUENCE orders_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE products_id_seq RESTART WITH 1");

    await pool.query(
        "INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4)",
        [
            "Limited Edition Item",
            `Exclusive flash sale product — only ${config.initialStock} available!`,
            1990.0,
            config.initialStock,
        ]
    );

    await redis.set("flash:stock:1", config.initialStock);
    console.log(`Reset complete: product stock = ${config.initialStock}, Redis stock = ${config.initialStock}`);

    await pool.end();
    await redis.quit();
}

reset().catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
});
