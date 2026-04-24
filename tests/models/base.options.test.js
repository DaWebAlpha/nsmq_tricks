import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockConfig = {
    NODE_ENV: "development",
};

await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
    config: mockConfig,
}));

const { baseOptions, securityTransform } = await import(
    "../../backend/src/models/base.options.js"
);

describe("base.options", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("securityTransform", () => {
        test("should return value as-is if ret is null or not object", () => {
            expect(securityTransform(null, null)).toBeNull();
            expect(securityTransform(null, undefined)).toBeUndefined();
            expect(securityTransform(null, 123)).toBe(123);
        });

        test("should convert _id to id and remove _id", () => {
            const ret = { _id: "abc123" };

            const result = securityTransform(null, ret);

            expect(result.id).toBe("abc123");
            expect(result._id).toBeUndefined();
        });

        test("should convert ObjectId-like _id to string", () => {
            const ret = {
                _id: {
                    toString: () => "object-id",
                },
            };

            const result = securityTransform(null, ret);

            expect(result.id).toBe("object-id");
        });

        test("should remove sensitive fields", () => {
            const ret = {
                _id: "123",
                password: "secret",
                __v: 1,
                __version: 2,
                token: "raw",
                tokenHash: "hashed",
            };

            const result = securityTransform(null, ret);

            expect(result.password).toBeUndefined();
            expect(result.__v).toBeUndefined();
            expect(result.__version).toBeUndefined();
            expect(result.token).toBeUndefined();
            expect(result.tokenHash).toBeUndefined();
        });

        test("should preserve non-sensitive fields", () => {
            const ret = {
                _id: "123",
                username: "kashi",
                email: "test@test.com",
            };

            const result = securityTransform(null, ret);

            expect(result.username).toBe("kashi");
            expect(result.email).toBe("test@test.com");
        });

        test("should not throw if _id has no toString", () => {
            const ret = {
                _id: 12345,
            };

            const result = securityTransform(null, ret);

            expect(result.id).toBe("12345");
        });
    });

    describe("baseOptions", () => {
        test("should have strict mode enabled", () => {
            expect(baseOptions.strict).toBe(true);
        });

        test("should have strictQuery enabled", () => {
            expect(baseOptions.strictQuery).toBe(true);
        });

        test("should enable timestamps", () => {
            expect(baseOptions.timestamps).toBe(true);
        });

        test("should enable autoIndex in development", () => {
            expect(baseOptions.autoIndex).toBe(true);
        });

        test("should configure toJSON correctly", () => {
            expect(baseOptions.toJSON).toMatchObject({
                virtuals: true,
                getters: true,
                transform: expect.any(Function),
            });
        });

        test("should configure toObject correctly", () => {
            expect(baseOptions.toObject).toMatchObject({
                virtuals: true,
                getters: true,
                transform: expect.any(Function),
            });
        });

        test("should enable id virtual", () => {
            expect(baseOptions.id).toBe(true);
        });
    });
});