import express, { Request, Response, NextFunction } from "express";
import purchaseRoutes from "./routes/purchase";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", purchaseRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
});

export default app;
