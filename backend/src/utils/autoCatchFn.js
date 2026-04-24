import { BadRequestError } from "../errors/badrequest.error.js";

/**
 * ---------------------------------------------------------
 * ASYNC ERROR WRAPPER (autoCatchFn)
 * ---------------------------------------------------------
 *
 * Purpose:
 * Wraps async route handlers and middleware to ensure all errors
 * are properly forwarded to Express error-handling middleware.
 *
 * Guarantees:
 * - Handles async + sync functions
 * - Prevents unhandled promise rejections
 * - Prevents multiple next() calls
 * - Validates input
 *
 * @param {Function} fn - Express middleware or route handler
 * @returns {Function} Wrapped middleware
 */
const autoCatchFn = (fn) => {
    /**
     * Validate input
     */
    if (typeof fn !== "function") {
        throw new BadRequestError({
            message: "autoCatchFn requires a function",
        });
    }

    /**
     * Return wrapped middleware
     */
    const wrapped = function autoCatchWrapper(req, res, next) {
        let called = false;

        const safeNext = (err) => {
            if (called) return;
            called = true;
            next(err);
        };

        try {
            /**
             * Promise.resolve ensures:
             * - sync errors are caught
             * - async errors are caught
             */
            return Promise.resolve(fn(req, res, safeNext)).catch(safeNext);
        } catch (error) {
            /**
             * Handles synchronous throws
             */
            return safeNext(error);
        }
    };

    return wrapped;
};

export { autoCatchFn };
export default autoCatchFn;