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
 * PAGE RENDER HELPER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Creates a reusable route handler for rendering views.
 *
 * Behavior:
 * - Sends HTTP 200
 * - Renders specified view
 * - Injects title into template
 * - Issues CSRF token for secure browser forms
 * - Passes flash messages to the page
 */
function renderPage(view, title) {
    return autoCatchFn(async (request, response) => {
        const csrfToken = generateCSRFToken();

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).render(view, {
            title,
            csrfToken,
            success: request.flash?.("success")?.[0],
            error: request.flash?.("error")?.[0],
            oldInput: {},
        });
    });
}

/**
 * ---------------------------------------------------------
 * AUTHENTICATION PAGE CONTROLLER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles both:
 * - Authentication logic (POST requests)
 * - Authentication page rendering (GET requests)
 *
 * Responsibilities:
 * - Delegates business logic to AuthService
 * - Manages authentication cookies
 * - Handles CSRF protection
 * - Renders authentication-related views
 *
 * Important:
 * - Tokens are stored in cookies (never exposed to views)
 * - CSRF tokens are issued for browser security
 */
class AuthPageController {
    /**
     * -----------------------------------------------------
     * AUTH LOGIC (POST ROUTES)
     * -----------------------------------------------------
     */

    register = autoCatchFn(async (request, response) => {
        try {
            const result = await authService.register(request.body, request);
            const csrfToken = generateCSRFToken();

            setAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            });

            setCSRFTokenCookie(response, csrfToken);

            request.flash?.("success", result.message);

            return response.redirect("/dashboard");
        } catch (error) {
            const csrfToken = generateCSRFToken();

            clearAuthCookies(response);
            setCSRFTokenCookie(response, csrfToken);

            return response.status(400).render("pages/auth/register", {
                title: "Register",
                csrfToken,
                success: undefined,
                error: error?.message || "Registration failed",
                oldInput: {
                    username: request.body?.username ?? "",
                    email: request.body?.email ?? "",
                    phoneNumber: request.body?.phoneNumber ?? ""

                },
            });
        }
    });

    login = autoCatchFn(async (request, response) => {
        try {
            const result = await authService.login(request.body, request);
            const csrfToken = generateCSRFToken();

            setAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            });

            setCSRFTokenCookie(response, csrfToken);

            request.flash?.("success", result.message);

            return response.redirect("/dashboard");
        } catch (error) {
            const csrfToken = generateCSRFToken();

            clearAuthCookies(response);
            setCSRFTokenCookie(response, csrfToken);

            return response.status(401).render("pages/auth/login", {
                title: "Login",
                csrfToken,
                success: undefined,
                error: "Invalid credentials",
                oldInput: {
                    identifier: request.body?.identifier ?? "",
                },
            });
        }
    });

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

        return response.redirect("/auth/page/login");
    });

    /**
     * -----------------------------------------------------
     * AUTH VIEW RENDERING (GET ROUTES)
     * -----------------------------------------------------
     */

    getLoginPage = renderPage("pages/auth/login", "Login");

    getRegisterPage = renderPage("pages/auth/register", "Register");

    /**
     * -----------------------------------------------------
     * CURRENT USER VIEW
     * -----------------------------------------------------
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