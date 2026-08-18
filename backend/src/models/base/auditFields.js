import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

/**
 * Reference to the User who performed an action, e.g. createdBy/updatedBy.
 */
const fieldOptions = {
    type: ObjectId,
    ref: "User",
    default: null
}

/**
 * Timestamp of when an action occurred, e.g. deletedAt/restoredAt.
 */
const fieldDate = {
    type: Date,
    default: null,
}

/**
 * Simple on/off flag, e.g. isDeleted.
 */
const fieldBoolean = {
    type: Boolean,
    default: false,
}

/**
 * Free-text justification for an action, e.g. deleteReason/restoreReason.
 */
const fieldReason = {
    type: String,
    default: null
}

/**
 * Reusable schema fields for tracking who performed soft-delete/restore
 * actions on a document, when, and why. Spread this into any schema that
 * needs audit trail support, e.g. `new mongoose.Schema({ ...auditFields, ... })`.
 */
const auditFields = {
    createdBy: fieldOptions,
    updatedBy: fieldOptions,
    deletedBy: fieldOptions,
    restoredBy: fieldOptions,

    deletedAt: fieldDate,
    restoredAt: fieldDate,

    isDeleted: fieldBoolean,

    deleteReason: fieldReason,
    restoreReason: fieldReason

}

export { auditFields }
