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
                    toJSON: { virtuals: true },
                    toObject: { virtuals: true },
                }
            );

            if (typeof configureSchema === "function") {
                configureSchema(schema);
            }

            return mongoose.model(name, schema);
        },
    })
);

await jest.unstable_mockModule("../../../backend/src/config/config.js", () => ({
    config: {
        max_failed_attempts: 5,
        lock_duration: 15 * 60 * 1000,
    },
}));

const { UserSecurity, ACCOUNT_STATUSES } = await import(
    "../../../backend/src/models/auth/userSecurity.model.js"
);

describe("UserSecurity model", () => {
    beforeAll(() => {
        if (mongoose.models.UserSecurity) {
            delete mongoose.models.UserSecurity;
        }
    });

    afterAll(() => {
        if (mongoose.models.UserSecurity) {
            delete mongoose.models.UserSecurity;
        }
    });

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    const buildValidPayload = () => ({
        userId: new mongoose.Types.ObjectId(),
        accountStatus: ACCOUNT_STATUSES.PENDING,
        authVersion: 0,
        banWarningCount: 0,
        accountBanned: false,
        timesAccountHasBeenBanned: 0,
        bannedAt: null,
        bannedUntil: null,
        loginAttempts: 0,
        lockUntil: null,
        lastLoginAt: null,
    });

    const hasIndex = (indexes, expectedFields, expectedOptions = {}) => {
        return indexes.some(([fields, options]) => {
            const sameFields =
                JSON.stringify(fields) === JSON.stringify(expectedFields);

            if (!sameFields) return false;

            return Object.entries(expectedOptions).every(([key, value]) => {
                return JSON.stringify(options?.[key]) === JSON.stringify(value);
            });
        });
    };

    test("should create a valid document", async () => {
        const doc = new UserSecurity(buildValidPayload());
        await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("should reject non-integer authVersion", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            authVersion: 1.5,
        });

        await expect(doc.validate()).rejects.toThrow();
        expect(doc.errors.authVersion).toBeDefined();
    });

    test("should reject non-integer banWarningCount", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            banWarningCount: 1.25,
        });

        await expect(doc.validate()).rejects.toThrow();
        expect(doc.errors.banWarningCount).toBeDefined();
    });

    test("should reject non-integer timesAccountHasBeenBanned", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            timesAccountHasBeenBanned: 2.2,
        });

        await expect(doc.validate()).rejects.toThrow();
        expect(doc.errors.timesAccountHasBeenBanned).toBeDefined();
    });

    test("should reject non-integer loginAttempts", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            loginAttempts: 0.5,
        });

        await expect(doc.validate()).rejects.toThrow();
        expect(doc.errors.loginAttempts).toBeDefined();
    });

    test("should clamp negative counters to zero during validation", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            authVersion: -5,
            banWarningCount: -2,
            timesAccountHasBeenBanned: -3,
            loginAttempts: -1,
        });

        await doc.validate();

        expect(doc.authVersion).toBe(0);
        expect(doc.banWarningCount).toBe(0);
        expect(doc.timesAccountHasBeenBanned).toBe(0);
        expect(doc.loginAttempts).toBe(0);
    });

    test("isLocked should return true when lockUntil is in the future", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            lockUntil: new Date(Date.now() + 60_000),
        });

        expect(doc.isLocked).toBe(true);
    });

    test("isLocked should return false when lockUntil is null", () => {
        const doc = new UserSecurity(buildValidPayload());
        expect(doc.isLocked).toBe(false);
    });

    test("isBanned should return true for permanent ban", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: true,
            accountStatus: ACCOUNT_STATUSES.BANNED,
        });

        expect(doc.isBanned).toBe(true);
    });

    test("isBanned should return true for active temporary suspension", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: false,
            accountStatus: ACCOUNT_STATUSES.SUSPENDED,
            bannedUntil: new Date(Date.now() + 60_000),
        });

        expect(doc.isBanned).toBe(true);
    });

    test("isSuspended should return true only for temporary suspension", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: false,
            accountStatus: ACCOUNT_STATUSES.SUSPENDED,
            bannedUntil: new Date(Date.now() + 60_000),
        });

        expect(doc.isSuspended).toBe(true);
    });

    test("isSuspended should return false for permanent ban", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: true,
            accountStatus: ACCOUNT_STATUSES.BANNED,
            bannedUntil: new Date(Date.now() + 60_000),
        });

        expect(doc.isSuspended).toBe(false);
    });

    test("should clear expired temporary suspension during validation", async () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: false,
            accountStatus: ACCOUNT_STATUSES.SUSPENDED,
            bannedUntil: new Date(Date.now() - 60_000),
        });

        await doc.validate();

        expect(doc.bannedUntil).toBeNull();
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    });

    test("incrementLoginAttempts should increment attempts", () => {
        const doc = new UserSecurity(buildValidPayload());

        doc.incrementLoginAttempts();

        expect(doc.loginAttempts).toBe(1);
        expect(doc.lockUntil).toBeNull();
    });

    test("incrementLoginAttempts should set lockUntil at threshold", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            loginAttempts: 4,
        });

        doc.incrementLoginAttempts();

        expect(doc.loginAttempts).toBe(5);
        expect(doc.lockUntil).toBeInstanceOf(Date);
        expect(doc.lockUntil.getTime()).toBeGreaterThan(Date.now());
    });

    test("incrementLoginAttempts should reset stale expired lock before incrementing", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            loginAttempts: 3,
            lockUntil: new Date(Date.now() - 60_000),
        });

        doc.incrementLoginAttempts();

        expect(doc.loginAttempts).toBe(1);
        expect(doc.lockUntil).toBeNull();
    });

    test("handleSuccessfulLoginAttempt should clear lock state and activate pending account", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            loginAttempts: 5,
            lockUntil: new Date(Date.now() + 60_000),
            accountStatus: ACCOUNT_STATUSES.PENDING,
        });

        doc.handleSuccessfulLoginAttempt();

        expect(doc.loginAttempts).toBe(0);
        expect(doc.lockUntil).toBeNull();
        expect(doc.lastLoginAt).toBeInstanceOf(Date);
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    });

    test("unlockAccount should clear lock state", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            loginAttempts: 5,
            lockUntil: new Date(Date.now() + 60_000),
        });

        doc.unlockAccount();

        expect(doc.loginAttempts).toBe(0);
        expect(doc.lockUntil).toBeNull();
    });

    test("banAccount should apply permanent ban when duration is null", () => {
        const doc = new UserSecurity(buildValidPayload());

        doc.banAccount();

        expect(doc.accountBanned).toBe(true);
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.BANNED);
        expect(doc.bannedAt).toBeInstanceOf(Date);
        expect(doc.bannedUntil).toBeNull();
        expect(doc.timesAccountHasBeenBanned).toBe(1);
        expect(doc.banWarningCount).toBe(0);
    });

    test("banAccount should apply temporary suspension when duration is positive", () => {
        const doc = new UserSecurity(buildValidPayload());

        doc.banAccount(60_000);

        expect(doc.accountBanned).toBe(false);
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.SUSPENDED);
        expect(doc.bannedAt).toBeInstanceOf(Date);
        expect(doc.bannedUntil).toBeInstanceOf(Date);
        expect(doc.bannedUntil.getTime()).toBeGreaterThan(doc.bannedAt.getTime());
        expect(doc.timesAccountHasBeenBanned).toBe(1);
        expect(doc.banWarningCount).toBe(0);
    });

    test("banAccount should treat invalid duration as permanent ban", () => {
        const doc = new UserSecurity(buildValidPayload());

        doc.banAccount("abc");

        expect(doc.accountBanned).toBe(true);
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.BANNED);
        expect(doc.bannedUntil).toBeNull();
    });

    test("unbanAccount should restore active state and clear ban dates", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            accountBanned: true,
            accountStatus: ACCOUNT_STATUSES.BANNED,
            bannedAt: new Date(),
            bannedUntil: new Date(Date.now() + 60_000),
        });

        doc.unbanAccount();

        expect(doc.accountBanned).toBe(false);
        expect(doc.bannedAt).toBeNull();
        expect(doc.bannedUntil).toBeNull();
        expect(doc.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    });

    test("bumpAuthVersion should increment authVersion", () => {
        const doc = new UserSecurity({
            ...buildValidPayload(),
            authVersion: 2,
        });

        doc.bumpAuthVersion();

        expect(doc.authVersion).toBe(3);
    });

    test("should expose expected indexes on the schema", () => {
        const indexes = UserSecurity.schema.indexes();

        expect(
            hasIndex(indexes, { userId: 1 }, {
                unique: true,
                partialFilterExpression: { isDeleted: false },
            })
        ).toBe(true);

        expect(
            hasIndex(indexes, { userId: 1, accountStatus: 1 })
        ).toBe(true);

        expect(
            hasIndex(indexes, { userId: 1, accountBanned: 1 })
        ).toBe(true);
    });
});