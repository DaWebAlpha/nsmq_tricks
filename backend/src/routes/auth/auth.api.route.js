import express from "express";
import {
    authApiController,
} from "../../controllers/auth/auth.api.controller.js";
import {
    authMiddleware,
} from "../../middlewares/auth.middleware.js";
import {
    csrfMiddleware,
} from "../../middlewares/csrf.middleware.js";
import {
    loginRateLimit,
    registerRateLimit,
    refreshTokenRateLimit,
} from "../../middlewares/authRateLimit.middleware.js";

/**
 * ---------------------------------------------------------
 * AUTHENTICATION API ROUTER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles JSON-based authentication routes.
 *
 * Notes:
 * - register and login are rate-limited
 * - CSRF protection is applied to state-changing routes
 * - authenticated profile route requires auth middleware
 */
const authApiRouter = express.Router();

/**
 * Register New User
 *
 * Note:
 * CSRF is intentionally not enforced here unless a CSRF token
 * is already issued before the first client submission.
 */
authApiRouter.post(
    "/register",
    registerRateLimit,
    authApiController.register
);

/**
 * User Login
 *
 * Note:
 * CSRF is intentionally not enforced here unless a CSRF token
 * is already issued before the first client submission.
 */
authApiRouter.post(
    "/login",
    loginRateLimit,
    authApiController.login
);

/**
 * Refresh Access Session
 *
 * Protected with CSRF because it changes authentication state.
 */
authApiRouter.post(
    "/refresh-token",
    refreshTokenRateLimit,
    csrfMiddleware,
    authApiController.refreshToken
);

/**
 * Logout User
 *
 * Protected with CSRF because it changes authentication state.
 */
authApiRouter.post(
    "/logout",
    csrfMiddleware,
    authApiController.logout
);

/**
 * Get Current Authenticated User
 *
 * Requires a valid authenticated user context.
 */
authApiRouter.get(
    "/me",
    authMiddleware,
    authApiController.me
);

export { authApiRouter };
export default authApiRouter;