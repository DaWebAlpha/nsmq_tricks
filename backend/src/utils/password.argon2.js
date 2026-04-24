import argon2 from "argon2";
import { system_logger } from "../core/pino.logger.js";
import { BadRequestError } from "../errors/badrequest.error.js";
import { InternalServerError } from "../errors/internalserver.error.js";

/**
 * ---------------------------------------------------------
 * ARGON2 CONFIGURATION
 * ---------------------------------------------------------
 *
 * Purpose:
 * Defines the hashing parameters used for password security.
 *
 * Notes:
 * - argon2id: Recommended variant
 * - memoryCost: Memory hardness factor
 * - timeCost: Iteration count
 * - parallelism: Degree of parallel execution
 * - hashLength: Output hash length
 */
const ARGON_CONFIG = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 2,
    hashLength: 32,
};

/**
 * ---------------------------------------------------------
 * HASH PASSWORD
 * ---------------------------------------------------------
 *
 * Purpose:
 * Securely hashes a plain-text password using Argon2.
 *
 * Important:
 * - Passwords must NOT be trimmed or normalized
 * - Leading/trailing spaces are part of the password
 *
 * @param {string} password - Plain-text password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
    /**
     * Step 1: Strict Type Validation
     */
    if (typeof password !== "string") {
        throw new BadRequestError({
            message: "Password must be a string",
        });
    }

    /**
     * Step 2: Required Validation
     */
    if (password.length === 0) {
        throw new BadRequestError({
            message: "Password is required",
        });
    }

    /**
     * Step 3: Minimum Length Validation
     */
    if (password.length < 8) {
        throw new BadRequestError({
            message: "Password must be at least 8 characters long",
        });
    }

    try {
        /**
         * Step 4: Hash Password
         */
        return await argon2.hash(password, ARGON_CONFIG);
    } catch (error) {
        /**
         * Step 5: Internal Failure Handling
         */
        system_logger.error(
            { err: error },
            "Security: Password hashing failed"
        );

        throw new InternalServerError({
            message: "Internal security error",
        });
    }
};

/**
 * ---------------------------------------------------------
 * VERIFY PASSWORD
 * ---------------------------------------------------------
 *
 * Purpose:
 * Compares a plain-text password with a stored hashed password.
 *
 * Important:
 * - Passwords must NOT be trimmed or normalized
 *
 * @param {string} plainPassword - User input password
 * @param {string} hashedPassword - Stored hashed password
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (plainPassword, hashedPassword) => {
    /**
     * Step 1: Strict Input Validation
     */
    if (
        typeof plainPassword !== "string" ||
        typeof hashedPassword !== "string" ||
        plainPassword.length === 0 ||
        hashedPassword.length === 0
    ) {
        return false;
    }

    try {
        /**
         * Step 2: Verify Password
         */
        return await argon2.verify(hashedPassword, plainPassword);
    } catch (error) {
        /**
         * Step 3: Safe Failure Handling
         */
        system_logger.error(
            { err: error },
            "Security: Password verification failed"
        );

        return false;
    }
};

export default {
    hashPassword,
    verifyPassword,
};