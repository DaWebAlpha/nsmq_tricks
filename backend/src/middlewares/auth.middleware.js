import { UnauthenticatedError } from "../errors/unauthenticated.error.js";
import { UnauthorizedError } from "../errors/unauthorized.error.js";
import { system_logger } from "../core/pino.logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { userRepository } from "../repositories/user.repository.js";
import { securityRepository } from "../repositories/security.repository.js";
import { ACCOUNT_STATUSES } from "../models/auth/userSecurity.model.js";
import { ACCESS_TOKEN_COOKIE_NAME } from "../utils/auth.cookies.js";

const getAccessTokenFromRequest = (request) => {
    const authHeader = request.headers?.authorization;

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7).trim();
    }

    return request.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null;
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

const redirectToRefresh = (request, response) => {
    const redirectTo = encodeURIComponent(request.originalUrl || "/dashboard");

    return response.redirect(
        `/auth/page/refresh-token?redirectTo=${redirectTo}`
    );
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

        const decoded = verifyAccessToken(token);

        const tokenUserId = decoded?.sub ?? decoded?.userId ?? decoded?.id;

        if (!tokenUserId) {
            return next(
                new UnauthenticatedError({
                    message: "Invalid token payload",
                })
            );
        }

        const user = await userRepository.findById(tokenUserId, {
            lean: false,
        });

        const userId = resolveId(user);

        if (!user || !userId) {
            return next(
                new UnauthenticatedError({
                    message: "Unauthorized - User not found",
                })
            );
        }

        const userSecurity = await securityRepository.findOne(
            { userId },
            { lean: false }
        );

        if (!userSecurity) {
            return next(
                new UnauthorizedError({
                    message: "User security profile not found",
                })
            );
        }

        if (userSecurity.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
            return next(
                new UnauthorizedError({
                    message: "User account is inactive",
                })
            );
        }

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