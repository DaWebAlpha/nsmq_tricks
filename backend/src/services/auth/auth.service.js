import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/jwt.js";
import {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../utils/request.js";
import { system_logger, audit_logger } from "../../core/pino.logger.js";
import { normalizeValue } from "../../utils/string.utils.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { UnauthenticatedError } from "../../errors/unauthenticated.error.js";
import { UnauthorizedError } from "../../errors/unauthorized.error.js";
import { NotFoundError } from "../../errors/notfound.error.js";
import { userRepository } from "../../repositories/user.repository.js";
import { securityRepository } from "../../repositories/security.repository.js";
import withTransaction from "../../utils/db.transaction.js";
import {
    LoginLog
} from "../../models/auth/loginLogs.model.js";
import {
    FailedLoginLog,
    FAILED_LOGIN_REASONS,
} from "../../models/auth/failedLoginLogs.model.js";
import { ACCOUNT_STATUSES } from "../../models/auth/userSecurity.model.js";
import { refreshTokenRepository } from "../../repositories/refreshToken.repository.js";

const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

class AuthService {
    async register(payload = {}, request) {
        const username = normalizeValue(String(payload?.username ?? ""));
        const email = normalizeValue(String(payload?.email ?? ""));
        const password = String(payload?.password ?? "");
        const phoneNumber = String(payload?.phoneNumber ?? "").trim();

        if (!username) throw new BadRequestError({ message: "Username is required" });
        if (!email) throw new BadRequestError({ message: "Email is required" });
        if (!password) throw new BadRequestError({ message: "Password is required" });
        if (!phoneNumber) throw new BadRequestError({ message: "Phone number is required" });

        const [usernameExists, emailExists, phoneExists] = await Promise.all([
            userRepository.checkIfUsernameExists(username),
            userRepository.checkIfEmailExists(email),
            userRepository.checkIfPhoneExists(phoneNumber),
        ]);

        if (usernameExists) throw new ConflictError({ message: "Username already exists" });
        if (emailExists) throw new ConflictError({ message: "Email already exists" });
        if (phoneExists) throw new ConflictError({ message: "Phone number already exists" });

        const deviceName = getDeviceName(request);
        const deviceId = getDeviceId(request);
        const userAgent = getUserAgent(request);
        const ipAddress = getClientIP(request);

        return withTransaction(async (session) => {
            let user;

            try {
                user = await userRepository.create(
                    { username, email, phoneNumber, password },
                    { session }
                );
            } catch (error) {
                if (error.code === 11000) {
                    const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
                    throw new ConflictError({ message: `${field} already exists` });
                }

                if (error.name === "ValidationError") {
                    const messages = Object.values(error.errors).map((e) => e.message);
                    throw new BadRequestError({ message: messages.join("<br />") });
                }

                throw error;
            }

            const userId = resolveId(user);

            if (!userId) {
                throw new BadRequestError({
                    message: "User creation failed: missing user id",
                });
            }

            const security = await securityRepository.create(
                {
                    userId,
                    accountStatus: ACCOUNT_STATUSES.ACTIVE,
                },
                { session }
            );

            const accessToken = generateAccessToken(userId);

            const refreshToken = await generateRefreshToken({
                userId,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
                session,
            });

            audit_logger.info({
                userId,
                deviceId,
                message: "User registered",
            });

            return {
                user,
                security,
                accessToken,
                refreshToken,
                message: "User registered successfully",
            };
        });
    }

    async login(payload = {}, request) {
        const identifier = normalizeValue(String(payload?.identifier ?? ""));
        const password = String(payload?.password ?? "");

        const deviceName = getDeviceName(request);
        const deviceId = getDeviceId(request);
        const userAgent = getUserAgent(request);
        const ipAddress = getClientIP(request);

        if (!identifier || !password) {
            throw new BadRequestError({
                message: "Enter either username, email or phone number and password",
            });
        }

        let user;

        try {
            user = await userRepository.findByIdentifier(identifier);
        } catch (error) {
            if (error instanceof UnauthenticatedError) {
                user = null;
            } else {
                throw error;
            }
        }

        if (!user) {
            await FailedLoginLog.create({
                userId: null,
                identifier,
                ipAddress,
                userAgent,
                deviceName,
                deviceId,
                attemptedAt: new Date(),
                reason: FAILED_LOGIN_REASONS.UNKNOWN_IDENTIFIER,
            });

            throw new UnauthenticatedError({ message: "Invalid credentials" });
        }

        const userId = resolveId(user);

        if (!userId) {
            throw new UnauthenticatedError({ message: "Invalid credentials" });
        }

        let security;

        try {
            security = await securityRepository.findOne({ userId });
        } catch (error) {
            system_logger.error({ userId }, "User security record not found");

            throw new UnauthenticatedError({
                message: "Internal authentication error",
            });
        }

        if (!security) {
            system_logger.error({ userId }, "User security record not found");

            throw new UnauthenticatedError({
                message: "Internal authentication error",
            });
        }

        if (security.isSuspended) {
            await FailedLoginLog.create({
                userId,
                identifier,
                ipAddress,
                userAgent,
                deviceName,
                deviceId,
                attemptedAt: new Date(),
                reason: FAILED_LOGIN_REASONS.BANNED_ACCOUNT,
            });

            audit_logger.warn(
                { userId, deviceId },
                "Login attempted on suspended account"
            );

            throw new UnauthorizedError({
                message: "Account is temporarily suspended. Please try again later",
            });
        }

        if (security.isBanned) {
            await FailedLoginLog.create({
                userId,
                identifier,
                ipAddress,
                userAgent,
                deviceName,
                deviceId,
                attemptedAt: new Date(),
                reason: FAILED_LOGIN_REASONS.BANNED_ACCOUNT,
            });

            audit_logger.warn(
                { userId, deviceId },
                "Login attempted on banned account"
            );

            throw new UnauthorizedError({
                message: "Account is banned. Please contact support for more information.",
            });
        }

        if (security.isLocked) {
            await FailedLoginLog.create({
                userId,
                identifier,
                ipAddress,
                userAgent,
                deviceName,
                deviceId,
                attemptedAt: new Date(),
                reason: FAILED_LOGIN_REASONS.LOCKED_ACCOUNT,
            });

            audit_logger.warn(
                { userId, deviceId },
                "Login attempted on locked account"
            );

            throw new UnauthorizedError({
                message: "Account is locked due to multiple failed login attempts. Please try again later",
            });
        }

        /* console.log("LOGIN USER:", user);
        console.log("HAS PASSWORD:", Boolean(user?.password));
        console.log("HAS comparePassword:", typeof user?.comparePassword);
        console.log("PLAIN PASSWORD:", password); */
        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            await FailedLoginLog.create({
                userId,
                identifier,
                ipAddress,
                userAgent,
                deviceName,
                deviceId,
                attemptedAt: new Date(),
                reason: FAILED_LOGIN_REASONS.INVALID_PASSWORD,
            });

            await security.incrementLoginAttempts();
            await security.save({ validateBeforeSave: false });

            audit_logger.warn(
                { userId, deviceId },
                "Invalid password entered"
            );

            throw new UnauthenticatedError({ message: "Invalid credentials" });
        }

        return withTransaction(async (session) => {
            await security.handleSuccessfulLoginAttempt();
            await security.save({ session });

            const accessToken = generateAccessToken(userId);

            const refreshToken = await generateRefreshToken({
                userId,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
                session,
            });

            audit_logger.info({
                userId,
                deviceId,
                message: "User logged in",
            });

            await LoginLog.create({
                userId: resolveId(user),
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
                loginAt: new Date(),
            });

            return {
                user,
                security,
                accessToken,
                refreshToken,
                message: "Login successful",
            };
        });
    }

    async refreshToken(payload = {}, request) {
        const rawRefreshToken = String(payload?.refreshToken ?? "").trim();

        if (!rawRefreshToken) {
            throw new BadRequestError({ message: "Refresh token is required" });
        }

        return withTransaction(async (session) => {
            const existingToken =
                await refreshTokenRepository.findActiveByRawToken(
                    rawRefreshToken,
                    { session }
                );

            if (!existingToken) {
                throw new UnauthenticatedError({
                    message: "Invalid refresh token",
                });
            }

            const existingTokenUserId = resolveId(existingToken.userId)
                ?? existingToken.userId;

            let user;

            try {
                user = await userRepository.findOne(
                    {
                        _id: existingTokenUserId,
                        isDeleted: false,
                    },
                    { session }
                );
            } catch (error) {
                user = null;
            }

            if (!user) {
                await refreshTokenRepository.revokeByRawToken(
                    rawRefreshToken,
                    "user_not_found",
                    { session }
                );

                throw new UnauthenticatedError({
                    message: "Invalid refresh token",
                });
            }

            const userId = resolveId(user);

            if (!userId) {
                await refreshTokenRepository.revokeByRawToken(
                    rawRefreshToken,
                    "missing_user_id",
                    { session }
                );

                throw new UnauthenticatedError({
                    message: "Invalid refresh token",
                });
            }

            let security;

            try {
                security = await securityRepository.findOne(
                    { userId },
                    { session }
                );
            } catch (error) {
                system_logger.error(
                    { userId },
                    "User security record not found"
                );

                throw new UnauthenticatedError({
                    message: "Internal authentication error",
                });
            }

            if (!security) {
                system_logger.error(
                    { userId },
                    "User security record not found"
                );

                throw new UnauthenticatedError({
                    message: "Internal authentication error",
                });
            }

            if (security.isLocked || security.isBanned || security.isSuspended) {
                await refreshTokenRepository.revokeByRawToken(
                    rawRefreshToken,
                    "security_restricted",
                    { session }
                );

                throw new UnauthorizedError({
                    message: "Account is not allowed to refresh session",
                });
            }

            await refreshTokenRepository.revokeByRawToken(
                rawRefreshToken,
                "rotated",
                { session }
            );

            const accessToken = generateAccessToken(userId);

            const newRefreshToken = await generateRefreshToken({
                userId,
                tokenVersion: (existingToken.tokenVersion || 0) + 1,
                deviceName: existingToken.deviceName,
                deviceId: existingToken.deviceId,
                userAgent: existingToken.userAgent,
                ipAddress: getClientIP(request) || existingToken.ipAddress,
                session,
            });

            audit_logger.info({
                userId,
                deviceId: existingToken.deviceId,
                message: "Refresh token rotated successfully",
            });

            return {
                userId,
                accessToken,
                refreshToken: newRefreshToken,
                message: "Token refreshed successfully",
            };
        });
    }

    async logout(payload = {}, request) {
        const rawRefreshToken = String(payload?.refreshToken ?? "").trim();

        if (!rawRefreshToken) {
            throw new BadRequestError({ message: "Refresh token is required" });
        }

        return withTransaction(async (session) => {
            const existingToken =
                await refreshTokenRepository.findActiveByRawToken(
                    rawRefreshToken,
                    { session }
                );

            if (!existingToken) {
                throw new UnauthenticatedError({
                    message: "Invalid refresh token",
                });
            }

            await refreshTokenRepository.revokeByRawToken(
                rawRefreshToken,
                "logout",
                { session }
            );

            audit_logger.info({
                userId: existingToken.userId,
                deviceId: existingToken.deviceId,
                message: "User logged out successfully",
            });

            return {
                message: "Logged out successfully",
            };
        });
    }

    async me(payload = {}) {
        const userId = String(payload?._id ?? payload?.id ?? "").trim();

        if (!userId) {
            throw new BadRequestError({ message: "User ID is required" });
        }

        return withTransaction(async (session) => {
            let user;

            try {
                user = await userRepository.findOne(
                    {
                        _id: userId,
                        isDeleted: false,
                    },
                    { session }
                );
            } catch (error) {
                throw new NotFoundError({ message: "User not found" });
            }

            const resolvedUserId = resolveId(user);

            if (!resolvedUserId) {
                throw new NotFoundError({ message: "User not found" });
            }

            let security = null;

            try {
                security = await securityRepository.findOne(
                    {
                        userId: resolvedUserId,
                    },
                    { session }
                );
            } catch (error) {
                security = null;
            }

            return {
                user,
                security,
                message: "Current user fetched successfully",
            };
        });
    }
}

const authService = new AuthService();

export { authService, AuthService };
export default authService;