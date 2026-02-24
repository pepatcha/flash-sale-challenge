import app from "./app";
import { config } from "./config";
import { getPool, closePool } from "./services/db.service";
import { getProductByID } from "./services/product.service";
import { getRedis, initStock, closeRedis } from "./services/redis.service";

async function main() {
    console.log("===== STARTING =====");

    const redis = getRedis();
    await redis.ping();
    console.log("Redis connected");

    const pool = getPool();
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected");

    const product = await getProductByID(1);
    if (product) {
        await initStock(product.id, product.stock);
        console.log(`stock initialized: product ${product.id} = ${product.stock}`);
    } else {
        console.warn("product 1 not found run `npm run db:seed` first");
    }

    const server = app.listen(config.port, () => {
        console.log(`server running on http://localhost:${config.port}`);
    });

    server.keepAliveTimeout = 65000;

    const shutdown = async (signal: string) => {
        console.log("===== SHUTTING DOWN =====");
        console.log(`\n${signal} received — shutting down gracefully...`);
        server.close(async () => {
            await closeRedis();
            await closePool();
            console.log("connections closed");
            process.exit(0);
        });
        setTimeout(() => {
            console.error("forced shutdown after timeout");
            process.exit(1);
        }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
    console.log("===== FAILED =====");
    console.error("failed to start server:", err);
    console.log("===== FAILED =====");
    process.exit(1);
});
