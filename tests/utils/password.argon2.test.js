import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockArgon2 = {
    argon2id: "argon2id",
    hash: jest.fn(),
    verify: jest.fn(),
};

const mockSystemLogger = {
    error: jest.fn(),
};

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

await jest.unstable_mockModule("argon2", () => ({
    default: mockArgon2,
}));

await jest.unstable_mockModule(
    "../../backend/src/core/pino.logger.js",
    () => ({
        system_logger: mockSystemLogger,
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

const { hashPassword, verifyPassword } = await import(
    "../../backend/src/utils/password.argon2.js"
);

describe("password.argon2 utils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("hashPassword", () => {
        test("should hash a valid password using Argon2 config", async () => {
            mockArgon2.hash.mockResolvedValue("hashed-password-value");

            const result = await hashPassword("Password123!");

            expect(mockArgon2.hash).toHaveBeenCalledTimes(1);
            expect(mockArgon2.hash).toHaveBeenCalledWith(
                "Password123!",
                expect.objectContaining({
                    type: mockArgon2.argon2id,
                    memoryCost: 2 ** 16,
                    timeCost: 3,
                    parallelism: 2,
                    hashLength: 32,
                })
            );
            expect(result).toBe("hashed-password-value");
        });

        test("should throw BadRequestError when password is not a string", async () => {
            await expect(hashPassword(null)).rejects.toMatchObject({
                name: "BadRequestError",
                statusCode: 400,
                message: "Password must be a string",
            });

            expect(mockArgon2.hash).not.toHaveBeenCalled();
        });

        test("should throw BadRequestError when password is empty", async () => {
            await expect(hashPassword("")).rejects.toMatchObject({
                name: "BadRequestError",
                statusCode: 400,
                message: "Password is required",
            });

            expect(mockArgon2.hash).not.toHaveBeenCalled();
        });

        test("should throw BadRequestError when password is shorter than 8 characters", async () => {
            await expect(hashPassword("Pass12!")).rejects.toMatchObject({
                name: "BadRequestError",
                statusCode: 400,
                message: "Password must be at least 8 characters long",
            });

            expect(mockArgon2.hash).not.toHaveBeenCalled();
        });

        test("should not trim password before hashing", async () => {
            mockArgon2.hash.mockResolvedValue("hashed-password-value");

            await hashPassword("  Password123!  ");

            expect(mockArgon2.hash).toHaveBeenCalledWith(
                "  Password123!  ",
                expect.any(Object)
            );
        });

        test("should log and throw InternalServerError when hashing fails", async () => {
            const hashingError = new Error("argon2 hashing failed");
            mockArgon2.hash.mockRejectedValue(hashingError);

            await expect(hashPassword("Password123!")).rejects.toMatchObject({
                name: "InternalServerError",
                statusCode: 500,
                message: "Internal security error",
            });

            expect(mockSystemLogger.error).toHaveBeenCalledTimes(1);
            expect(mockSystemLogger.error).toHaveBeenCalledWith(
                { err: hashingError },
                "Security: Password hashing failed"
            );
        });
    });

    describe("verifyPassword", () => {
        test("should return true when password matches hash", async () => {
            mockArgon2.verify.mockResolvedValue(true);

            const result = await verifyPassword(
                "Password123!",
                "stored-hash-value"
            );

            expect(mockArgon2.verify).toHaveBeenCalledTimes(1);
            expect(mockArgon2.verify).toHaveBeenCalledWith(
                "stored-hash-value",
                "Password123!"
            );
            expect(result).toBe(true);
        });

        test("should return false when password does not match hash", async () => {
            mockArgon2.verify.mockResolvedValue(false);

            const result = await verifyPassword(
                "WrongPassword123!",
                "stored-hash-value"
            );

            expect(result).toBe(false);
        });

        test("should return false when plainPassword is missing", async () => {
            const result = await verifyPassword("", "stored-hash-value");

            expect(result).toBe(false);
            expect(mockArgon2.verify).not.toHaveBeenCalled();
        });

        test("should return false when hashedPassword is missing", async () => {
            const result = await verifyPassword("Password123!", "");

            expect(result).toBe(false);
            expect(mockArgon2.verify).not.toHaveBeenCalled();
        });

        test("should return false when plainPassword is not a string", async () => {
            const result = await verifyPassword(null, "stored-hash-value");

            expect(result).toBe(false);
            expect(mockArgon2.verify).not.toHaveBeenCalled();
        });

        test("should return false when hashedPassword is not a string", async () => {
            const result = await verifyPassword("Password123!", null);

            expect(result).toBe(false);
            expect(mockArgon2.verify).not.toHaveBeenCalled();
        });

        test("should not trim password before verification", async () => {
            mockArgon2.verify.mockResolvedValue(true);

            await verifyPassword("  Password123!  ", "stored-hash-value");

            expect(mockArgon2.verify).toHaveBeenCalledWith(
                "stored-hash-value",
                "  Password123!  "
            );
        });

        test("should log and return false when verification throws", async () => {
            const verifyError = new Error("argon2 verification failed");
            mockArgon2.verify.mockRejectedValue(verifyError);

            const result = await verifyPassword(
                "Password123!",
                "stored-hash-value"
            );

            expect(result).toBe(false);
            expect(mockSystemLogger.error).toHaveBeenCalledTimes(1);
            expect(mockSystemLogger.error).toHaveBeenCalledWith(
                { err: verifyError },
                "Security: Password verification failed"
            );
        });
    });
});