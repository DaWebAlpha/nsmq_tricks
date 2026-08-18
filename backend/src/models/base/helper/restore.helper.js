/**
 * Restores a soft-deleted document by clearing the delete fields and
 * recording who/when/why it was restored, then persists the change.
 * No-ops (returns the document as-is) if it isn't currently deleted.
 * @param {object} options
 * @param {import("mongoose").Document} options.document - The document to restore.
 * @param {string|import("mongoose").Types.ObjectId} [options.restoreUserId] - User performing the restore.
 * @param {string} [options.reason] - Optional justification for the restore.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<import("mongoose").Document>} The saved (or already-restored) document.
 */
const restoreDocument = async ({
    document,
    restoreUserId = null,
    reason = null,
    session = null

} = {} ) => {
    if(!document.isDeleted){
        return document;
    }

    document.isDeleted = false;
    document.deletedBy = null;
    document.deletedAt = null;
    document.deleteReason = null

    document.restoredAt = new Date();
    document.restoredBy = restoreUserId;
    document.restoreReason = reason

    return document.save({session, validateBeforeSave: false})
}

export { restoreDocument };
