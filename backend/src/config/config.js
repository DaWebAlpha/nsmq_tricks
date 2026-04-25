import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

/**
 * ---------------------------------------------------------
 * RESOLVE CURRENT DIRECTORY (ESM SAFE)
 * ---------------------------------------------------------
 * Node.js ES modules do not provide __dirname by default.
 * This reconstructs it using fileURLToPath to ensure
 * compatibility across environments.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ---------------------------------------------------------
 * LOAD ENVIRONMENT VARIABLES
 * ---------------------------------------------------------
 * Loads variables from the .env file located at project root.
 *
 * Behavior:
 * - Uses explicit path resolution for predictable loading
 * - Ensures configuration is available before application bootstrap
 *
 * Note:
 * In containerized/cloud environments, process.env is usually
 * injected externally and this step may be optional.
 */
dotenv.config({
    path: join(__dirname, "../../../.env"),
});

/**
 * ---------------------------------------------------------
 * EXTRACT ENVIRONMENT VARIABLES
 * ---------------------------------------------------------
 * Destructure all environment variables from process.env
 * for validation and structured configuration usage.
 */
const {
    PORT,
    MONGO_URI,
    NODE_ENV,
    LOG_LEVEL,
    REDIS_URI,
    MAX_FAILED_ATTEMPTS,
    LOCK_DURATION,
    JWT_ACCESS_SECRET,
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    SUBSCRIPTION_EXPIRY_TIME,
} = process.env;

/**
 * ---------------------------------------------------------
 * REQUIRED ENVIRONMENT VARIABLES VALIDATION
 * ---------------------------------------------------------
 * These variables are critical for system operation.
 *
 * Behavior:
 * - Ensures all required variables exist
 * - Ensures values are non-empty strings
 * - Fails fast if any required variable is missing
 */
const required = {
    MONGO_URI,
    REDIS_URI,
    JWT_ACCESS_SECRET,
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
};

for (const [key, value] of Object.entries(required)) {
    if (!value || !String(value).trim()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

/**
 * ---------------------------------------------------------
 * SECURITY VALIDATION
 * ---------------------------------------------------------
 * Enforces minimum security requirements for sensitive values.
 *
 * Example:
 * - JWT secret must be sufficiently long to prevent brute force attacks
 */
if (JWT_ACCESS_SECRET.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}

/**
 * ---------------------------------------------------------
 * SAFE POSITIVE INTEGER PARSER
 * ---------------------------------------------------------
 * Converts environment variables to positive integers safely.
 *
 * Behavior:
 * - Returns parsed value if it is a valid positive integer
 * - Falls back to a default value if invalid
 *
 * Purpose:
 * - Prevents invalid, floating-point, or negative values
 */
const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};



/**
 * ---------------------------------------------------------
 * NODE ENVIRONMENT VALIDATION
 * ---------------------------------------------------------
 * Restricts NODE_ENV to allowed values.
 *
 * Allowed:
 * - development
 * - production
 * - test
 *
 * Behavior:
 * - Throws error if invalid
 * - Prevents accidental misconfiguration in production
 */
const resolvedNodeEnv = NODE_ENV || "development";

const allowedNodeEnvs = ["development", "production", "test"];
if (!allowedNodeEnvs.includes(resolvedNodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${resolvedNodeEnv}`);
}


/**
 * ---------------------------------------------------------
 * LOG LEVEL VALIDATION
 * ---------------------------------------------------------
 * Restricts logging level to known values supported by logger.
 *
 * Allowed:
 * - fatal, error, warn, info, debug, trace
 *
 * Behavior:
 * - Defaults to "info" if invalid or undefined
 */
const allowedLogLevels = ["fatal", "error", "warn", "info", "debug", "trace"];

const safeLogLevel = allowedLogLevels.includes(LOG_LEVEL)
    ? LOG_LEVEL
    : "info";

    
/**
 * ---------------------------------------------------------
 * FINAL CONFIG OBJECT
 * ---------------------------------------------------------
 * Centralized configuration object used across the application.
 *
 * Properties:
 * - Fully validated
 * - Type-safe (numbers converted where required)
 * - Immutable (cannot be modified at runtime)
 *
 * Security Note:
 * - Sensitive values (e.g., secrets, URIs) should never be logged
 */
const config = Object.freeze({
    /**
     * Application server port
     */
    port: toPositiveInt(PORT, 4000),

    /**
     * MongoDB connection string
     */
    mongo_uri: MONGO_URI,

    /**
     * Runtime environment
     */
    node_env: resolvedNodeEnv,

    /**
     * Logging level
     */
    log_level: safeLogLevel,

    /**
     * Redis connection string
     */
    redis_uri: REDIS_URI,

    /**
     * Maximum failed login attempts before account lock
     */
    max_failed_attempts: toPositiveInt(MAX_FAILED_ATTEMPTS, 5),

    /**
     * Account lock duration (milliseconds)
     */
    lock_duration: toPositiveInt(LOCK_DURATION, 900000),

    /**
     * JWT access token secret
     */
    jwt_access_secret: JWT_ACCESS_SECRET,

    /**
     * Cookie name for access token
     */
    access_token_cookie_name: ACCESS_TOKEN_COOKIE_NAME,

    /**
     * Cookie name for refresh token
     */
    refresh_token_cookie_name: REFRESH_TOKEN_COOKIE_NAME,

    subscription_expiry_time: toPositiveInt(SUBSCRIPTION_EXPIRY_TIME, 60 * 24 * 365 * 60000) // ONE YEAR IN MILLISECONDS
});

/**
 * ---------------------------------------------------------
 * DEBUG (OPTIONAL)
 * ---------------------------------------------------------
 * Use for debugging non-sensitive values only.
 *
 * WARNING:
 * Never log secrets, tokens, or database URIs in production.
 */
/*
console.log({
    PORT: config.port,
    NODE_ENV: config.node_env,
    LOG_LEVEL: config.log_level,
});
*/

/**
 * ---------------------------------------------------------
 * EXPORT CONFIGURATION
 * ---------------------------------------------------------
 * Provides a single source of truth for application settings.
 */
export { config };
export default config;