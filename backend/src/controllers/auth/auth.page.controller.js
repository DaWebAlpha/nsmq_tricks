import { authService } from "../../services/auth/auth.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import {
    setAuthCookies,
    clearAuthCookies,
    setCSRFTokenCookie,
    REFRESH_TOKEN_COOKIE_NAME,
} from "../../utils/auth.cookies.js";
import { generateCSRFToken } from "../../utils/csrf.js";

/**
 * ---------------------------------------------------------
 * AUTHENTICATION PAGE CONTROLLER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles server-rendered authentication flows.
 *
 * Responsibilities:
 * - Delegates business logic to AuthService
 * - Stores authentication tokens in secure cookies
 * - Issues CSRF token for browser protection
 * - Renders only safe response fields to templates
 * - Redirects after state-changing authentication actions where appropriate
 *
 * Important:
 * - Access and refresh tokens are stored in cookies
 * - Tokens are never exposed in rendered templates
 * - CSRF token is issued separately for browser requests
 * - Logout and refresh flows should not render standalone pages
 */
class AuthPageController {
    /**
     * -----------------------------------------------------
     * REGISTER NEW USER
     * -----------------------------------------------------
     *
     * Behavior:
     * - Creates a new user account
     * - Stores authentication cookies
     * - Issues a CSRF token cookie
     * - Redirects authenticated user to the post-auth page
     */
    register = autoCatchFn(async (request, response) => {
        const result = await authService.register(request.body, request);
        const csrfToken = generateCSRFToken();

        setAuthCookies(response, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });

        setCSRFTokenCookie(response, csrfToken);

        request.flash?.("success", result.message);

        return response.redirect("/dashboard");
    });

    /**
     * -----------------------------------------------------
     * USER LOGIN
     * -----------------------------------------------------
     *
     * Behavior:
     * - Authenticates user credentials
     * - Stores authentication cookies
     * - Issues a CSRF token cookie
     * - Redirects authenticated user to the post-auth page
     */
    login = autoCatchFn(async (request, response) => {
        const result = await authService.login(request.body, request);
        const csrfToken = generateCSRFToken();

        setAuthCookies(response, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });

        setCSRFTokenCookie(response, csrfToken);

        request.flash?.("success", result.message);

        return response.redirect("/dashboard");
    });

    /**
     * -----------------------------------------------------
     * REFRESH ACCESS SESSION
     * -----------------------------------------------------
     *
     * Behavior:
     * - Reads refresh token from cookie first
     * - Falls back to request body if needed
     * - Refreshes session through AuthService
     * - Rotates authentication cookies
     * - Re-issues CSRF token cookie
     * - Redirects user back to the intended page
     */
    refreshToken = autoCatchFn(async (request, response) => {
        const refreshToken =
            request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ??
            request.body?.refreshToken;

        const result = await authService.refreshToken(
            { refreshToken },
            request
        );

        const csrfToken = generateCSRFToken();

        setAuthCookies(response, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });

        setCSRFTokenCookie(response, csrfToken);

        request.flash?.("success", result.message);

        const redirectTo =
            request.get("Referrer") ||
            request.headers?.referer ||
            request.originalUrl ||
            "/dashboard";

        return response.redirect(redirectTo);
    });

    /**
     * -----------------------------------------------------
     * LOGOUT USER
     * -----------------------------------------------------
     *
     * Behavior:
     * - Reads refresh token from cookie first
     * - Falls back to request body if needed
     * - Revokes refresh token through AuthService
     * - Clears all authentication-related cookies
     * - Redirects user to login page
     */
    logout = autoCatchFn(async (request, response) => {
        const refreshToken =
            request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ??
            request.body?.refreshToken;

        const result = await authService.logout(
            { refreshToken },
            request
        );

        clearAuthCookies(response);

        request.flash?.("success", result.message);

        return response.redirect("/login");
    });

    /**
     * -----------------------------------------------------
     * GET CURRENT AUTHENTICATED USER
     * -----------------------------------------------------
     *
     * Behavior:
     * - Uses authenticated context already attached by middleware
     * - Renders current user and security information
     */
    me = autoCatchFn(async (request, response) => {
        return response.status(200).render("me", {
            success: true,
            message: "Current user fetched successfully",
            user: request.user,
            security: request.userSecurity,
        });
    });
}

const authPageController = new AuthPageController();

export { authPageController, AuthPageController };
export default authPageController;