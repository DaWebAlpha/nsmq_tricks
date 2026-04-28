import mongoose from "mongoose";
import { createBaseModel } from "../mongoose.model.base.js";

const ADMIN_ACTIVITY_ACTIONS = Object.freeze({
    CREATE_USER: "create_user",
    UPDATE_USER: "update_user",
    DELETE_USER: "delete_user",
    RESTORE_USER: "restore_user",
    UPDATE_USER_ROLE: "update_user_role",
    ACTIVATE_SUBSCRIPTION: "activate_subscription",
    CANCEL_SUBSCRIPTION: "cancel_subscription",

    CREATE_NOTE: "create_note",
    UPDATE_NOTE: "update_note",
    DELETE_NOTE: "delete_note",
    RESTORE_NOTE: "restore_note",
});

const adminActivitySchemaDefinition = {
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },

    targetNoteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Notes",
        default: null,
        index: true,
    },

    action: {
        type: String,
        required: true,
        enum: Object.values(ADMIN_ACTIVITY_ACTIONS),
        index: true,
    },

    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
    },

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    ipAddress: {
        type: String,
        default: null,
        index: true,
    },

    userAgent: {
        type: String,
        default: null,
    },

    deviceId: {
        type: String,
        default: null,
    },

    deviceName: {
        type: String,
        default: null,
    },
};

const AdminActivity = createBaseModel(
    "AdminActivity",
    adminActivitySchemaDefinition,
    (schema) => {
        schema.index({ actorId: 1, createdAt: -1 });
        schema.index({ targetUserId: 1, createdAt: -1 });
        schema.index({ targetNoteId: 1, createdAt: -1 });
        schema.index({ action: 1, createdAt: -1 });
    }
);

export {
    AdminActivity,
    ADMIN_ACTIVITY_ACTIONS,
    adminActivitySchemaDefinition,
};

export default AdminActivity;