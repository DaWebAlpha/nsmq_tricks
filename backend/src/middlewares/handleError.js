import { config } from "../config/config.js";
import { system_logger } from "../core/pino.logger.js";
import { getClientIP } from "../utils/request.js";

const NODE_ENV = config.node_env || "development";

/**
 * ---------------------------------------------------------
 * GLOBAL ERROR HANDLING MIDDLEWARE
 * ---------------------------------------------------------
 *
 * Purpose:
 * Centralized error handler for the entire application.
 * Intercepts all errors passed via next(error) and returns
 * a standardized response.
 *
 * Responsibilities:
 * - prevents duplicate responses if headers are already sent
 * - normalizes and validates HTTP status codes
 * - differentiates between operational and unexpected errors
 * - logs structured error data for monitoring and debugging
 * - returns JSON for API requests
 * - renders HTML views for SSR/page requests
 * - exposes detailed debug information only in development
 *
 * @param {Error} err - Error object passed from previous middleware
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleError = (err, request, response, next) => {
    /**
     * -----------------------------------------------------
     * STEP 1: GUARD CLAUSE - HEADERS ALREADY SENT
     * -----------------------------------------------------
     * If the response has already started, delegate to the
     * default Express error handler to avoid double response issues.
     */
    if (response.headersSent) {
        return next(err);
    }

    /**
     * -----------------------------------------------------
     * STEP 2: NORMALIZE STATUS CODE
     * -----------------------------------------------------
     * Ensures the status code is a valid HTTP error code.
     * Falls back to 500 for missing or invalid values.
     */
    const statusCode =
        Number.isInteger(err?.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode < 600
            ? err.statusCode
            : 500;

    /**
     * -----------------------------------------------------
     * STEP 3: DETERMINE ERROR TYPE
     * -----------------------------------------------------
     * Operational errors are trusted and expected.
     * Non-operational errors usually indicate bugs or unexpected failures.
     */
    const isOperational = Boolean(err?.isOperational);

    /**
     * -----------------------------------------------------
     * STEP 4: STRUCTURED LOGGING
     * -----------------------------------------------------
     * Log full context for observability, debugging, and production support.
     */
    system_logger.error(
        {
            errName: err?.name || "Error",
            message: err?.message || "An unexpected error occurred",
            statusCode,
            isOperational,
            method: request.method,
            url: request.originalUrl,
            ip: getClientIP(request),
            stack: err?.stack,
        },
        "An error occurred during request processing"
    );

    /**
     * -----------------------------------------------------
     * STEP 5: BUILD SAFE CLIENT RESPONSE
     * -----------------------------------------------------
     * Response behavior:
     * - development: expose original error message
     * - production + operational: expose trusted message
     * - production + unknown: hide internal details
     */
    const errorResponse = {
        success: false,
        title: "Internal Server Error",
        message:
            NODE_ENV === "development" || isOperational
                ? err?.message || "An unexpected error occurred"
                : "An unexpected error occurred. Please try again later.",
    };

    /**
     * -----------------------------------------------------
     * STEP 6: ATTACH STRUCTURED DETAILS
     * -----------------------------------------------------
     * Includes validation or domain-specific details only for
     * trusted operational errors.
     */
    if (isOperational && err?.details) {
        errorResponse.details = err.details;
    }

    /**
     * -----------------------------------------------------
     * STEP 7: DEVELOPMENT DEBUG FIELDS
     * -----------------------------------------------------
     * Adds debug metadata only in development environment.
     */
    if (NODE_ENV === "development") {
        errorResponse.stack = err?.stack;
        errorResponse.isOperational = isOperational;
        errorResponse.errName = err?.name || "Error";
    }

    return response.status(statusCode).render("error", {
        ...errorResponse,
    });
};

export { handleError };
export default handleError;