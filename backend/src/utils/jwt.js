import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config/config.js";
import { system_logger } from "../core/pino.logger.js";
import { RefreshToken } from "../models/auth/refreshToken.model.js";
import { BadRequestError } from "../errors/badrequest.error.js";
import { InternalServerError } from "../errors/internalserver.error.js";

/**
 * ---------------------------------------------------------
 * JWT CONFIGURATION
 * ---------------------------------------------------------
 *
 * Access Token:
 * - Short-lived token used to authenticate API requests
 *
 * Refresh Token:
 * - Long-lived random token used to issue new access tokens
 *
 * Notes:
 * - Access token expiry is expressed in seconds for jsonwebtoken
 * - Refresh token expiry is expressed in milliseconds for Date math
 */
const JWT_ACCESS_SECRET = config.jwt_access_secret;

if (!JWT_ACCESS_SECRET || typeof JWT_ACCESS_SECRET !== "string") {
    throw new InternalServerError({
        message: "JWT access secret is not configured",
    });
}

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 2 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_TOKEN_BYTE_LENGTH = 32;

/**
 * ---------------------------------------------------------
 * GENERATE ACCESS TOKEN
 * ---------------------------------------------------------
 *
 * Purpose:
 * Creates a signed JWT used for authenticating requests.
 *
 * Payload:
 * - userId (string)
 *
 * Security:
 * - Signed using the configured secret
 * - Short expiry reduces exposure window
 *
 * @param {string|Object} userId
 * @returns {string} Signed JWT access token
 */
const generateAccessToken = (userId) => {
    if (!userId) {
        throw new BadRequestError({
            message: "User ID is required to generate access token",
        });
    }

    return jwt.sign(
        { userId: String(userId) },
        JWT_ACCESS_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS }
    );
};

/**
 * ---------------------------------------------------------
 * VERIFY ACCESS TOKEN
 * ---------------------------------------------------------
 *
 * Purpose:
 * Validates a JWT access token and returns the decoded payload.
 *
 * Behavior:
 * - Throws if token is missing, invalid, or expired
 *
 * @param {string} token
 * @returns {Object} Decoded JWT payload
 */
const verifyAccessToken = (token) => {
    if (typeof token !== "string" || !token.trim()) {
        throw new BadRequestError({
            message: "Access token is required",
        });
    }

    return jwt.verify(token.trim(), JWT_ACCESS_SECRET);
};

/**
 * ---------------------------------------------------------
 * GENERATE REFRESH TOKEN
 * ---------------------------------------------------------
 *
 * Purpose:
 * Creates a secure random refresh token and stores only its hash.
 *
 * Security Design:
 * - Raw token is never stored in the database
 * - Only the hashed token is persisted
 * - Supports multi-device authentication via deviceId
 *
 * Features:
 * - Token rotation support through tokenVersion
 * - Device tracking metadata
 * - Expiration handling
 * - Optional transaction session support
 *
 * @param {Object} params
 * @param {string|Object} params.userId
 * @param {number} [params.tokenVersion=0]
 * @param {string} [params.deviceName=""]
 * @param {string} params.deviceId
 * @param {string|null} [params.userAgent=null]
 * @param {string|null} [params.ipAddress=null]
 * @param {Object|null} [params.session=null]
 *
 * @returns {Promise<string>} Raw refresh token for client delivery
 */
const generateRefreshToken = async ({
    userId,
    tokenVersion = 0,
    deviceName = "",
    deviceId,
    userAgent = null,
    ipAddress = null,
    session = null,
} = {}) => {
    /**
     * Validate required inputs
     */
    if (!userId) {
        throw new BadRequestError({
            message: "User ID is required to generate refresh token",
        });
    }

    if (typeof deviceId !== "string" || !deviceId.trim()) {
        throw new BadRequestError({
            message: "Device ID is required to generate refresh token",
        });
    }

    /**
     * Generate secure random token
     */
    const rawToken = crypto
        .randomBytes(REFRESH_TOKEN_BYTE_LENGTH)
        .toString("hex");

    /**
     * Hash token before persistence
     */
    const tokenHash = RefreshToken.hashToken(rawToken);

    /**
     * Normalize metadata
     */
    const normalizedDeviceId = deviceId.trim();
    const normalizedDeviceName =
        typeof deviceName === "string" ? deviceName.trim() : "";
    const normalizedUserAgent =
        typeof userAgent === "string" && userAgent.trim()
            ? userAgent.trim()
            : null;
    const normalizedIpAddress =
        typeof ipAddress === "string" && ipAddress.trim()
            ? ipAddress.trim()
            : null;

    try {
        /**
         * Persist refresh token record
         */
        await RefreshToken.create(
            [
                {
                    userId,
                    tokenHash,
                    tokenVersion,
                    deviceName: normalizedDeviceName,
                    deviceId: normalizedDeviceId,
                    userAgent: normalizedUserAgent,
                    ipAddress: normalizedIpAddress,
                    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
                    lastUsedAt: new Date(),
                },
            ],
            session ? { session } : {}
        );
    } catch (error) {
        system_logger.error(
            { err: error, userId: String(userId), deviceId: normalizedDeviceId },
            "Security: Failed to persist refresh token"
        );

        throw new InternalServerError({
            message: "Internal security error",
        });
    }

    /**
     * Return raw token to client
     */
    return rawToken;
};

export {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
};

export default {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
};