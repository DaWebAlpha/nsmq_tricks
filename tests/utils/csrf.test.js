import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockCrypto = {
    randomBytes: jest.fn(),
};

const mockSystemLogger = {
    error: jest.fn(),
};

class MockInternalServerError extends Error {
    constructor({ message = "Internal Server Error" } = {}) {
        super(message);
        this.name = "InternalServerError";
        this.statusCode = 500;
    }
}

await jest.unstable_mockModule("crypto", () => ({
    default: mockCrypto,
}));

await jest.unstable_mockModule(
    "../../backend/src/core/pino.logger.js",
    () => ({
        system_logger: mockSystemLogger,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/errors/internalserver.error.js",
    () => ({
        InternalServerError: MockInternalServerError,
    })
);

const { generateCSRFToken } = await import(
    "../../backend/src/utils/csrf.js"
);

describe("generateCSRFToken", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should generate a valid hex token of length 64", () => {
        const buffer = Buffer.alloc(32, 1);
        mockCrypto.randomBytes.mockReturnValue(buffer);

        const token = generateCSRFToken();

        expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        expect(typeof token).toBe("string");
        expect(token.length).toBe(64);
    });

    test("should generate different tokens on multiple calls", () => {
        mockCrypto.randomBytes
            .mockReturnValueOnce(Buffer.from("a".repeat(32)))
            .mockReturnValueOnce(Buffer.from("b".repeat(32)));

        const token1 = generateCSRFToken();
        const token2 = generateCSRFToken();

        expect(token1).not.toBe(token2);
    });

    test("should throw InternalServerError if randomBytes throws", () => {
        const error = new Error("crypto failure");
        mockCrypto.randomBytes.mockImplementation(() => {
            throw error;
        });

        expect(() => generateCSRFToken()).toThrow("Failed to generate CSRF token");

        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            { err: error },
            "Security: CSRF token generation failed"
        );
    });

    test("should throw InternalServerError if buffer length is invalid", () => {
        mockCrypto.randomBytes.mockReturnValue(Buffer.alloc(10));

        expect(() => generateCSRFToken()).toThrow("Failed to generate CSRF token");
    });

    test("should always return lowercase hex string", () => {
        mockCrypto.randomBytes.mockReturnValue(Buffer.from("ff".repeat(32), "hex"));

        const token = generateCSRFToken();

        expect(token).toMatch(/^[a-f0-9]+$/);
    });
});