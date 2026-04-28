import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

const loginLogDefinition = {
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },

    ipAddress: {
        type: String,
        required: [true, "IP address is required"],
        trim: true,
        maxlength: [100, "IP address is too long"],
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

    loginAt: {
        type: Date,
        required: [true, "Login date is required"],
        default: Date.now,
        index: true,
    },
};

const LoginLog = createBaseModel("LoginLog", loginLogDefinition, (schema) => {
    schema.index({
        userId: 1,
        userAgent: 1,
        deviceId: 1,
        deviceName: 1,
        ipAddress: 1,
    });

    schema.index({ ipAddress: 1, loginAt: -1 });
    schema.index({ userId: 1, loginAt: -1 }, { sparse: true });

    schema.pre("validate", function () {
        if (typeof this.ipAddress === "string") {
            this.ipAddress = this.ipAddress.trim();
        }

        if (typeof this.userAgent === "string") {
            const cleanedUserAgent = this.userAgent.trim();
            this.userAgent = cleanedUserAgent || null;
        }

        if (typeof this.deviceName === "string") {
            const cleanedDeviceName = this.deviceName.trim();
            this.deviceName = cleanedDeviceName || null;
        }

        if (typeof this.deviceId === "string") {
            const cleanedDeviceId = this.deviceId.trim();
            this.deviceId = cleanedDeviceId || null;
        }
    });
});

export { LoginLog };
export default LoginLog;