import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

/**
 * Failed Login Reasons
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
 * Failed Login Log Schema Definition (singular)
 */
const failedLoginLogDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    identifier:{
        type: String,
        required: [true, "Identifier is required"],
        trim: true,
        index: true,

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
    deviceId: {
        type: String,
        default: null,
        trim: true,
        maxlength: [255, "Device ID is too long"],
        index: true, 
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
 * FailedLoginLog Model (singular)
 */
const FailedLoginLog = createBaseModel(
    "FailedLoginLog",
    failedLoginLogDefinition,
    (schema) => {
        // TTL index (auto delete after 90 days)
        schema.index(
            { attemptedAt: 1 },
            { expireAfterSeconds: FAILED_LOGIN_LOG_TTL_SECONDS }
        );

        schema.index({ ipAddress: 1, attemptedAt: -1 });
        schema.index({ reason: 1, attemptedAt: -1 });
        schema.index({ userId: 1, attemptedAt: -1 }, { sparse: true });

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
    FailedLoginLog,
    FAILED_LOGIN_REASONS,
    FAILED_LOGIN_REASON_VALUES,
    FAILED_LOGIN_LOG_TTL_SECONDS,
    failedLoginLogDefinition,
};

export default FailedLoginLog;