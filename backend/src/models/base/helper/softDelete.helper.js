/**
 * Soft-deletes a document by flipping isDeleted and recording who/when/why,
 * then persists the change. No-ops (returns the document as-is) if it's
 * already deleted.
 * @param {object} options
 * @param {import("mongoose").Document} options.document - The document to soft-delete.
 * @param {string|import("mongoose").Types.ObjectId} [options.deletedByUserId] - User performing the deletion.
 * @param {string} [options.reason] - Optional justification for the deletion.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<import("mongoose").Document>} The saved (or already-deleted) document.
 */
const softDeleteDocument = async({
    document,
    deletedByUserId = null,
    reason = null,
    session = null,
} = {}) => {

    if(document.isDeleted){
        return document
    }

    document.isDeleted = true;
    document.deletedBy = deletedByUserId;
    document.deletedAt = new Date();
    document.deleteReason = reason;

    return document.save({
        session,
        validateBeforeSave: false
    })
}

export {
    softDeleteDocument
};
