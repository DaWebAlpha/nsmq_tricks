import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../config/config.js";

/**
 * ---------------------------------------------------------
 * RESOLVE CURRENT DIRECTORY
 * ---------------------------------------------------------
 *
 * Purpose:
 * Reconstruct __dirname for ESM modules.
 *
 * Why this exists:
 * Node.js ES modules do not provide __dirname by default.
 * This ensures all file system paths are resolved reliably.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ---------------------------------------------------------
 * ENVIRONMENT AND LOG LEVEL
 * ---------------------------------------------------------
 *
 * Purpose:
 * Determines runtime mode and the default minimum log level.
 *
 * Behavior:
 * - development -> debug
 * - production  -> info
 */
const isDevelopment = config.node_env === "development";
const logLevel = isDevelopment ? "debug" : "info";

/**
 * ---------------------------------------------------------
 * LOG DIRECTORY
 * ---------------------------------------------------------
 *
 * Purpose:
 * Defines the absolute base directory where log files are stored.
 *
 * Important:
 * Using an absolute path avoids issues caused by different
 * process working directories in development, PM2, Docker,
 * systemd, or cloud deployments.
 */
const logDirectory = path.resolve(__dirname, "../../../logs");

/**
 * Ensure the log directory exists before transports write files.
 */
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

/**
 * ---------------------------------------------------------
 * TRANSPORT TARGET FACTORY
 * ---------------------------------------------------------
 *
 * Purpose:
 * Builds a reusable pino transport target configuration for
 * file-based logging with rotation support.
 *
 * Features:
 * - Writes logs to a dedicated file
 * - Rotates by frequency and size
 * - Stores output as JSON
 * - Retains a fixed number of rotated files
 *
 * @param {string} fileLocation - Relative file path inside log directory
 * @param {string} frequency - Rotation frequency (example: "daily")
 * @param {string} fileSize - Maximum file size before rotation (example: "20m")
 * @param {string} minLevel - Minimum log level handled by this target
 * @param {number} retentionCount - Number of rotated files to retain
 *
 * @returns {Object} Pino transport target definition
 */
const buildTransportTarget = (
    fileLocation,
    frequency,
    fileSize,
    minLevel = "info",
    retentionCount
) => ({
    target: "pino-roll",
    level: minLevel,
    options: {
        file: path.join(logDirectory, fileLocation),
        extension: ".json",
        frequency,
        size: fileSize,
        mkdir: true,
        dateFormat: "yyyy-MM-dd",
        sync: false,
        limit: {
            count: retentionCount,
        },
    },
});

/**
 * ---------------------------------------------------------
 * TERMINAL TARGETS
 * ---------------------------------------------------------
 *
 * Purpose:
 * Adds developer-friendly terminal output in development mode.
 *
 * Production behavior:
 * - No pretty terminal transport is attached
 * - Production continues writing structured JSON logs only
 */
const terminalTargets = isDevelopment
    ? [
          {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  ignore: "pid,hostname",
                  translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
              },
          },
      ]
    : [];

/**
 * ---------------------------------------------------------
 * SYSTEM LOG TRANSPORT
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles general application and runtime logs.
 *
 * Output:
 * - info-level file
 * - error-level file
 * - terminal pretty output in development
 */
const systemTransport = pino.transport({
    targets: [
        buildTransportTarget("system/app-info", "daily", "20m", "info", 90),
        buildTransportTarget("system/app-error", "daily", "20m", "error", 90),
        ...terminalTargets,
    ],
});

/**
 * ---------------------------------------------------------
 * AUDIT LOG TRANSPORT
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles audit and compliance-oriented events such as
 * authentication actions, privileged changes, and security events.
 */
const auditTransport = pino.transport({
    targets: [
        buildTransportTarget("audit/app-audit", "daily", "20m", "info", 180),
        ...terminalTargets,
    ],
});

/**
 * ---------------------------------------------------------
 * ACCESS LOG TRANSPORT
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles request and traffic logging for tracing,
 * observability, and operational analysis.
 */
const accessTransport = pino.transport({
    targets: [
        buildTransportTarget("access/app-access", "daily", "20m", "info", 180),
        ...terminalTargets,
    ],
});

/**
 * ---------------------------------------------------------
 * BASE LOGGER CONFIGURATION
 * ---------------------------------------------------------
 *
 * Purpose:
 * Provides the shared configuration used by all logger instances.
 *
 * Features:
 * - Sets the minimum log level
 * - Uses ISO timestamps
 * - Redacts sensitive fields
 * - Adds readable level labels
 *
 * Security:
 * Sensitive fields such as passwords, tokens, API keys,
 * authorization headers, and cookies are removed from logs.
 *
 * @returns {Object} Shared pino configuration
 */
const getBaseConfig = () => ({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,

    /**
     * Redact sensitive fields from log payloads.
     *
     * remove: true
     * Completely removes matching fields from the final log output.
     */
    redact: {
        paths: [
            "password",
            "*.password",
            "token",
            "*.token",
            "access_token",
            "refresh_token",
            "*.access_token",
            "*.refresh_token",
            "accessToken",
            "*.accessToken",
            "refreshToken",
            "*.refreshToken",
            "apiKey",
            "*.apiKey",
            "authorization",
            "*.authorization",
            "headers.authorization",
            "*.headers.authorization",
            "cookie",
            "*.cookie",
            "headers.cookie",
            "*.headers.cookie",
            "req.headers.authorization",
            "req.headers.cookie",
        ],
        remove: true,
    },

    /**
     * Add a readable label for numeric pino levels.
     *
     * Example:
     * - 30 -> info
     * - 50 -> error
     */
    mixin(_context, levelNumber) {
        const labels = {
            10: "trace",
            20: "debug",
            30: "info",
            40: "warn",
            50: "error",
            60: "fatal",
        };

        return {
            level_label: labels[levelNumber] || "info",
        };
    },
});

/**
 * ---------------------------------------------------------
 * LOGGER INSTANCES
 * ---------------------------------------------------------
 *
 * Purpose:
 * Exposes dedicated loggers for different logging domains.
 */

export const system_logger = pino(getBaseConfig(), systemTransport);
export const audit_logger = pino(getBaseConfig(), auditTransport);
export const access_logger = pino(getBaseConfig(), accessTransport);

export const loggers = {
    system_logger,
    audit_logger,
    access_logger,
};

export default loggers;
