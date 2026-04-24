import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const captured = {
    name: null,
    schemaDefinition: null,
    schema: null,
};

const createMockSchema = () => {
    const schema = {
        methods: {},
        statics: {},
        pres: {},
        indexes: [],
        index: jest.fn(function (...args) {
            schema.indexes.push(args);
        }),
        pre: jest.fn(function (event, handler) {
            schema.pres[event] = handler;
        }),
    };

    return schema;
};

const mockCreateBaseModel = jest.fn((name, schemaDefinition, callback) => {
    const schema = createMockSchema();
    captured.name = name;
    captured.schemaDefinition = schemaDefinition;
    captured.schema = schema;
    callback(schema);

    return {
        modelName: name,
        schema,
    };
});

const mockMongoose = {
    Schema: {
        Types: {
            ObjectId: "ObjectId",
        },
    },
};

await jest.unstable_mockModule("mongoose", () => ({
    default: mockMongoose,
}));

await jest.unstable_mockModule(
    "../../../backend/src/models/mongoose.model.base.js",
    () => ({
        createBaseModel: mockCreateBaseModel,
    })
);

const {
    FailedLoginLogs,
    FAILED_LOGIN_REASONS,
    FAILED_LOGIN_REASON_VALUES,
    FAILED_LOGIN_LOG_TTL_SECONDS,
    failedLoginLogsDefinition,
} = await import("../../../backend/src/models/auth/failedLoginLogs.model.js");

describe("failedLoginLogs.model", () => {
    beforeEach(() => {
        /**
         * Do not use jest.clearAllMocks() here.
         * The schema registration happened at import time and these tests
         * intentionally assert import-time calls on schema.index/schema.pre.
         */
        mockCreateBaseModel.mockClear();
    });

    test("should create FailedLoginLogs model through createBaseModel", () => {
        expect(FailedLoginLogs.modelName).toBe("FailedLoginLogs");
        expect(captured.name).toBe("FailedLoginLogs");
    });

    test("should expose failed login reasons", () => {
        expect(FAILED_LOGIN_REASONS.INVALID_CREDENTIALS).toBe(
            "invalid_credentials"
        );
        expect(FAILED_LOGIN_REASONS.INVALID_PASSWORD).toBe("invalid_password");
        expect(FAILED_LOGIN_REASONS.UNKNOWN_IDENTIFIER).toBe(
            "unknown_identifier"
        );
    });

    test("should expose failed login reason values", () => {
        expect(Array.isArray(FAILED_LOGIN_REASON_VALUES)).toBe(true);
        expect(FAILED_LOGIN_REASON_VALUES).toContain("invalid_credentials");
        expect(FAILED_LOGIN_REASON_VALUES).toContain("locked_account");
        expect(FAILED_LOGIN_REASON_VALUES).toContain("invalid_password");
    });

    test("should expose ttl constant", () => {
        expect(FAILED_LOGIN_LOG_TTL_SECONDS).toBe(60 * 60 * 24 * 90);
    });

    test("should define required schema fields", () => {
        expect(failedLoginLogsDefinition).toHaveProperty("userId");
        expect(failedLoginLogsDefinition).toHaveProperty("ipAddress");
        expect(failedLoginLogsDefinition).toHaveProperty("userAgent");
        expect(failedLoginLogsDefinition).toHaveProperty("deviceName");
        expect(failedLoginLogsDefinition).toHaveProperty("attemptedAt");
        expect(failedLoginLogsDefinition).toHaveProperty("reason");
    });

    test("should define nullable userId field", () => {
        expect(failedLoginLogsDefinition.userId.default).toBeNull();
        expect(failedLoginLogsDefinition.userId.ref).toBe("User");
    });

    test("should require ipAddress", () => {
        expect(failedLoginLogsDefinition.ipAddress.required).toEqual([
            true,
            "IP address is required",
        ]);
    });

    test("should default attemptedAt to Date.now", () => {
        expect(failedLoginLogsDefinition.attemptedAt.default).toBe(Date.now);
    });

    test("should default reason to invalid_credentials", () => {
        expect(failedLoginLogsDefinition.reason.default).toBe(
            FAILED_LOGIN_REASONS.INVALID_CREDENTIALS
        );
    });

    test("should restrict reason to controlled enum values", () => {
        expect(failedLoginLogsDefinition.reason.enum).toEqual(
            FAILED_LOGIN_REASON_VALUES
        );
    });

    test("should register validate middleware", () => {
        expect(captured.schema.pre).toHaveBeenCalledWith(
            "validate",
            expect.any(Function)
        );
    });

    test("should register indexes", () => {
        expect(captured.schema.index).toHaveBeenCalled();
        expect(captured.schema.indexes.length).toBeGreaterThan(0);
    });

    test("should register ttl index on attemptedAt", () => {
        expect(captured.schema.index).toHaveBeenCalledWith(
            { attemptedAt: 1 },
            { expireAfterSeconds: FAILED_LOGIN_LOG_TTL_SECONDS }
        );
    });

    test("should register ipAddress and attemptedAt compound index", () => {
        expect(captured.schema.index).toHaveBeenCalledWith(
            { ipAddress: 1, attemptedAt: -1 }
        );
    });

    test("should register reason and attemptedAt compound index", () => {
        expect(captured.schema.index).toHaveBeenCalledWith(
            { reason: 1, attemptedAt: -1 }
        );
    });

    test("should register sparse userId and attemptedAt compound index", () => {
        expect(captured.schema.index).toHaveBeenCalledWith(
            { userId: 1, attemptedAt: -1 },
            { sparse: true }
        );
    });

    test("pre-validate should convert blank userAgent to null", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            userAgent: "   ",
            deviceName: "Chrome on Windows",
        };

        preValidate.call(doc);

        expect(doc.userAgent).toBeNull();
        expect(doc.deviceName).toBe("Chrome on Windows");
    });

    test("pre-validate should convert blank deviceName to null", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            userAgent: "Mozilla/5.0",
            deviceName: "   ",
        };

        preValidate.call(doc);

        expect(doc.userAgent).toBe("Mozilla/5.0");
        expect(doc.deviceName).toBeNull();
    });

    test("pre-validate should trim non-empty optional fields", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            userAgent: "  Mozilla/5.0  ",
            deviceName: "  Chrome Desktop  ",
        };

        preValidate.call(doc);

        expect(doc.userAgent).toBe("Mozilla/5.0");
        expect(doc.deviceName).toBe("Chrome Desktop");
    });

    test("pre-validate should leave null optional fields unchanged", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            userAgent: null,
            deviceName: null,
        };

        preValidate.call(doc);

        expect(doc.userAgent).toBeNull();
        expect(doc.deviceName).toBeNull();
    });
});