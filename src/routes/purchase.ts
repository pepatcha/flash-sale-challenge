import { Router, Request, Response } from "express";
import { getStock } from "../services/redis.service";
import { getProductByID } from "../services/product.service";
import { processPurchase } from "../services/purchase.service";

const router = Router();

router.get("/products/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        res.status(400).json({ error: "Invalid product ID" });
        return;
    }

    const product = await getProductByID(id);
    if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
    }

    const stock = await getStock(id);

    res.json({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        stock,
        isSoldOut: stock <= 0,
    });
});

router.get("/products/:id/stock", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        res.status(400).json({ error: "Invalid product ID" });
        return;
    }

    const stock = await getStock(id);

    res.json({
        productID: id,
        stock,
        isSoldOut: stock <= 0,
    });
});

router.post("/purchase", async (req: Request, res: Response) => {
    const { productID, userID } = req.body;

    if (productID === undefined || productID === null) {
        res.status(400).json({ error: "productID and userID are required" });
        return;
    }

    const pid = typeof productID === "number" ? productID : parseInt(productID, 10);
    if (isNaN(pid) || pid <= 0) {
        res.status(400).json({ error: "productID must be a positive number" });
        return;
    }

    if (!userID || typeof userID !== "string" || userID.trim().length === 0) {
        res.status(400).json({ error: "productID and userID are required" });
        return;
    }

    if (userID.length > 255) {
        res.status(400).json({ error: "userID is too long" });
        return;
    }

    const result = await processPurchase(pid, userID.trim());

    if (result.success) {
        res.status(200).json(result);
    } else if (result.message === "Sold out") {
        res.status(409).json(result);
    } else {
        res.status(500).json(result);
    }
});

export default router;
