import { jest, describe, test, expect, beforeEach } from "@jest/globals";

class MockUnauthenticatedError extends Error {
    constructor({ message = "Unauthenticated" } = {}) {
        super(message);
        this.name = "UnauthenticatedError";
        this.statusCode = 401;
        this.isOperational = true;
    }
}

class MockUnauthorizedError extends Error {
    constructor({ message = "Unauthorized" } = {}) {
        super(message);
        this.name = "UnauthorizedError";
        this.statusCode = 403;
        this.isOperational = true;
    }
}

const mockSystemLogger = {
    warn: jest.fn(),
};

const mockVerifyAccessToken = jest.fn();
const mockUserRepository = {
    findById: jest.fn(),
};
const mockSecurityRepository = {
    findOne: jest.fn(),
};

const mockAccountStatuses = {
    PENDING: "pending",
    ACTIVE: "active",
    SUSPENDED: "suspended",
    BANNED: "banned",
};

await jest.unstable_mockModule(
    "../../backend/src/errors/unauthenticated.error.js",
    () => ({
        UnauthenticatedError: MockUnauthenticatedError,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/errors/unauthorized.error.js",
    () => ({
        UnauthorizedError: MockUnauthorizedError,
    })
);

await jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
    system_logger: mockSystemLogger,
}));

await jest.unstable_mockModule("../../backend/src/utils/jwt.js", () => ({
    verifyAccessToken: mockVerifyAccessToken,
}));

await jest.unstable_mockModule(
    "../../backend/src/repositories/user.repository.js",
    () => ({
        userRepository: mockUserRepository,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/repositories/security.repository.js",
    () => ({
        securityRepository: mockSecurityRepository,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/models/auth/userSecurity.model.js",
    () => ({
        ACCOUNT_STATUSES: mockAccountStatuses,
    })
);

const { authMiddleware } = await import(
    "../../backend/src/middlewares/auth.middleware.js"
);

describe("authMiddleware", () => {
    let request;
    let response;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        request = {
            headers: {},
        };
        response = {};
        next = jest.fn();
    });

    test("should reject when no token is provided", async () => {
        await authMiddleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Unauthenticated - No token provided",
        });
    });

    test("should reject when bearer token is blank", async () => {
        request.headers.authorization = "Bearer   ";

        await authMiddleware(request, response, next);

        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Unauthenticated - No token provided",
        });
    });

    test("should reject when token payload has no sub", async () => {
        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({});

        await authMiddleware(request, response, next);

        expect(mockVerifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Invalid token payload",
        });
    });

    test("should attach user and proceed when token and account are valid", async () => {
        const mockUser = { _id: "user-1", role: "user" };
        const mockSecurity = { accountStatus: "active" };

        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({ sub: "user-1" });
        mockUserRepository.findById.mockResolvedValue(mockUser);
        mockSecurityRepository.findOne.mockResolvedValue(mockSecurity);

        await authMiddleware(request, response, next);

        expect(mockVerifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1", {
            lean: false,
        });
        expect(mockSecurityRepository.findOne).toHaveBeenCalledWith(
            { userId: "user-1" },
            { lean: false }
        );
        expect(request.user).toBe(mockUser);
        expect(next).toHaveBeenCalledWith();
    });

    test("should reject when user is not found", async () => {
        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({ sub: "user-1" });
        mockUserRepository.findById.mockResolvedValue(null);

        await authMiddleware(request, response, next);

        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Unauthorized - User not found",
        });
    });

    test("should reject when security profile is not found", async () => {
        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({ sub: "user-1" });
        mockUserRepository.findById.mockResolvedValue({ _id: "user-1" });
        mockSecurityRepository.findOne.mockResolvedValue(null);

        await authMiddleware(request, response, next);

        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthorizedError",
            statusCode: 403,
            message: "User security profile not found",
        });
    });

    test("should reject when account is inactive", async () => {
        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({ sub: "user-1" });
        mockUserRepository.findById.mockResolvedValue({ _id: "user-1" });
        mockSecurityRepository.findOne.mockResolvedValue({
            accountStatus: "suspended",
        });

        await authMiddleware(request, response, next);

        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthorizedError",
            statusCode: 403,
            message: "User account is inactive",
        });
    });

    test("should convert token verification failure into UnauthenticatedError", async () => {
        request.headers.authorization = "Bearer broken-token";
        mockVerifyAccessToken.mockImplementation(() => {
            throw new Error("jwt malformed");
        });

        await authMiddleware(request, response, next);

        expect(mockSystemLogger.warn).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Unauthorized - Invalid or expired token",
        });
    });

    test("should convert repository failure into UnauthenticatedError", async () => {
        request.headers.authorization = "Bearer valid-token";
        mockVerifyAccessToken.mockReturnValue({ sub: "user-1" });
        mockUserRepository.findById.mockRejectedValue(new Error("db failed"));

        await authMiddleware(request, response, next);

        expect(mockSystemLogger.warn).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Unauthorized - Invalid or expired token",
        });
    });
});