import crypto from "node:crypto";

/**
 * ---------------------------------------------------------
 * EXTRACT CLIENT IP ADDRESS
 * ---------------------------------------------------------
 *
 * Purpose:
 * Retrieves the most accurate client IP address from the request object.
 *
 * Strategy (priority order):
 * 1. Express-provided request.ip
 * 2. x-forwarded-for (for trusted proxied environments)
 * 3. x-real-ip (alternative proxy header)
 * 4. socket.remoteAddress
 * 5. "unknown" fallback
 *
 * Notes:
 * - request.ip is preferred when Express trust proxy is configured correctly
 * - x-forwarded-for may contain multiple IPs; the first one is usually the client
 * - All values are trimmed to avoid whitespace issues
 *
 * @param {Object} request - Express request object
 * @returns {string} Client IP address
 */
const getClientIP = (request) => {
    const raw =
        request.ip ||
        request.headers["x-forwarded-for"]?.split(",")[0] ||
        request.headers["x-real-ip"] ||
        request.socket?.remoteAddress ||
        "unknown";

    return String(raw || "").trim();
};

/**
 * ---------------------------------------------------------
 * EXTRACT USER AGENT
 * ---------------------------------------------------------
 *
 * Purpose:
 * Retrieves the client user-agent string.
 *
 * Usage:
 * - Device/browser identification
 * - Logging and analytics
 * - Security monitoring
 *
 * @param {Object} request - Express request object
 * @returns {string|null} User agent string
 */
const getUserAgent = (request) => {
    return request.headers["user-agent"] || null;
};

/**
 * ---------------------------------------------------------
 * EXTRACT DEVICE NAME
 * ---------------------------------------------------------
 *
 * Purpose:
 * Retrieves a human-readable device name from the request.
 *
 * Sources (priority order):
 * - Request body (device_name)
 * - Custom headers (x-device-name, device-name)
 *
 * Notes:
 * - Used for labeling user sessions/devices
 * - Returns an empty string if not provided
 *
 * @param {Object} request - Express request object
 * @returns {string} Device name
 */
const getDeviceName = (request) => {
    const raw =
        request.body?.device_name ||
        request.headers["x-device-name"] ||
        request.headers["device-name"] ||
        "";

    return String(raw || "").trim();
};

/**
 * ---------------------------------------------------------
 * EXTRACT OR GENERATE DEVICE ID
 * ---------------------------------------------------------
 *
 * Purpose:
 * Retrieves a unique device identifier or generates one if missing.
 *
 * Sources (priority order):
 * - Request body (device_id)
 * - Custom headers (x-device-id, device-id)
 *
 * Behavior:
 * - If no device ID is provided, generates a new UUID
 * - Ensures every device session can be uniquely tracked
 *
 * Use Cases:
 * - Multi-device authentication
 * - Refresh token tracking
 * - Session management
 *
 * @param {Object} request - Express request object
 * @returns {string} Device ID
 */
const getDeviceId = (request) => {
    const raw =
        request.body?.device_id ||
        request.headers["x-device-id"] ||
        request.headers["device-id"] ||
        "";

    return String(raw || "").trim() || crypto.randomUUID();
};

export {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
};

export default {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
};