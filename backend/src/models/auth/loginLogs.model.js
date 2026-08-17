import mongoose from "mongoose";
import { createSchema } from "../base/mongoose.schema.js";
import {
    BadRequestError
} from "../../errors/index.js";

const { ObjectId } = mongoose.Schema.Types;

const loginLogSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User is required"],
        index: true,
    },

    identifier: {
        type: String,
        required: [true, "Identifier is required"],
        trim: true,
        index: true,
    },

    deviceName: {
        type: String,
        trim: true,
        default: null,
        maxlength: [250, "Device name is too long"],
    },

    deviceId: {
        type: String,
        trim: true,
        required: [true, "Device id is required"],
        minlength: [1, "Device id is too short"],
        maxlength: [250, "Device id is too long"],
    },

    userAgent: {
        type: String,
        trim: true,
        default: null,
        maxlength: [1000, "User agent is too long"],
    },
    ipAddress: {
        type: String,
        trim: true,
        default: null,
        maxlength: [250, "IpAddress is too long"],
    },
    loginAt: {
        type: Date,
        required: [true, "Login date is required"],
        default: Date.now,
    }
}

const loginLogSchema = createSchema(loginLogSchemaDefinition);

loginLogSchema.index({userId: 1, loginAt: -1});
loginLogSchema.index({deviceId: 1, loginAt: -1});
loginLogSchema.index({ipAddress: 1, loginAt: -1});
loginLogSchema.index(
    { loginAt: 1 },
    {
        expireAfterSeconds: 31536000 * 2,
    },
);


loginLogSchema.pre("validate", function () {
    const nullableFields = [
        "deviceName",
        "userAgent",
        "ipAddress",
    ];

    for (const field of nullableFields) {
        if (typeof this[field] === "string") {
            this[field] = this[field].trim();

            if (!this[field]) {
                this[field] = null;
            }
        }
    }

    if (typeof this.identifier === "string") {
        this.identifier = this.identifier.trim().toLowerCase();
    }

    if (typeof this.deviceId === "string") {
        this.deviceId = this.deviceId.trim().toLowerCase();
    }
});


loginLogSchema.statics.logLogin = function ({
    userId,
    identifier,
    deviceName = null,
    deviceId,
    userAgent = null,
    ipAddress = null,
    session = null,
} = {}) {
    if (!userId) {
        throw new BadRequestError({
            message: "User id is required",
            code: "USERID_REQUIRED",
        });
    }

    const normalizedIdentifier =
        typeof identifier === "string"
            ? identifier.trim().toLowerCase()
            : "";

    if (!normalizedIdentifier) {
        throw new BadRequestError({
            message: "Identifier is required",
            code: "IDENTIFIER_REQUIRED",
        });
    }

    const normalizedDeviceId =
        typeof deviceId === "string"
            ? deviceId.trim().toLowerCase()
            : "";

    if (!normalizedDeviceId) {
        throw new BadRequestError({
            message: "Device id is required",
            code: "DEVICEID_REQUIRED",
        });
    }

    return this.createDocument({
        doc: {
            userId,
            identifier: normalizedIdentifier,
            deviceName,
            deviceId: normalizedDeviceId,
            userAgent,
            ipAddress,
            loginAt: new Date(),
        },
        session,
    });
};

const LoginLog = mongoose.model("LoginLog", loginLogSchema);

export { LoginLog };