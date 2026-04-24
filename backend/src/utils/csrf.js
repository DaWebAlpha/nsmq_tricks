import crypto from "crypto";
import { system_logger } from "../core/pino.logger.js";
import { InternalServerError } from "../errors/internalserver.error.js";

/**
 * ---------------------------------------------------------
 * GENERATE CSRF TOKEN
 * ---------------------------------------------------------
 *
 * Purpose:
 * Generates a cryptographically secure random token for CSRF protection.
 *
 * Security:
 * - Uses crypto.randomBytes (CSPRNG)
 * - 32 bytes → 64 hex characters
 *
 * Guarantees:
 * - Always returns a string
 * - Throws on failure (fail fast)
 *
 * @returns {string} CSRF token (hex string)
 */
const generateCSRFToken = () => {
    try {
        const buffer = crypto.randomBytes(32);

        /**
         * Safety check (paranoid but production-safe)
         */
        if (!buffer || buffer.length !== 32) {
            throw new Error("Invalid random byte length");
        }

        return buffer.toString("hex");
    } catch (error) {
        system_logger.error(
            { err: error },
            "Security: CSRF token generation failed"
        );

        throw new InternalServerError({
            message: "Failed to generate CSRF token",
        });
    }
};

export { generateCSRFToken };
export default generateCSRFToken;