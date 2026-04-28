import { UnauthenticatedError } from "../errors/unauthenticated.error.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";

/**
 * ---------------------------------------------------------
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 * ---------------------------------------------------------
 *
 * Purpose:
 * Restricts access to routes based on allowed user roles.
 *
 * Behavior:
 * - requires an authenticated request.user
 * - requires request.user.role to be included in allowedRoles
 *
 * @param {...string} allowedRoles
 * @returns {Function} Express middleware
 */
const roleMiddleware = (...allowedRoles) => {
    const normalizedAllowedRoles = allowedRoles
        .map((role) => String(role || "").trim().toLowerCase())
        .filter(Boolean);

    if (normalizedAllowedRoles.length === 0) {
        throw new Error("roleMiddleware requires at least one allowed role");
    }

    return (request, response, next) => {
        if (!request.user) {
            return next(
                new UnauthenticatedError({
                    message:
                        "Authentication required. Please log in to access this resource",
                })
            );
        }

        const userRole = String(request.user.role || "").trim().toLowerCase();

        if (!normalizedAllowedRoles.includes(userRole)) {
            return next(
                new UnauthorizedError({
                    message:
                        "This account type is not allowed to access this resource",
                })
            );
        }

        return next();
    };
};

export { roleMiddleware };
export default roleMiddleware;