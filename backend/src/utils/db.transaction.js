import mongoose from "mongoose";
import { system_logger } from "../core/pino.logger.js";
import { BadRequestError } from "../errors/badrequest.error.js";

/**
 * ---------------------------------------------------------
 * TRANSACTION WRAPPER UTILITY
 * ---------------------------------------------------------
 *
 * Purpose:
 * Executes a group of database operations within a MongoDB transaction.
 *
 * Guarantees:
 * - Starts and ends a session safely
 * - Commits on success
 * - Aborts on failure
 * - Preserves the original application error
 * - Prevents session leaks
 *
 * Requirements:
 * - MongoDB replica set / transaction-capable deployment
 *
 * @param {Function} work - Async function that receives the active session
 * @returns {Promise<*>} Result returned from the work function
 */
const withTransaction = async (work) => {
    if (typeof work !== "function") {
        throw new BadRequestError({
            message: "withTransaction requires a function",
        });
    }

    const session = await mongoose.startSession();
    let originalError = null;

    try {
        session.startTransaction();

        const result = await work(session);

        await session.commitTransaction();

        return result;
    } catch (error) {
        originalError = error;

        try {
            if (session.inTransaction?.() ?? true) {
                await session.abortTransaction();
            }
        } catch (abortError) {
            system_logger.error(
                {
                    err: abortError,
                    original_error: originalError,
                },
                "Database transaction abort failed"
            );
        }

        throw originalError;
    } finally {
        try {
            await session.endSession();
        } catch (endSessionError) {
            system_logger.error(
                { err: endSessionError },
                "Database session cleanup failed"
            );
        }
    }
};

export { withTransaction };
export default withTransaction;