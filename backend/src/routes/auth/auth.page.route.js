import express from "express";
import {
    authPageController,
} from "../../controllers/auth/auth.page.controller.js";
import {
    authMiddleware,
} from "../../middlewares/auth.middleware.js";


import {
    loginRateLimit,
    registerRateLimit,
    refreshTokenRateLimit,
} from "../../middlewares/authRateLimit.middleware.js";

/**
 * ---------------------------------------------------------
 * AUTHENTICATION PAGE ROUTER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Defines server-rendered authentication routes for the application.
 *
 * Responsibilities:
 * - Handles authentication form submissions
 * - Renders authentication-related pages
 * - Protects sensitive state-changing routes with rate limiting
 *   and CSRF validation where required
 *
 * Security Design:
 * - Login and registration endpoints are rate-limited
 * - Refresh token and logout routes are protected by CSRF middleware
 * - Authenticated user page requires a valid authenticated session
 *
 * Important:
 * - GET routes render authentication pages
 * - POST routes perform authentication actions
 * - This router is intended for browser-based authentication flows
 */
const authPageRouter = express.Router();

/**
 * ---------------------------------------------------------
 * AUTH VIEW ROUTES (GET)
 * ---------------------------------------------------------
 *
 * Purpose:
 * Render authentication-related pages for browser users.
 *
 * Notes:
 * - These routes only render views
 * - No authentication state is changed here
 */

/**
 * GET /login
 *
 * Purpose:
 * Render the login page.
 */
authPageRouter.get("/login", authPageController.getLoginPage);

/**
 * GET /register
 *
 * Purpose:
 * Render the registration page.
 */
authPageRouter.get("/register", authPageController.getRegisterPage);

/**
 * ---------------------------------------------------------
 * AUTHENTICATION ACTION ROUTES (POST)
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handle state-changing authentication operations such as:
 * - registration
 * - login
 * - refresh token rotation
 * - logout
 */

/**
 * POST /register
 *
 * Purpose:
 * Create a new user account from submitted registration data.
 *
 * Security:
 * - Protected by registration rate limiting
 *
 * Note:
 * CSRF protection is not enforced here unless a CSRF token
 * is issued before the registration form is submitted.
 */
authPageRouter.post(
    "/register",
    registerRateLimit,
    authPageController.register
);

/**
 * POST /login
 *
 * Purpose:
 * Authenticate user credentials and establish a session.
 *
 * Security:
 * - Protected by login rate limiting
 *
 * Note:
 * CSRF protection is not enforced here unless a CSRF token
 * is issued before the login form is submitted.
 */
authPageRouter.post(
    "/login",
    loginRateLimit,
    authPageController.login
);

/**
 * POST /refresh-token
 *
 * Purpose:
 * Rotate authentication tokens and refresh the access session.
 *
 * Security:
 * - Protected by refresh-token rate limiting
 * - Protected by CSRF middleware because it changes auth state
 */
authPageRouter.post(
    "/refresh-token",
    refreshTokenRateLimit,
    authPageController.refreshToken
);

/**
 * POST /logout
 *
 * Purpose:
 * Terminate the current authenticated session.
 *
 * Security:
 * - Protected by CSRF middleware because it changes auth state
 */
authPageRouter.post(
    "/logout",
    authPageController.logout
);

/**
 * ---------------------------------------------------------
 * AUTHENTICATED USER ROUTE
 * ---------------------------------------------------------
 */

/**
 * GET /me
 *
 * Purpose:
 * Render the currently authenticated user's page or profile context.
 *
 * Security:
 * - Requires a valid authenticated user
 */
authPageRouter.get(
    "/me",
    authMiddleware,
    authPageController.me
);

export { authPageRouter };
export default authPageRouter;