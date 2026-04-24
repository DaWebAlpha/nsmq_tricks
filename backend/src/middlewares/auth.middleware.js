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

/**
 * Normalize ID (supports both _id and id)
 */
const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

const authMiddleware = async (request, response, next) => {
    try {
        const token = getAccessTokenFromRequest(request);

        if (!token) {
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

        /**
         * IMPORTANT:
         * Always fetch with lean: false to retain _id
         */
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

        return next(
            new UnauthenticatedError({
                message: "Unauthorized - Invalid or expired token",
            })
        );
    }
};

export { authMiddleware };
export default authMiddleware;