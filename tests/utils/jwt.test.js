import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockJwt = {
    sign: jest.fn(),
    verify: jest.fn(),
};

const mockRandomBytes = jest.fn();
const mockCreate = jest.fn();
const mockHashToken = jest.fn();
const mockLoggerError = jest.fn();

class MockBadRequestError extends Error {
    constructor({ message = "Bad Request Error", details = null } = {}) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        this.details = details;
        this.isOperational = true;
    }
}

class MockInternalServerError extends Error {
    constructor({ message = "Internal Server Error", details = null } = {}) {
        super(message);
        this.name = "InternalServerError";
        this.statusCode = 500;
        this.details = details;
        this.isOperational = true;
    }
}

await jest.unstable_mockModule("jsonwebtoken", () => ({
    default: mockJwt,
}));

await jest.unstable_mockModule("node:crypto", () => ({
    default: {
        randomBytes: mockRandomBytes,
    },
}));

await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
    config: {
        jwt_access_secret: "test-access-secret",
    },
}));

await jest.unstable_mockModule(
    "../../backend/src/core/pino.logger.js",
    () => ({
        system_logger: {
            error: mockLoggerError,
        },
    })
);

await jest.unstable_mockModule(
    "../../backend/src/models/auth/refreshToken.model.js",
    () => ({
        RefreshToken: {
            create: mockCreate,
            hashToken: mockHashToken,
        },
    })
);

await jest.unstable_mockModule(
    "../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: MockBadRequestError,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/errors/internalserver.error.js",
    () => ({
        InternalServerError: MockInternalServerError,
    })
);

const {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
} = await import("../../backend/src/utils/jwt.js");

describe("jwt utils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("generateAccessToken", () => {
        test("should generate a signed access token", () => {
            mockJwt.sign.mockReturnValue("signed-access-token");

            const result = generateAccessToken("user-123");

            expect(mockJwt.sign).toHaveBeenCalledTimes(1);
            expect(mockJwt.sign).toHaveBeenCalledWith(
                { userId: "user-123" },
                "test-access-secret",
                { expiresIn: 15 * 60 }
            );
            expect(result).toBe("signed-access-token");
        });

        test("should stringify non-string userId values", () => {
            mockJwt.sign.mockReturnValue("signed-access-token");

            generateAccessToken(12345);

            expect(mockJwt.sign).toHaveBeenCalledWith(
                { userId: "12345" },
                "test-access-secret",
                { expiresIn: 15 * 60 }
            );
        });

        test("should throw BadRequestError when userId is missing", () => {
            expect(() => generateAccessToken(null)).toThrow(MockBadRequestError);
            expect(() => generateAccessToken(null)).toThrow(
                "User ID is required to generate access token"
            );

            expect(mockJwt.sign).not.toHaveBeenCalled();
        });
    });

    describe("verifyAccessToken", () => {
        test("should verify and return decoded token payload", () => {
            const decodedPayload = {
                userId: "user-123",
                iat: 111111,
                exp: 222222,
            };

            mockJwt.verify.mockReturnValue(decodedPayload);

            const result = verifyAccessToken("valid-access-token");

            expect(mockJwt.verify).toHaveBeenCalledTimes(1);
            expect(mockJwt.verify).toHaveBeenCalledWith(
                "valid-access-token",
                "test-access-secret"
            );
            expect(result).toEqual(decodedPayload);
        });

        test("should trim token before verifying", () => {
            mockJwt.verify.mockReturnValue({ userId: "user-123" });

            verifyAccessToken("   valid-access-token   ");

            expect(mockJwt.verify).toHaveBeenCalledWith(
                "valid-access-token",
                "test-access-secret"
            );
        });

        test("should throw BadRequestError when token is missing", () => {
            expect(() => verifyAccessToken("")).toThrow(MockBadRequestError);
            expect(() => verifyAccessToken("")).toThrow(
                "Access token is required"
            );

            expect(mockJwt.verify).not.toHaveBeenCalled();
        });

        test("should throw BadRequestError when token is not a string", () => {
            expect(() => verifyAccessToken(null)).toThrow(MockBadRequestError);
            expect(() => verifyAccessToken(123)).toThrow(MockBadRequestError);

            expect(mockJwt.verify).not.toHaveBeenCalled();
        });

        test("should propagate jwt verification errors", () => {
            const jwtError = new Error("jwt malformed");
            mockJwt.verify.mockImplementation(() => {
                throw jwtError;
            });

            expect(() => verifyAccessToken("bad-token")).toThrow("jwt malformed");
        });
    });

    describe("generateRefreshToken", () => {
        test("should generate raw token, hash it, store hashed token, and return raw token", async () => {
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockResolvedValue([
                { _id: "refresh-token-record-id" },
            ]);

            const result = await generateRefreshToken({
                userId: "user-123",
                tokenVersion: 2,
                deviceName: "Kashi Laptop",
                deviceId: "device-123",
                userAgent: "Mozilla/5.0",
                ipAddress: "127.0.0.1",
            });

            expect(mockRandomBytes).toHaveBeenCalledTimes(1);
            expect(mockRandomBytes).toHaveBeenCalledWith(32);
            expect(mockBuffer.toString).toHaveBeenCalledWith("hex");

            expect(mockHashToken).toHaveBeenCalledTimes(1);
            expect(mockHashToken).toHaveBeenCalledWith("raw-refresh-token");

            expect(mockCreate).toHaveBeenCalledTimes(1);

            const [documents, options] = mockCreate.mock.calls[0];

            expect(documents).toHaveLength(1);
            expect(documents[0]).toEqual(
                expect.objectContaining({
                    userId: "user-123",
                    tokenHash: "hashed-refresh-token",
                    tokenVersion: 2,
                    deviceName: "Kashi Laptop",
                    deviceId: "device-123",
                    userAgent: "Mozilla/5.0",
                    ipAddress: "127.0.0.1",
                    expiresAt: expect.any(Date),
                    lastUsedAt: expect.any(Date),
                })
            );

            expect(options).toEqual({});
            expect(result).toBe("raw-refresh-token");
        });

        test("should trim and normalize refresh token metadata", async () => {
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockResolvedValue([{ _id: "record-id" }]);

            await generateRefreshToken({
                userId: "user-123",
                tokenVersion: 0,
                deviceName: "   Kashi Phone   ",
                deviceId: "   device-456   ",
                userAgent: "   Mozilla/5.0   ",
                ipAddress: "   203.0.113.10   ",
            });

            const [documents] = mockCreate.mock.calls[0];

            expect(documents[0]).toEqual(
                expect.objectContaining({
                    deviceName: "Kashi Phone",
                    deviceId: "device-456",
                    userAgent: "Mozilla/5.0",
                    ipAddress: "203.0.113.10",
                })
            );
        });

        test("should normalize empty userAgent and ipAddress to null", async () => {
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockResolvedValue([{ _id: "record-id" }]);

            await generateRefreshToken({
                userId: "user-123",
                deviceId: "device-789",
                deviceName: "",
                userAgent: "   ",
                ipAddress: "   ",
            });

            const [documents] = mockCreate.mock.calls[0];

            expect(documents[0]).toEqual(
                expect.objectContaining({
                    deviceName: "",
                    userAgent: null,
                    ipAddress: null,
                })
            );
        });

        test("should pass session to RefreshToken.create when provided", async () => {
            const session = { id: "session-1" };
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockResolvedValue([{ _id: "record-id" }]);

            await generateRefreshToken({
                userId: "user-123",
                deviceId: "device-123",
                session,
            });

            const [, options] = mockCreate.mock.calls[0];
            expect(options).toEqual({ session });
        });

        test("should default tokenVersion to 0 and deviceName to empty string", async () => {
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockResolvedValue([{ _id: "record-id" }]);

            await generateRefreshToken({
                userId: "user-123",
                deviceId: "device-123",
            });

            const [documents] = mockCreate.mock.calls[0];

            expect(documents[0]).toEqual(
                expect.objectContaining({
                    tokenVersion: 0,
                    deviceName: "",
                })
            );
        });

        test("should throw BadRequestError when userId is missing", async () => {
            await expect(
                generateRefreshToken({
                    deviceId: "device-123",
                })
            ).rejects.toThrow(MockBadRequestError);

            await expect(
                generateRefreshToken({
                    deviceId: "device-123",
                })
            ).rejects.toThrow(
                "User ID is required to generate refresh token"
            );

            expect(mockRandomBytes).not.toHaveBeenCalled();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        test("should throw BadRequestError when deviceId is missing", async () => {
            await expect(
                generateRefreshToken({
                    userId: "user-123",
                })
            ).rejects.toThrow(MockBadRequestError);

            await expect(
                generateRefreshToken({
                    userId: "user-123",
                })
            ).rejects.toThrow(
                "Device ID is required to generate refresh token"
            );

            expect(mockRandomBytes).not.toHaveBeenCalled();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        test("should throw BadRequestError when deviceId is blank", async () => {
            await expect(
                generateRefreshToken({
                    userId: "user-123",
                    deviceId: "   ",
                })
            ).rejects.toThrow(MockBadRequestError);

            expect(mockRandomBytes).not.toHaveBeenCalled();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        test("should log and throw InternalServerError when token persistence fails", async () => {
            const mockBuffer = {
                toString: jest.fn(() => "raw-refresh-token"),
            };

            const databaseError = new Error("database write failed");

            mockRandomBytes.mockReturnValue(mockBuffer);
            mockHashToken.mockReturnValue("hashed-refresh-token");
            mockCreate.mockRejectedValue(databaseError);

            await expect(
                generateRefreshToken({
                    userId: "user-123",
                    deviceId: "device-123",
                })
            ).rejects.toThrow(MockInternalServerError);

            await expect(
                generateRefreshToken({
                    userId: "user-123",
                    deviceId: "device-123",
                })
            ).rejects.toThrow("Internal security error");

            expect(mockLoggerError).toHaveBeenCalledWith(
                {
                    err: databaseError,
                    userId: "user-123",
                    deviceId: "device-123",
                },
                "Security: Failed to persist refresh token"
            );
        });
    });
});