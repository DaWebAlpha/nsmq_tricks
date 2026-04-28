import { authService } from "../../services/auth/auth.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import {
    setAuthCookies,
    clearAuthCookies,
    REFRESH_TOKEN_COOKIE_NAME,
} from "../../utils/auth.cookies.js";

function renderPage(view, title) {
    return autoCatchFn(async (request, response) => {
        return response.status(200).render(view, {
            title,
            oldInput: {},
        });
    });
}

const getSafeRedirectPath = (request, fallback = "/dashboard") => {
    const redirectTo = request.query?.redirectTo;

    if (
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        !redirectTo.startsWith("/auth/page/refresh-token")
    ) {
        return redirectTo;
    }

    return fallback;
};

const adminRoles = ["moderator", "admin", "superadmin"];

class AuthPageController {
    register = autoCatchFn(async (request, response) => {
        try {
            const result = await authService.register(request.body, request);

            setAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            });

            request.flash?.("success", result.message);

            return response.redirect("/dashboard");
        } catch (error) {
            clearAuthCookies(response);

            return response.status(400).render("pages/auth/register", {
                title: "Register",
                success: undefined,
                error: error?.message || "Registration failed",
                oldInput: {
                    username: request.body?.username ?? "",
                    email: request.body?.email ?? "",
                    phoneNumber: request.body?.phoneNumber ?? "",
                },
            });
        }
    });

    login = autoCatchFn(async (request, response) => {
        try {
            const result = await authService.login(request.body, request);

            setAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            });

            request.flash?.("success", result.message);

            if (adminRoles.includes(result.user.role)) {
                return response.redirect("/admin/home");
            }

            const redirectTo = getSafeRedirectPath(request, "/dashboard");

            return response.redirect(redirectTo);
        } catch (error) {
            clearAuthCookies(response);

            return response.status(401).render("pages/auth/login", {
                title: "Login",
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

        if (!refreshToken) {
            clearAuthCookies(response);
            request.flash?.("error", "Session expired. Please login again.");

            return response.redirect("/auth/page/login");
        }

        try {
            const result = await authService.refreshToken(
                { refreshToken },
                request
            );

            setAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            });

            const redirectTo = getSafeRedirectPath(request, "/dashboard");

            return response.redirect(redirectTo);
        } catch (error) {
            clearAuthCookies(response);
            request.flash?.("error", "Session expired. Please login again.");

            return response.redirect("/auth/page/login");
        }
    });

    logout = autoCatchFn(async (request, response) => {
        const refreshToken =
            request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ??
            request.body?.refreshToken;

        if (refreshToken) {
            const result = await authService.logout(
                { refreshToken },
                request
            );

            request.flash?.("success", result.message);
        } else {
            request.flash?.("success", "Logged out successfully");
        }

        clearAuthCookies(response);

        return response.redirect("/auth/page/login");
    });

    getLoginPage = renderPage("pages/auth/login", "Login");

    getRegisterPage = renderPage("pages/auth/register", "Register");

    me = autoCatchFn(async (request, response) => {
        return response.status(200).render("me", {
            success: true,
            message: "Current user fetched successfully",
        });
    });
}

const authPageController = new AuthPageController();

export { authPageController, AuthPageController };
export default authPageController;