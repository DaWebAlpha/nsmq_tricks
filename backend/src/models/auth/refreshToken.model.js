import crypto from "crypto";
import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

/**
 * ---------------------------------------------------------
 * REFRESH TOKEN SCHEMA DEFINITION
 * ---------------------------------------------------------
 *
 * Responsibility:
 * Stores device-scoped refresh token sessions.
 *
 * Security Design:
 * - Raw refresh tokens are never stored directly.
 * - Only a SHA-256 hash of the token is stored.
 * - Each device can have at most one active token per user.
 * - Revocation is tracked using revokedAt rather than a boolean.
 */
const refreshTokenDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    tokenHash: {
        type: String,
        required: true,
        trim: true,
        minlength: 64,
        maxlength: 64,
        match: [/^[a-f0-9]{64}$/i, "tokenHash must be a valid SHA-256 hex digest"],
    },

    /**
     * tokenVersion
     *
     * Purpose:
     * Mirrors UserSecurity.authVersion at the time the refresh token
     * is issued.
     *
     * Benefit:
     * Enables global session invalidation.
     *
     * Example:
     * - password change
     * - logout-all-devices
     * - security event requiring session revocation
     */
    tokenVersion: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "tokenVersion must be an integer",
        },
    },

    deviceId: {
        type: String,
        trim: true,
        required: true,
        minlength: 1,
        maxlength: 200,
    },

    deviceName: {
        type: String,
        trim: true,
        default: null,
        maxlength: 150,
    },

    userAgent: {
        type: String,
        trim: true,
        default: null,
        maxlength: 500,
    },

    ipAddress: {
        type: String,
        trim: true,
        default: null,
        maxlength: 100,
    },

    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },

    lastUsedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },

    /**
     * revokedAt
     *
     * null  -> active
     * Date  -> revoked at this timestamp
     *
     * Using a timestamp is stronger than a boolean because it also
     * captures revocation timing for audit and debugging.
     */
    revokedAt: {
        type: Date,
        default: null,
        index: true,
    },

    revokeReason: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
};

/**
 * ---------------------------------------------------------
 * REFRESH TOKEN MODEL
 * ---------------------------------------------------------
 *
 * Responsibility:
 * Session/device token management only.
 *
 * Not responsible for:
 * - account lock/banned logic
 * - failed login history
 * - identifier lookup
 */
const RefreshToken = createBaseModel(
    "RefreshToken",
    refreshTokenDefinition,
    (schema) => {
        /**
         * Unique Token Hash Index
         *
         * Ensures that each stored token hash is unique among active
         * non-deleted records.
         */
        schema.index(
            { tokenHash: 1 },
            {
                unique: true,
                partialFilterExpression: { isDeleted: false },
            }
        );

        /**
         * Active Token Lookup Index
         *
         * Supports fast queries when resolving token activity by:
         * - userId
         * - revokedAt
         * - expiresAt
         */
        schema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

        /**
         * One Active Token Per User + Device
         *
         * Enforces:
         * A user can only have one currently active refresh token
         * for a specific deviceId.
         *
         * This is useful for token rotation and multi-device support.
         */
        schema.index(
            { userId: 1, deviceId: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    revokedAt: null,
                    isDeleted: false,
                },
            }
        );

        /**
         * TTL Index
         *
         * Automatically deletes refresh token documents once expiresAt
         * is reached.
         */
        schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

        /**
         * ---------------------------------------------------------
         * PRE-VALIDATE NORMALIZATION
         * ---------------------------------------------------------
         *
         * Responsibilities:
         * - trims nullable string fields
         * - converts empty strings to null
         * - trims deviceId
         * - rejects past expiry dates on creation
         *
         * Note:
         * This hook intentionally does not use `next`.
         * Validation errors are attached directly to the document.
         */
        schema.pre("validate", function () {
            const nullableFields = [
                "deviceName",
                "userAgent",
                "ipAddress",
                "revokeReason",
            ];

            for (const field of nullableFields) {
                if (typeof this[field] === "string") {
                    this[field] = this[field].trim();
                    if (this[field] === "") {
                        this[field] = null;
                    }
                }
            }

            if (typeof this.deviceId === "string") {
                this.deviceId = this.deviceId.trim();
            }

            /**
             * Only enforce future expiry on new tokens.
             *
             * Existing expired tokens may still need to be updated
             * for revocation bookkeeping.
             */
            if (
                this.isNew &&
                this.expiresAt instanceof Date &&
                !Number.isNaN(this.expiresAt.getTime()) &&
                this.expiresAt.getTime() <= Date.now()
            ) {
                this.invalidate("expiresAt", "expiresAt must be a future date");
            }
        });

        /**
         * ---------------------------------------------------------
         * HASH RAW REFRESH TOKEN
         * ---------------------------------------------------------
         *
         * Purpose:
         * Converts a raw token into a SHA-256 hash before lookup/storage.
         *
         * @param {string} rawToken
         * @returns {string}
         */
        schema.statics.hashToken = function (rawToken) {
            const normalizedToken = String(rawToken ?? "").trim();

            if (!normalizedToken) {
                throw new Error("rawToken is required");
            }

            return crypto
                .createHash("sha256")
                .update(normalizedToken)
                .digest("hex");
        };

        /**
         * ---------------------------------------------------------
         * FIND ACTIVE TOKEN BY RAW TOKEN
         * ---------------------------------------------------------
         *
         * Purpose:
         * Resolves a raw token by hashing it and searching only among:
         * - non-revoked tokens
         * - non-expired tokens
         * - non-deleted tokens
         *
         * @param {string} rawToken
         * @returns {Query}
         */
        schema.statics.findActiveByRawToken = function (rawToken) {
            const tokenHash = this.hashToken(rawToken);

            return this.findOne({
                tokenHash,
                revokedAt: null,
                expiresAt: { $gt: new Date() },
                isDeleted: false,
            });
        };

        /**
         * ---------------------------------------------------------
         * REVOKE TOKEN
         * ---------------------------------------------------------
         *
         * Purpose:
         * Marks this token as revoked and stores the reason.
         *
         * Behavior:
         * - idempotent if already revoked
         * - skips normal validation because expired tokens may still be revoked
         *
         * @param {string} reason
         * @returns {Promise<Document>}
         */
        schema.methods.revoke = async function (reason = "manual_revocation") {
            if (this.revokedAt !== null) {
                return this;
            }

            const normalizedReason =
                typeof reason === "string" && reason.trim()
                    ? reason.trim()
                    : "manual_revocation";

            this.revokedAt = new Date();
            this.revokeReason = normalizedReason;

            return this.save({ validateBeforeSave: false });
        };

        /**
         * ---------------------------------------------------------
         * CHECK WHETHER TOKEN IS ACTIVE
         * ---------------------------------------------------------
         *
         * Returns true only if:
         * - token is not revoked
         * - token expiry is still in the future
         *
         * @returns {boolean}
         */
        schema.methods.isActive = function () {
            return (
                this.revokedAt === null &&
                this.expiresAt instanceof Date &&
                !Number.isNaN(this.expiresAt.getTime()) &&
                this.expiresAt.getTime() > Date.now()
            );
        };
    }
);

export { RefreshToken };
export default RefreshToken;