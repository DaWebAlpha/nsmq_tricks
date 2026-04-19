import mongoose from "mongoose";
import { config } from "../config/config.js";
import { system_logger } from "./pino.logger.js";

/**
 * MongoDB Connection URI
 */
const MONGO_URI = config.mongo_uri;

/**
 * Database Connection Utility
 */
const databaseConnection = async () => {
    /**
     * Prevent duplicate connections
     */
    if (mongoose.connection.readyState === 1) {
        system_logger.warn("MongoDB already connected");
        return;
    }

    try {
        /**
         * Connection options (should ideally come from config)
         */
        const options = {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            autoIndex: config.node_env !== "production",
        };

        await mongoose.connect(MONGO_URI, options);

        system_logger.info("MongoDB connected successfully");

    } catch (error) {
        system_logger.error({ err: error }, "MongoDB connection failed");
        throw new Error("MongoDB connection failed");
    }
};

/**
 * MongoDB Connection Event Listeners
 */

/**
 * Connected
 */
mongoose.connection.on("connected", () => {
    system_logger.info("MongoDB connection established");
});

/**
 * Reconnected
 */
mongoose.connection.on("reconnected", () => {
    system_logger.warn("MongoDB reconnected");
});

/**
 * Disconnected
 */
mongoose.connection.on("disconnected", () => {
    system_logger.warn("MongoDB connection lost");
});

/**
 * Error
 */
mongoose.connection.on("error", (err) => {
    system_logger.error({ err }, "MongoDB connection error");
});

export { databaseConnection };
export default databaseConnection;