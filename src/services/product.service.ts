import { getPool } from "./db.service";

export interface Product {
    id: number;
    name: string;
    description: string | null;
    price: string; // pg return DECIMAL as string
    stock: number;
    created_at: Date;
    updated_at: Date;
}

export async function getProductByID(id: number): Promise<Product | null> {
    const pool = getPool();
    const result = await pool.query<Product>(
        "SELECT * FROM products WHERE id = $1",
        [id]
    );
    return result.rows[0] || null;
}
