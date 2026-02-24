import dotenv from "dotenv";
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || "3000", 10),
    db: {
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        password: process.env.DB_PASSWORD || "secret",
        name: process.env.DB_NAME || "flash_sales",
    },
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
    initialStock: parseInt(process.env.INITIAL_STOCK || "10", 10),
};
