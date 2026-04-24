import { UnauthenticatedError } from "../errors/unauthenticated.error.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";

/**
 * ---------------------------------------------------------
 * PREMIUM ACCESS MIDDLEWARE
 * ---------------------------------------------------------
 *
 * Purpose:
 * Restricts access to routes that require an active premium entitlement.
 *
 * Behavior:
 * - requires an authenticated request.user
 * - requires request.user.isPremium to be explicitly true
 *
 * @returns {Function} Express middleware
 */
const isPremiumMiddleware = () => {
    return (request, response, next) => {
        if (!request.user) {
            return next(
                new UnauthenticatedError({
                    message:
                        "Authentication required. Please log in to access this resource",
                })
            );
        }

        if (request.user.isPremium !== true) {
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

export { isPremiumMiddleware };
export default isPremiumMiddleware;