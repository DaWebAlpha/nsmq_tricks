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
 * AUTHENTICATION API CONTROLLER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles JSON-based authentication flows.
 *
 * Responsibilities:
 * - Delegates business logic to AuthService
 * - Stores authentication tokens in secure cookies
 * - Issues CSRF token for browser-based clients
 * - Returns only safe JSON response fields
 *
 * Important:
 * - Access and refresh tokens are stored in cookies
 * - JSON responses do not expose raw tokens
 */
class AuthApiController {
    /**
     * -----------------------------------------------------
     * REGISTER NEW USER
     * -----------------------------------------------------
     */
    register = autoCatchFn(async (request, response) => {
        const result = await authService.register(request.body, request);
        const csrfToken = generateCSRFToken();

        setAuthCookies(response, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });

        setCSRFTokenCookie(response, csrfToken);

        return response.status(201).json({
            success: true,
            message: result.message,
            user: result.user,
            security: result.security,
        });
    });

    /**
     * -----------------------------------------------------
     * USER LOGIN
     * -----------------------------------------------------
     */
    login = autoCatchFn(async (request, response) => {
        const result = await authService.login(request.body, request);
        const csrfToken = generateCSRFToken();

        setAuthCookies(response, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).json({
            success: true,
            message: result.message,
            user: result.user,
            security: result.security,
        });
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

        return response.status(200).json({
            success: true,
            message: result.message,
            userId: result.userId,
        });
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

        return response.status(200).json({
            success: true,
            message: result.message,
        });
    });

    /**
     * -----------------------------------------------------
     * GET CURRENT AUTHENTICATED USER
     * -----------------------------------------------------
     *
     * Behavior:
     * - Uses authenticated context already attached by middleware
     * - Returns current user and security information
     */
    me = autoCatchFn(async (request, response) => {
        return response.status(200).json({
            success: true,
            message: "Current user fetched successfully",
            user: request.user,
            security: request.userSecurity,
        });
    });
}

const authApiController = new AuthApiController();

export { authApiController, AuthApiController };
export default authApiController;