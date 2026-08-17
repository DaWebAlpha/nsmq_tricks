import { UnauthenticatedError } from "../errors/unauthenticated.error.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { system_logger } from "../core/pino.logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { userRepository } from "../repositories/user.repository.js";
import { securityRepository } from "../repositories/security.repository.js";
import { ACCOUNT_STATUSES } from "../models/auth/userSecurity.model.js";
import {
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    setAuthCookies,
    clearAuthCookies,
} from "../utils/auth.cookies.js";
import { authService } from "../services/auth/auth.service.js";

const getAccessTokenFromRequest = (request) => {
    const authHeader = request.headers?.authorization;

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }

    return request.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null;
};

const getRefreshTokenFromRequest = (request) => {
    return request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ?? null;
};

const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

const isAuthRoute = (request) => {
    return request.originalUrl?.startsWith("/auth/");
};

const isApiRequest = (request) => {
    return (
        request.originalUrl?.startsWith("/auth/api") ||
        request.xhr ||
        request.headers?.accept?.includes("application/json")
    );
};

const isPageRequest = (request) => {
    return request.accepts("html") && !isApiRequest(request);
};

const isAdminPath = (request) => {
    return request.originalUrl?.startsWith("/admin");
};

const getSafeRefreshFallback = (request) => {
    if (isAdminPath(request)) {
        return "/admin/home";
    }

    return "/dashboard";
};

const getSafeRedirectPath = (request) => {
    if (request.method !== "GET") {
        return getSafeRefreshFallback(request);
    }

    return request.originalUrl || getSafeRefreshFallback(request);
};

const redirectToRefresh = (request, response) => {
    const redirectTo = encodeURIComponent(getSafeRedirectPath(request));

    return response.redirect(`/auth/page/refresh-token?redirectTo=${redirectTo}`);
};

const loadAuthenticatedUser = async (userId) => {
    if (!userId) {
        throw new UnauthenticatedError({
            message: "Invalid token payload",
        });
    }

    const user = await userRepository.findById(userId, {
        lean: false,
    });

    const resolvedUserId = resolveId(user);

    if (!user || !resolvedUserId) {
        throw new UnauthenticatedError({
            message: "Unauthorized - User not found",
        });
    }

    const userSecurity = await securityRepository.findOne(
        { userId: resolvedUserId },
        { lean: false }
    );

    if (!userSecurity) {
        throw new UnauthorizedError({
            message: "User security profile not found",
        });
    }

    if (userSecurity.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
        throw new UnauthorizedError({
            message: "User account is inactive",
        });
    }

    return {
        user,
        userSecurity,
    };
};

const refreshExpiredAccessToken = async (request, response) => {
    const refreshToken = getRefreshTokenFromRequest(request);

    if (!refreshToken) {
        throw new UnauthenticatedError({
            message: "Session expired. Please login again.",
        });
    }

    const result = await authService.refreshToken(
        { refreshToken },
        request
    );

    setAuthCookies(response, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
    });

    return verifyAccessToken(result.accessToken);
};

const authMiddleware = async (request, response, next) => {
    try {
        const token = getAccessTokenFromRequest(request);

        if (!token) {
            if (isPageRequest(request) && !isAuthRoute(request)) {
                return redirectToRefresh(request, response);
            }

            return next(
                new UnauthenticatedError({
                    message: "Unauthenticated - No token provided",
                })
            );
        }

        let decoded;

        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            if (error?.name !== "TokenExpiredError") {
                throw error;
            }

            decoded = await refreshExpiredAccessToken(request, response);
        }

        const tokenUserId = decoded?.sub ?? decoded?.userId ?? decoded?.id;

        const { user, userSecurity } = await loadAuthenticatedUser(tokenUserId);

        request.user = user;
        request.userSecurity = userSecurity;

        return next();
    } catch (error) {
        system_logger.warn(
            {
                message: error?.message,
                stack: error?.stack,
            },
            "Authentication failed"
        );

        clearAuthCookies(response);

        if (isPageRequest(request) && !isAuthRoute(request)) {
            return redirectToRefresh(request, response);
        }

        return next(
            new UnauthenticatedError({
                message: "Unauthorized - Invalid or expired token",
            })
        );
    }
};

export { authMiddleware };
export default authMiddleware;