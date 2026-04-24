import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";
import { config } from "../../config/config.js";

/**
 * ---------------------------------------------------------
 * SECURITY THRESHOLD CONFIGURATION
 * ---------------------------------------------------------
 *
 * MAX_FAILED_ATTEMPTS:
 * Maximum number of failed login attempts before lockout.
 *
 * LOCK_DURATION:
 * Lock window duration in milliseconds.
 *
 * Notes:
 * - Security configuration is normalized eagerly at module load time.
 * - Invalid, zero, or negative values fall back to safe defaults.
 */
const parsedMaxFailedAttempts = Number(config.max_failed_attempts);
const parsedLockDuration = Number(config.lock_duration);

const MAX_FAILED_ATTEMPTS =
    Number.isInteger(parsedMaxFailedAttempts) && parsedMaxFailedAttempts > 0
        ? parsedMaxFailedAttempts
        : 5;

const LOCK_DURATION =
    Number.isFinite(parsedLockDuration) && parsedLockDuration > 0
        ? parsedLockDuration
        : 15 * 60 * 1000;

/**
 * ---------------------------------------------------------
 * ACCOUNT STATUS VALUES
 * ---------------------------------------------------------
 *
 * Source of truth for account accessibility.
 */
const ACCOUNT_STATUSES = Object.freeze({
    PENDING: "pending",
    ACTIVE: "active",
    SUSPENDED: "suspended",
    BANNED: "banned",
});

/**
 * ---------------------------------------------------------
 * USER SECURITY SCHEMA DEFINITION
 * ---------------------------------------------------------
 *
 * Responsibility:
 * Stores authentication security state and account access status.
 *
 * This model owns:
 * - lockout state
 * - ban/suspension state
 * - login attempt counters
 * - global auth invalidation version
 *
 * It should be the single source of truth for whether a user
 * is currently allowed to log in.
 */
const userSecurityDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"],
        index: true,
    },

    accountStatus: {
        type: String,
        enum: Object.values(ACCOUNT_STATUSES),
        default: ACCOUNT_STATUSES.PENDING,
        index: true,
    },

    /**
     * authVersion
     *
     * Purpose:
     * Global session invalidation/version counter.
     *
     * Increment when:
     * - password changes
     * - logout all devices is triggered
     * - high-risk security event occurs
     */
    authVersion: {
        type: Number,
        default: 0,
        min: [0, "Auth version cannot be negative"],
        validate: {
            validator: Number.isInteger,
            message: "Auth version must be an integer",
        },
    },

    banWarningCount: {
        type: Number,
        default: 0,
        min: [0, "Ban warning count cannot be negative"],
        validate: {
            validator: Number.isInteger,
            message: "Ban warning count must be an integer",
        },
    },

    accountBanned: {
        type: Boolean,
        default: false,
        index: true,
    },

    timesAccountHasBeenBanned: {
        type: Number,
        default: 0,
        min: [0, "Ban count cannot be negative"],
        validate: {
            validator: Number.isInteger,
            message: "Ban count must be an integer",
        },
    },

    bannedAt: {
        type: Date,
        default: null,
    },

    bannedUntil: {
        type: Date,
        default: null,
        index: true,
    },

    loginAttempts: {
        type: Number,
        default: 0,
        min: [0, "Login attempts cannot be negative"],
        index: true,
        validate: {
            validator: Number.isInteger,
            message: "Login attempts must be an integer",
        },
    },

    lockUntil: {
        type: Date,
        default: null,
        index: true,
    },

    lastLoginAt: {
        type: Date,
        default: null,
        index: true,
    },
};

/**
 * ---------------------------------------------------------
 * USER SECURITY MODEL
 * ---------------------------------------------------------
 */
const UserSecurity = createBaseModel(
    "UserSecurity",
    userSecurityDefinition,
    (schema) => {
        /**
         * One Security Record Per User
         *
         * Prevents duplicate security profiles for the same active user.
         */
        schema.index(
            { userId: 1 },
            {
                unique: true,
                partialFilterExpression: {
                    isDeleted: false,
                },
            }
        );

        /**
         * Operational Indexes
         *
         * Supports fast access when checking user status and ban state.
         */
        schema.index({ userId: 1, accountStatus: 1 });
        schema.index({ userId: 1, accountBanned: 1 });

        /**
         * Virtual: isLocked
         *
         * True when lockUntil exists and is still in the future.
         */
        schema.virtual("isLocked").get(function () {
            return Boolean(
                this.lockUntil instanceof Date &&
                !Number.isNaN(this.lockUntil.getTime()) &&
                this.lockUntil.getTime() > Date.now()
            );
        });

        /**
         * Virtual: isBanned
         *
         * True when:
         * - account is permanently banned, or
         * - temporary suspension window is still active
         */
        schema.virtual("isBanned").get(function () {
            return Boolean(
                this.accountBanned ||
                (this.bannedUntil instanceof Date &&
                    !Number.isNaN(this.bannedUntil.getTime()) &&
                    this.bannedUntil.getTime() > Date.now())
            );
        });

        /**
         * Virtual: isSuspended
         *
         * True only for temporary bans/suspensions.
         */
        schema.virtual("isSuspended").get(function () {
            return Boolean(
                !this.accountBanned &&
                this.bannedUntil instanceof Date &&
                !Number.isNaN(this.bannedUntil.getTime()) &&
                this.bannedUntil.getTime() > Date.now()
            );
        });

        /**
         * Pre-validate Cleanup
         *
         * Responsibilities:
         * - prevents negative counters
         * - clears expired temporary suspension windows
         */
        schema.pre("validate", function () {
            if (this.loginAttempts < 0) this.loginAttempts = 0;
            if (this.banWarningCount < 0) this.banWarningCount = 0;
            if (this.timesAccountHasBeenBanned < 0) this.timesAccountHasBeenBanned = 0;
            if (this.authVersion < 0) this.authVersion = 0;

            const suspensionExpired =
                !this.accountBanned &&
                this.bannedUntil instanceof Date &&
                !Number.isNaN(this.bannedUntil.getTime()) &&
                this.bannedUntil.getTime() <= Date.now() &&
                this.accountStatus === ACCOUNT_STATUSES.SUSPENDED;

            if (suspensionExpired) {
                this.bannedUntil = null;
                this.accountStatus = ACCOUNT_STATUSES.ACTIVE;
            }
        });

        /**
         * Increment Login Attempts
         *
         * Purpose:
         * Updates failed login count and sets account lock window
         * when threshold is reached.
         *
         * Behavior:
         * - resets stale lock if lock window already expired
         * - increments attempts
         * - sets lockUntil when threshold is reached
         */
        schema.methods.incrementLoginAttempts = function () {
            const now = Date.now();

            const lockExpired =
                this.lockUntil instanceof Date &&
                !Number.isNaN(this.lockUntil.getTime()) &&
                this.lockUntil.getTime() <= now;

            if (lockExpired) {
                this.loginAttempts = 0;
                this.lockUntil = null;
            }

            const attempts = (this.loginAttempts || 0) + 1;
            const shouldLock =
                attempts >= MAX_FAILED_ATTEMPTS &&
                !(
                    this.lockUntil instanceof Date &&
                    !Number.isNaN(this.lockUntil.getTime()) &&
                    this.lockUntil.getTime() > now
                );

            this.loginAttempts = attempts;
            this.lockUntil = shouldLock ? new Date(now + LOCK_DURATION) : this.lockUntil;

            return this;
        };

        /**
         * Handle Successful Login
         *
         * Purpose:
         * Clears failed login state and records the successful login timestamp.
         *
         * Optional Behavior:
         * Automatically moves account from pending to active
         * once a valid successful login occurs.
         */
        schema.methods.handleSuccessfulLoginAttempt = function () {
            this.loginAttempts = 0;
            this.lockUntil = null;
            this.lastLoginAt = new Date();

            if (this.accountStatus === ACCOUNT_STATUSES.PENDING) {
                this.accountStatus = ACCOUNT_STATUSES.ACTIVE;
            }

            return this;
        };

        /**
         * Unlock Account
         *
         * Purpose:
         * Manual administrative unlock operation.
         */
        schema.methods.unlockAccount = function () {
            this.loginAttempts = 0;
            this.lockUntil = null;
            return this;
        };

        /**
         * Ban or Suspend Account
         *
         * durationMs = null  -> permanent ban
         * durationMs > 0     -> temporary suspension
         */
        schema.methods.banAccount = function (durationMs = null) {
            const normalizedDuration = Number(durationMs);
            const isTemporary =
                Number.isFinite(normalizedDuration) && normalizedDuration > 0;

            const now = new Date();

            this.accountBanned = !isTemporary;
            this.accountStatus = isTemporary
                ? ACCOUNT_STATUSES.SUSPENDED
                : ACCOUNT_STATUSES.BANNED;
            this.bannedAt = now;
            this.bannedUntil = isTemporary
                ? new Date(now.getTime() + normalizedDuration)
                : null;
            this.timesAccountHasBeenBanned =
                (this.timesAccountHasBeenBanned || 0) + 1;
            this.banWarningCount = 0;

            return this;
        };

        /**
         * Unban Account
         *
         * Purpose:
         * Clears permanent or temporary ban state and reactivates account.
         */
        schema.methods.unbanAccount = function () {
            this.accountBanned = false;
            this.bannedAt = null;
            this.bannedUntil = null;
            this.accountStatus = ACCOUNT_STATUSES.ACTIVE;
            return this;
        };

        /**
         * bumpAuthVersion
         *
         * Purpose:
         * Invalidates all issued sessions globally by increasing the
         * shared auth version value.
         */
        schema.methods.bumpAuthVersion = function () {
            this.authVersion = (this.authVersion || 0) + 1;
            return this;
        };
    }
);

export { UserSecurity, ACCOUNT_STATUSES };
export default UserSecurity;