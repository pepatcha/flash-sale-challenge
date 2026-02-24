import { getPool } from "./db.service";
import { decrementStock, incrementStock } from "./redis.service";

interface PurchaseResult {
    success: boolean;
    orderID?: number;
    message: string;
}

export async function processPurchase(
    productID: number,
    userID: string,
): Promise<PurchaseResult> {
    const remaining = await decrementStock(productID);
    if (remaining < 0) {
        await incrementStock(productID);
        return { success: false, message: "Sold out" };
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const stockResult = await client.query(
            "SELECT stock FROM products WHERE id = $1 FOR UPDATE",
            [productID]
        );

        if (!stockResult.rows[0] || stockResult.rows[0].stock <= 0) {
            await client.query("ROLLBACK");
            await incrementStock(productID);
            return { success: false, message: "Sold out" };
        }

        await client.query(
            "UPDATE products SET stock = stock - 1, updated_at = NOW() WHERE id = $1",
            [productID]
        );

        const orderResult = await client.query(
            "INSERT INTO orders (product_id, user_id, quantity, status, created_at) VALUES ($1, $2, 1, $3, NOW()) RETURNING id",
            [productID, userID, "confirmed"]
        );

        await client.query("COMMIT");

        return {
            success: true,
            orderID: orderResult.rows[0].id,
            message: "Purchase confirmed",
        };
    } catch (error: any) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("purchase transaction failed:", error.message);

        await incrementStock(productID);
        return { success: false, message: "Purchase failed, please retry" };
    } finally {
        client.release();
    }
}
