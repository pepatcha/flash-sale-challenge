import dotenv from "dotenv";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

dotenv.config();

import app from "../src/app";
import { config } from "../src/config";
import { closePool, getPool } from "../src/services/db.service";
import { initStock, getStock, closeRedis, getRedis } from "../src/services/redis.service";

const pool = getPool();
const STOCK = config.initialStock;

beforeAll(async () => {
    await getRedis().ping();
    await pool.query("SELECT 1");
    await pool.query("DELETE FROM orders");
    await pool.query("DELETE FROM products");
});

afterAll(async () => {
    await closeRedis();
    await closePool();
});

beforeEach(async () => {
    await pool.query("DELETE FROM orders");
    await pool.query("DELETE FROM products");
    await pool.query("ALTER SEQUENCE orders_id_seq RESTART WITH 1");
    await pool.query("ALTER SEQUENCE products_id_seq RESTART WITH 1");

    await pool.query(
        "INSERT INTO products (id, name, description, price, stock) VALUES ($1, $2, $3, $4, $5)",
        [1, "Limited Edition Item", "Test product", 1990.0, STOCK]
    );

    await initStock(1, STOCK);
});

describe("GET /api/products/:id", () => {
    it("should return product info with stock", async () => {
        const res = await request(app).get("/api/products/1");

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(1);
        expect(res.body.name).toBe("Limited Edition Item");
        expect(res.body.price).toBe(1990);
        expect(res.body.stock).toBe(STOCK);
        expect(res.body.isSoldOut).toBe(false);
    });

    it("should return 404 for non-existent product", async () => {
        const res = await request(app).get("/api/products/999");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Product not found");
    });

    it("should return 400 for invalid product ID", async () => {
        const res = await request(app).get("/api/products/abc");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid product ID");
    });
});

describe("GET /api/products/:id/stock", () => {
    it("should return current stock from Redis", async () => {
        const res = await request(app).get("/api/products/1/stock");

        expect(res.status).toBe(200);
        expect(res.body.stock).toBe(STOCK);
        expect(res.body.isSoldOut).toBe(false);
    });

    it("should reflect stock changes", async () => {
        await initStock(1, 3);
        const res = await request(app).get("/api/products/1/stock");

        expect(res.status).toBe(200);
        expect(res.body.stock).toBe(3);
        expect(res.body.isSoldOut).toBe(false);
    });
});

describe("POST /api/purchase", () => {
    it("should successfully purchase when stock available", async () => {
        const res = await request(app)
            .post("/api/purchase")
            .send({ productID: 1, userID: "user-1" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.orderID).toBeDefined();
        expect(res.body.message).toBe("Purchase confirmed");

        // Verify stock decremented
        const stock = await getStock(1);
        expect(stock).toBe(STOCK - 1);

        // Verify order in DB
        const orders = await pool.query("SELECT * FROM orders");
        expect(orders.rows).toHaveLength(1);
        expect(orders.rows[0].user_id).toBe("user-1");
        expect(orders.rows[0].status).toBe("confirmed");
    });

    it("should return 409 when stock is exhausted", async () => {
        // Set stock to 0
        await initStock(1, 0);
        await pool.query("UPDATE products SET stock = 0 WHERE id = 1");

        const res = await request(app)
            .post("/api/purchase")
            .send({ productID: 1, userID: "user-late" });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Sold out");
    });

    it("should return 400 when missing fields", async () => {
        const res = await request(app).post("/api/purchase").send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("productID and userID are required");
    });

    it(`should sell exactly ${STOCK} items — no more, no less`, async () => {
        // purchase all items sequentially (STOCK + 5)
        const results = [];
        for (let i = 1; i <= STOCK + 5; i++) {
            const res = await request(app)
                .post("/api/purchase")
                .send({ productID: 1, userID: `user-${i}` });
            results.push(res.body);
        }

        const successful = results.filter((r) => r.success === true);
        const failed = results.filter((r) => r.success === false);

        expect(successful).toHaveLength(STOCK);
        expect(failed).toHaveLength(5);

        const orders = await pool.query("SELECT COUNT(*) FROM orders");
        expect(parseInt(orders.rows[0].count)).toBe(STOCK);

        // stock = 0
        const stock = await getStock(1);
        expect(stock).toBe(0);
    });

    it("should handle concurrent purchases without overselling", async () => {
        const totalRequests = STOCK * 5;
        const promises = Array.from({ length: totalRequests }, (_, i) =>
            request(app)
                .post("/api/purchase")
                .send({ productID: 1, userID: `concurrent-user-${i}` })
        );

        const responses = await Promise.all(promises);
        const successful = responses.filter((r) => r.status === 200);
        const soldOut = responses.filter((r) => r.status === 409);

        expect(successful).toHaveLength(STOCK);
        expect(soldOut).toHaveLength(totalRequests - STOCK);

        const orders = await pool.query("SELECT COUNT(*) FROM orders");
        expect(parseInt(orders.rows[0].count)).toBe(STOCK);

        // Redis stock = 0
        const stock = await getStock(1);
        expect(stock).toBe(0);

        // DB stock = 0
        const product = await pool.query("SELECT stock FROM products WHERE id = 1");
        expect(product.rows[0].stock).toBe(0);
    });
});
