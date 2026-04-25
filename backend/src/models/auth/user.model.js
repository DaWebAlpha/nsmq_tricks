import mongoose from "mongoose";
import validator from "validator";
import { hashPassword, verifyPassword } from "../../utils/password.argon2.js";
import { InternalServerError } from "../../errors/internalserver.error.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { RESERVED_WORDS, normalizeValue } from "../../utils/string.utils.js";
import { createBaseModel } from "../mongoose.model.base.js";
import { system_logger } from "../../core/pino.logger.js";
import { normalizePhoneNumber } from "../../utils/phone.js";
import { config } from "../../config/config.js";

const SUBSCRIPTION_EXPIRY_TIME = config.subscription_expiry_time;

const USERNAME_REGEX = /^(?=.{3,20}$)[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,120}$/;

const USER_ROLES = ["user", "moderator", "admin", "superadmin"];

const SUBSCRIPTION_PLANS = ["free", "premium", "pro", "enterprise"];

const assertPaidSubscriptionPlan = (plan) => {
    if (!SUBSCRIPTION_PLANS.includes(plan) || plan === "free") {
        throw new BadRequestError({
            message: "Invalid subscription plan",
        });
    }

    return plan;
};

const assertNonEmptyNormalizedValue = (value, message) => {
    const normalized = normalizeValue(String(value || ""));

    if (!normalized) {
        throw new BadRequestError({ message });
    }

    return normalized;
};

const assertValidNormalizedEmail = (email) => {
    const normalized = assertNonEmptyNormalizedValue(
        email,
        "Valid email is required"
    );

    if (!validator.isEmail(normalized)) {
        system_logger.warn({ email }, "Attempt to find user with invalid email");

        throw new BadRequestError({
            message: "Valid email is required",
        });
    }

    return normalized;
};

const assertValidNormalizedUsername = (username) => {
    const normalized = assertNonEmptyNormalizedValue(
        username,
        "Valid username is required"
    );

    if (RESERVED_WORDS.has(normalized) || !USERNAME_REGEX.test(normalized)) {
        system_logger.warn(
            { username },
            "Attempt to find user with invalid username"
        );

        throw new BadRequestError({
            message: "Valid username is required",
        });
    }

    return normalized;
};

const subscriptionSchema = new mongoose.Schema(
    {
        isActive: {
            type: Boolean,
            default: false,
        },

        expiresAt: {
            type: Date,
            default: null,
        },

        plan: {
            type: String,
            enum: SUBSCRIPTION_PLANS,
            default: "free",
        },
    },
    { _id: false }
);


const userSchemaDefinition = {
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: [3, "Username is too short"],
        maxlength: [20, "Username is too long"],
        match: [
            USERNAME_REGEX,
            "Username can contain letters, numbers, ., - and _",
        ],
        validate: {
            validator: function (val) {
                const normalized = normalizeValue(String(val || ""));
                return !!normalized && !RESERVED_WORDS.has(normalized);
            },
            message: "Invalid or reserved username",
        },
    },

    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: [5, "Email is too short"],
        maxlength: [120, "Email is too long"],
        validate: {
            validator: function (val) {
                const normalized = normalizeValue(String(val || ""));
                return !!normalized && validator.isEmail(normalized);
            },
            message: "Invalid email format",
        },
    },

    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,

        set: function (val) {
            if (!val) return val;

            const normalized = normalizePhoneNumber(val, "GH");
            return normalized ? normalized.e164 : val;
        },

        validate: {
            validator: function (val) {
                if (!val) return false;
                return !!normalizePhoneNumber(val, "GH");
            },
            message: (props) => `${props.value} is not a valid phone number`,
        },
    },

    password: {
        type: String,
        required: true,
        select: false,
        default: null,
        validate: {
            validator: function (val) {
                return !val || PASSWORD_REGEX.test(String(val || ""));
            },
            message:
                "Password must be between 8 and 120 characters and contain letters, numbers and special characters",
        },
    },

    subscription: {
        type: subscriptionSchema,
        default: () => ({}),
    },

    role: {
        type: String,
        default: "user",
        enum: USER_ROLES,
        index: true,
    },

    lastPasswordChangedAt: {
        type: Date,
        default: null,
        index: true,
    },

    passwordResetToken: {
        type: String,
        trim: true,
        default: null,
        select: false,
    },

    passwordResetExpiresAt: {
        type: Date,
        default: null,
        select: false,
        index: true,
    },
};

const User = createBaseModel("User", userSchemaDefinition, (schema) => {
    schema.index(
        { username: 1 },
        {
            unique: true,
            partialFilterExpression: {
                isDeleted: false,
            },
        }
    );

    schema.index(
        { email: 1 },
        {
            unique: true,
            partialFilterExpression: {
                isDeleted: false,
            },
        }
    );

    schema.index(
        { phoneNumber: 1 },
        {
            unique: true,
            partialFilterExpression: {
                isDeleted: false,
            },
        }
    );

    schema.index({ "subscription.isActive": 1, "subscription.expiresAt": 1 });
    schema.index({ "subscription.isActive": 1, role: 1 });
    schema.index({ createdAt: -1 });
    schema.index({ updatedAt: -1 });
    schema.index({ isDeleted: 1, deletedAt: 1 });
    schema.index({ phoneNumber: 1, isDeleted: 1 });

    schema.virtual("hasActiveSubscription").get(function () {
        if (!this.subscription?.isActive) return false;
        if (!this.subscription?.expiresAt) return false;

        return this.subscription.expiresAt > new Date();
    });

    schema.methods.subscriptionExpired = function () {
        if (!this.subscription?.expiresAt) return true;

        return this.subscription.expiresAt <= new Date();
    };

    schema.methods.activateSubscription = function (plan = "premium") {
        assertPaidSubscriptionPlan(plan);

        this.subscription = {
            isActive: true,
            expiresAt: new Date(Date.now() + SUBSCRIPTION_EXPIRY_TIME),
            plan,
        };

        return this;
    };

    schema.methods.renewSubscription = function (plan = "premium") {
        assertPaidSubscriptionPlan(plan);

        const now = new Date();

        const baseDate =
            this.subscription?.expiresAt && this.subscription.expiresAt > now
                ? this.subscription.expiresAt
                : now;

        this.subscription = {
            isActive: true,
            expiresAt: new Date(baseDate.getTime() + SUBSCRIPTION_EXPIRY_TIME),
            plan,
        };

        return this;
    };

    schema.methods.cancelSubscription = function () {
        this.subscription = {
            isActive: false,
            expiresAt: null,
            plan: "free",
        };

        return this;
    };

    schema.methods.expireSubscription = function () {
        this.subscription = {
            isActive: false,
            expiresAt: new Date(),
            plan: "free",
        };

        return this;
    };

    schema.query.activeSubscription = function () {
        return this.where({
            "subscription.isActive": true,
            "subscription.expiresAt": { $gt: new Date() },
        });
    };

    schema.pre("validate", function () {
        if (this.isModified("username") && this.username) {
            this.username = normalizeValue(String(this.username || ""));
        }

        if (this.isModified("email") && this.email) {
            this.email = normalizeValue(String(this.email || ""));
        }

        if (this.isModified("phoneNumber") && this.phoneNumber) {
            const normalized = normalizePhoneNumber(this.phoneNumber, "GH");

            if (!normalized) {
                this.invalidate("phoneNumber", "Invalid phone number");
            } else {
                this.phoneNumber = normalized.e164;
            }
        }
    });

    schema.pre("save", async function () {
        if (
            this.subscription?.isActive &&
            this.subscription?.expiresAt &&
            this.subscription.expiresAt <= new Date()
        ) {
            this.subscription.isActive = false;
            this.subscription.plan = "free";
        }

        if (this.isModified("password") && this.password) {
            this.password = await hashPassword(this.password);
            this.lastPasswordChangedAt = new Date();
        }
    });

    schema.methods.comparePassword = async function (plainPassword) {
        if (!this.password) {
            system_logger.error("Password field not selected in query.");

            throw new InternalServerError({
                message: "Internal authentication error",
            });
        }

        return verifyPassword(String(plainPassword || ""), this.password);
    };

    schema.statics.findByIdentifier = function (identifier) {
        if (!identifier) {
            system_logger.warn("Attempt to find user with empty identifier");

            throw new BadRequestError({
                message: "Identifier is required",
            });
        }

        const normalizedPhone = normalizePhoneNumber(identifier, "GH");

        if (normalizedPhone?.e164) {
            return this.findOne({
                isDeleted: false,
                phoneNumber: normalizedPhone.e164,
            }).select("+password");
        }

        const normalized = normalizeValue(String(identifier || ""));

        if (!normalized) {
            system_logger.warn("Attempt to find user with empty identifier");

            throw new BadRequestError({
                message: "Email, username, or phone number is required",
            });
        }

        return this.findOne({
            isDeleted: false,
            $or: [{ username: normalized }, { email: normalized }],
        }).select("+password");
    };

    schema.statics.findByPhoneNumber = function (phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber, "GH");

        if (!normalized?.e164) {
            system_logger.warn(
                { phoneNumber },
                "Attempt to find user with invalid phone number"
            );

            throw new BadRequestError({
                message: "Valid phone number is required",
            });
        }

        return this.findOne({
            isDeleted: false,
            phoneNumber: normalized.e164,
        }).select("+password");
    };

    schema.statics.findByEmail = function (email) {
        const normalized = assertValidNormalizedEmail(email);

        return this.findOne({
            email: normalized,
            isDeleted: false,
        }).select("+password");
    };

    schema.statics.findByUsername = function (username) {
        const normalized = assertValidNormalizedUsername(username);

        return this.findOne({
            username: normalized,
            isDeleted: false,
        }).select("+password");
    };
});

export {
    User,
    USERNAME_REGEX,
    PASSWORD_REGEX,
    USER_ROLES,
    SUBSCRIPTION_PLANS,
    userSchemaDefinition,
};

