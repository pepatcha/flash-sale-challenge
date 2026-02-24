import Redis from "ioredis";
import { config } from "../config";

let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            maxRetriesPerRequest: 3,
        });
    }
    return redis;
}

export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}

export async function initStock(
    productID: number,
    quantity: number,
): Promise<void> {
    const r = getRedis();
    await r.set(`flash:stock:${productID}`, quantity);
}

export async function decrementStock(productID: number): Promise<number> {
    const r = getRedis();
    return r.decr(`flash:stock:${productID}`);
}

export async function incrementStock(productID: number): Promise<void> {
    const r = getRedis();
    await r.incr(`flash:stock:${productID}`);
}

export async function getStock(productID: number): Promise<number> {
    const r = getRedis();
    const stock = await r.get(`flash:stock:${productID}`);
    return stock ? parseInt(stock, 10) : 0;
}
