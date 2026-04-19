import Redis from "ioredis";
import config from "../config/config.js";
import { system_logger } from "./pino.logger.js";

/**
 * ---------------------------------------------------------
 * REDIS CONFIGURATION
 * ---------------------------------------------------------
 *
 * Purpose:
 * Resolve and validate the Redis connection URI before client creation.
 */
const REDIS_URI = config.redis_uri;

if (!REDIS_URI) {
    throw new Error("Missing Redis connection string: config.redis_uri");
}

/**
 * ---------------------------------------------------------
 * REDIS CLIENT
 * ---------------------------------------------------------
 *
 * Purpose:
 * Create a singleton Redis client for shared use across the application.
 *
 * Production Notes:
 * - maxRetriesPerRequest: prevents infinite hanging requests
 * - enableOfflineQueue: avoids silently queueing commands forever
 * - lazyConnect: allows controlled connection startup
 * - retryStrategy: provides bounded reconnect backoff
 */
const redis = new Redis(REDIS_URI, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
    },
});

/**
 * ---------------------------------------------------------
 * REDIS EVENT LOGGING
 * ---------------------------------------------------------
 *
 * Purpose:
 * Provide visibility into Redis lifecycle and connectivity state.
 */
redis.on("connect", () => {
    system_logger.info("Redis TCP connection established");
});

redis.on("ready", () => {
    system_logger.info("Redis client is ready for commands");
});

redis.on("error", (error) => {
    system_logger.error({ err: error }, "Redis connection error");
});

redis.on("close", () => {
    system_logger.warn("Redis connection closed");
});

redis.on("reconnecting", () => {
    system_logger.warn("Redis client reconnecting");
});

redis.on("end", () => {
    system_logger.warn("Redis connection ended");
});

/**
 * ---------------------------------------------------------
 * REDIS CONNECTION HELPERS
 * ---------------------------------------------------------
 *
 * Purpose:
 * Centralize startup and shutdown behavior for application lifecycle hooks.
 */
export const connectRedis = async () => {
    await redis.connect();
    return redis;
};

export const disconnectRedis = async () => {
    await redis.quit();
};

/**
 * Singleton Redis client export.
 */
export default redis;