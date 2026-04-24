import crypto from "crypto";
import mongoose from "mongoose";
import {
    jest,
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
} from "@jest/globals";

/**
 * ---------------------------------------------------------
 * MOCK BASE MODEL FACTORY (DO NOT CHANGE PATHS)
 * ---------------------------------------------------------
 */
await jest.unstable_mockModule(
    "../../../backend/src/models/mongoose.model.base.js",
    () => ({
        createBaseModel: (name, definition, configureSchema) => {
            if (mongoose.models[name]) {
                delete mongoose.models[name];
            }

            const schema = new mongoose.Schema(
                {
                    ...definition,
                    isDeleted: {
                        type: Boolean,
                        default: false,
                    },
                    deletedAt: {
                        type: Date,
                        default: null,
                    },
                },
                {
                    timestamps: true,
                    versionKey: false,
                }
            );

            if (typeof configureSchema === "function") {
                configureSchema(schema);
            }

            return mongoose.model(name, schema);
        },
    })
);

/**
 * ---------------------------------------------------------
 * IMPORT MODEL
 * ---------------------------------------------------------
 */
const { RefreshToken } = await import(
    "../../../backend/src/models/auth/refreshToken.model.js"
);

/**
 * ---------------------------------------------------------
 * TEST SUITE
 * ---------------------------------------------------------
 */
describe("RefreshToken model", () => {
    beforeAll(() => {
        if (mongoose.models.RefreshToken) {
            delete mongoose.models.RefreshToken;
        }
    });

    afterAll(() => {
        if (mongoose.models.RefreshToken) {
            delete mongoose.models.RefreshToken;
        }
    });

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    /**
     * ---------------------------------------------------------
     * HELPER: BUILD VALID PAYLOAD
     * ---------------------------------------------------------
     */
    const buildValidPayload = () => ({
        userId: new mongoose.Types.ObjectId(),
        tokenHash: crypto
            .createHash("sha256")
            .update("raw-refresh-token")
            .digest("hex"),
        tokenVersion: 0,
        deviceId: "device-123",
        deviceName: "Chrome",
        userAgent: "Mozilla",
        ipAddress: "127.0.0.1",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    /**
     * ---------------------------------------------------------
     * HELPER: FLEXIBLE INDEX CHECK
     * ---------------------------------------------------------
     */
    const hasIndex = (indexes, expectedFields, expectedOptions = {}) => {
        return indexes.some(([fields, options]) => {
            const sameFields =
                JSON.stringify(fields) === JSON.stringify(expectedFields);

            if (!sameFields) return false;

            return Object.entries(expectedOptions).every(([key, value]) => {
                return (
                    JSON.stringify(options?.[key]) === JSON.stringify(value)
                );
            });
        });
    };

    /**
     * ---------------------------------------------------------
     * HASH TOKEN TESTS
     * ---------------------------------------------------------
     */
    test("hashToken should return SHA-256 hex", () => {
        const raw = "my-token";

        const expected = crypto
            .createHash("sha256")
            .update(raw)
            .digest("hex");

        expect(RefreshToken.hashToken(raw)).toBe(expected);
        expect(RefreshToken.hashToken(raw)).toHaveLength(64);
    });

    test("hashToken should throw for empty input", () => {
        expect(() => RefreshToken.hashToken("")).toThrow();
        expect(() => RefreshToken.hashToken("   ")).toThrow();
        expect(() => RefreshToken.hashToken(null)).toThrow();
    });

    /**
     * ---------------------------------------------------------
     * VALIDATION TESTS
     * ---------------------------------------------------------
     */
    test("should normalize fields", async () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            deviceId: "  abc  ",
            deviceName: "   ",
            userAgent: "  agent ",
            ipAddress: "   ",
        });

        await doc.validate();

        expect(doc.deviceId).toBe("abc");
        expect(doc.deviceName).toBeNull();
        expect(doc.userAgent).toBe("agent");
        expect(doc.ipAddress).toBeNull();
    });

    test("should reject past expiry for new token", async () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            expiresAt: new Date(Date.now() - 1000),
        });

        await expect(doc.validate()).rejects.toThrow();
        expect(doc.errors.expiresAt).toBeDefined();
    });

    test("should reject invalid tokenHash", async () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            tokenHash: "bad-hash",
        });

        await expect(doc.validate()).rejects.toThrow();
    });

    test("should reject non-integer tokenVersion", async () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            tokenVersion: 1.2,
        });

        await expect(doc.validate()).rejects.toThrow();
    });

    /**
     * ---------------------------------------------------------
     * INSTANCE METHODS
     * ---------------------------------------------------------
     */
    test("isActive should return true when valid", () => {
        const doc = new RefreshToken(buildValidPayload());
        expect(doc.isActive()).toBe(true);
    });

    test("isActive should return false when expired", () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            expiresAt: new Date(Date.now() - 1000),
        });

        expect(doc.isActive()).toBe(false);
    });

    test("isActive should return false when revoked", () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            revokedAt: new Date(),
        });

        expect(doc.isActive()).toBe(false);
    });

    test("revoke should set revokedAt and reason", async () => {
        const doc = new RefreshToken(buildValidPayload());

        jest.spyOn(doc, "save").mockResolvedValue(doc);

        await doc.revoke(" logout ");

        expect(doc.revokedAt).toBeInstanceOf(Date);
        expect(doc.revokeReason).toBe("logout");
    });

    test("revoke should be idempotent", async () => {
        const doc = new RefreshToken({
            ...buildValidPayload(),
            revokedAt: new Date(),
            revokeReason: "existing",
        });

        const saveSpy = jest.spyOn(doc, "save");

        await doc.revoke("new");

        expect(saveSpy).not.toHaveBeenCalled();
        expect(doc.revokeReason).toBe("existing");
    });

    /**
     * ---------------------------------------------------------
     * STATIC METHODS
     * ---------------------------------------------------------
     */
    test("findActiveByRawToken should build correct query", () => {
        const spy = jest
            .spyOn(RefreshToken, "findOne")
            .mockReturnValue("QUERY");

        const raw = "token";

        const result = RefreshToken.findActiveByRawToken(raw);

        expect(result).toBe("QUERY");

        const query = spy.mock.calls[0][0];

        expect(query.revokedAt).toBeNull();
        expect(query.isDeleted).toBe(false);
        expect(query.tokenHash).toHaveLength(64);
    });

    /**
     * ---------------------------------------------------------
     * INDEX TEST (FIXED - PRODUCTION SAFE)
     * ---------------------------------------------------------
     */
    test("should expose expected indexes on the schema", () => {
        const indexes = RefreshToken.schema.indexes();

        expect(
            hasIndex(indexes, { tokenHash: 1 }, {
                unique: true,
                partialFilterExpression: { isDeleted: false },
            })
        ).toBe(true);

        expect(
            hasIndex(indexes, { userId: 1, revokedAt: 1, expiresAt: 1 })
        ).toBe(true);

        expect(
            hasIndex(indexes, { userId: 1, deviceId: 1 }, {
                unique: true,
                partialFilterExpression: {
                    revokedAt: null,
                    isDeleted: false,
                },
            })
        ).toBe(true);

        expect(
            hasIndex(indexes, { expiresAt: 1 }, {
                expireAfterSeconds: 0,
            })
        ).toBe(true);
    });
});