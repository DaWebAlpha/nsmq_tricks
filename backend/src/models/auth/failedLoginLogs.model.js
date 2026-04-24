import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

/**
 * Failed Login Reasons
 *
 * Purpose:
 * Defines the controlled set of reasons that may be recorded
 * when an authentication attempt fails.
 *
 * Security Design:
 * - "invalid_credentials" is intentionally vague and should be used
 *   for public-facing responses where the system must not reveal
 *   whether the identifier or password was incorrect.
 * - More specific reasons such as "invalid_password" or
 *   "unknown_identifier" are suitable for internal audit,
 *   anomaly detection, and security monitoring.
 *
 * Important Rule:
 * Use one reasoning strategy consistently for a given authentication flow.
 * Do not mix vague and specific reasons in the same public code path.
 */
const FAILED_LOGIN_REASONS = Object.freeze({
    INVALID_CREDENTIALS: "invalid_credentials",
    LOCKED_ACCOUNT: "locked_account",
    BANNED_ACCOUNT: "banned_account",
    INACTIVE_ACCOUNT: "inactive_account",
    PROVIDER_MISMATCH: "provider_mismatch",
    UNKNOWN_IDENTIFIER: "unknown_identifier",
    INVALID_PASSWORD: "invalid_password",
});

const FAILED_LOGIN_REASON_VALUES = Object.freeze(
    Object.values(FAILED_LOGIN_REASONS)
);

const FAILED_LOGIN_LOG_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * Failed Login Logs Schema Definition
 *
 * Responsibility:
 * Stores append-only audit records for failed authentication attempts.
 *
 * Notes:
 * - This model is for audit/history only.
 * - It should not be the source of truth for lockout decisions.
 * - Lock state and ban state belong in UserSecurity.
 */
const failedLoginLogsDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,

        /**
         * userId is nullable because some login failures happen
         * before a valid user can be identified.
         *
         * Example:
         * - unknown email
         * - malformed identifier
         */
    },

    ipAddress: {
        type: String,
        required: [true, "IP address is required"],
        trim: true,
        maxlength: [100, "IP address is too long"],
        index: true,
    },

    userAgent: {
        type: String,
        default: null,
        trim: true,
        maxlength: [500, "User agent is too long"],
    },

    deviceName: {
        type: String,
        default: null,
        trim: true,
        maxlength: [255, "Device name is too long"],
    },

    attemptedAt: {
        type: Date,
        required: [true, "Attempted at date is required"],
        default: Date.now,
        index: true,
    },

    reason: {
        type: String,
        enum: FAILED_LOGIN_REASON_VALUES,
        default: FAILED_LOGIN_REASONS.INVALID_CREDENTIALS,
        trim: true,
        index: true,
    },
};

/**
 * FailedLoginLogs Model
 *
 * Purpose:
 * Central audit log for authentication failures.
 */
const FailedLoginLogs = createBaseModel(
    "FailedLoginLogs",
    failedLoginLogsDefinition,
    (schema) => {
        /**
         * TTL Index
         *
         * Automatically deletes failed login records 90 days
         * after the attempt timestamp.
         */
        schema.index(
            { attemptedAt: 1 },
            { expireAfterSeconds: FAILED_LOGIN_LOG_TTL_SECONDS }
        );

        /**
         * IP + AttemptedAt Index
         */
        schema.index({ ipAddress: 1, attemptedAt: -1 });

        /**
         * Reason + AttemptedAt Index
         *
         * Supports security analytics by failure category over time.
         */
        schema.index({ reason: 1, attemptedAt: -1 });

        /**
         * userId + AttemptedAt Sparse Index
         */
        schema.index({ userId: 1, attemptedAt: -1 }, { sparse: true });

        /**
         * Normalize Empty Optional Fields
         */
        schema.pre("validate", function () {
            if (typeof this.userAgent === "string") {
                const cleanedUserAgent = this.userAgent.trim();
                this.userAgent = cleanedUserAgent || null;
            }

            if (typeof this.deviceName === "string") {
                const cleanedDeviceName = this.deviceName.trim();
                this.deviceName = cleanedDeviceName || null;
            }
        });
    }
);

export {
    FailedLoginLogs,
    FAILED_LOGIN_REASONS,
    FAILED_LOGIN_REASON_VALUES,
    FAILED_LOGIN_LOG_TTL_SECONDS,
    failedLoginLogsDefinition,
};

export default FailedLoginLogs;