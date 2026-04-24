import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockNormalizeValue = jest.fn((value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
);

const mockSystemLogger = {
    error: jest.fn(),
};

class MockUnauthenticatedError extends Error {
    constructor(message = "Unauthenticated") {
        super(message);
        this.name = "UnauthenticatedError";
        this.statusCode = 401;
        this.isOperational = true;
    }
}

class MockBaseRepository {
    constructor(model) {
        this.model = model;
        this.modelName = model.modelName;
    }

    _transformLean(doc) {
        if (!doc) return doc;

        if (Array.isArray(doc)) {
            return doc.map((item) => this._transformLean(item));
        }

        const cleanDoc = { ...doc };

        if (cleanDoc._id && !cleanDoc.id) {
            cleanDoc.id = String(cleanDoc._id);
        }

        delete cleanDoc.__v;
        delete cleanDoc.__version;

        return cleanDoc;
    }

    _normalizeDoc(doc) {
        if (!doc) return doc;

        if (Array.isArray(doc)) {
            return doc.map((item) => this._normalizeDoc(item));
        }

        if (typeof doc?.toObject === "function") {
            return doc.toObject();
        }

        return this._transformLean(doc);
    }

    exists = jest.fn();
}

const createChainableQuery = (resolvedValue) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
    catch: (reject) => Promise.resolve(resolvedValue).catch(reject),
});

const mockUserModel = function MockUserModel() {};
mockUserModel.modelName = "User";
mockUserModel.findByIdentifier = jest.fn();
mockUserModel.findByEmail = jest.fn();
mockUserModel.findByUsername = jest.fn();
mockUserModel.findByPhoneNumber = jest.fn();

await jest.unstable_mockModule("../../backend/src/models/auth/user.model.js", () => ({
    User: mockUserModel,
}));

await jest.unstable_mockModule("../../backend/src/utils/string.utils.js", () => ({
    normalizeValue: mockNormalizeValue,
}));

await jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
    system_logger: mockSystemLogger,
}));

await jest.unstable_mockModule("../../backend/src/errors/unauthenticated.error.js", () => ({
    UnauthenticatedError: MockUnauthenticatedError,
}));

await jest.unstable_mockModule("../../backend/src/repositories/base.repository.js", () => ({
    BaseRepository: MockBaseRepository,
}));

const { UserRepository } = await import(
    "../../backend/src/repositories/user.repository.js"
);

describe("UserRepository", () => {
    let repository;

    beforeEach(() => {
        jest.clearAllMocks();
        repository = new UserRepository();
    });

    test("_applyQueryOptions should apply populate, select, session, and lean when lean is true", () => {
        const query = createChainableQuery({});

        const result = repository._applyQueryOptions(query, {
            populate: "profile",
            select: "+password email",
            session: "session-1",
            lean: true,
        });

        expect(query.populate).toHaveBeenCalledWith("profile");
        expect(query.select).toHaveBeenCalledWith("+password email");
        expect(query.session).toHaveBeenCalledWith("session-1");
        expect(query.lean).toHaveBeenCalledTimes(1);
        expect(result).toBe(query);
    });

    test("_applyQueryOptions should not apply lean when lean is false", () => {
        const query = createChainableQuery({});

        repository._applyQueryOptions(query, {
            lean: false,
        });

        expect(query.lean).not.toHaveBeenCalled();
    });

    test("_findOneOrThrow should throw when finder is not a function", async () => {
        await expect(
            repository._findOneOrThrow({
                value: "abc",
                finder: null,
            })
        ).rejects.toThrow("finder must be a function");
    });

    test("_findOneOrThrow should return normalized doc for non-lean flow", async () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({ id: "1", email: "test@example.com" }),
        };

        const finder = jest.fn().mockReturnValue(createChainableQuery(doc));

        const result = await repository._findOneOrThrow({
            value: "test@example.com",
            finder,
            logLabel: "email",
            options: {},
        });

        expect(finder).toHaveBeenCalledWith("test@example.com");
        expect(result).toEqual({ id: "1", email: "test@example.com" });
    });

    test("_findOneOrThrow should return transformed lean doc when lean is true", async () => {
        const doc = { _id: "abc", __v: 0, username: "kashi" };
        const finder = jest.fn().mockReturnValue(createChainableQuery(doc));

        const result = await repository._findOneOrThrow({
            value: "kashi",
            finder,
            options: { lean: true },
        });

        expect(result).toEqual({
            _id: "abc",
            id: "abc",
            username: "kashi",
        });
    });

    test("_findOneOrThrow should log and throw UnauthenticatedError when user is not found", async () => {
        const finder = jest.fn().mockReturnValue(createChainableQuery(null));

        await expect(
            repository._findOneOrThrow({
                value: "missing@example.com",
                finder,
                errorMessage: "Invalid email",
                logLabel: "email",
            })
        ).rejects.toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message: "Invalid email",
        });

        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            {
                model: "User",
                logLabel: "email",
                value: "missing@example.com",
            },
            "User lookup failed"
        );
    });

    test("checkIfUsernameExists should return false for empty username", async () => {
        const result = await repository.checkIfUsernameExists("");

        expect(result).toBe(false);
        expect(repository.exists).not.toHaveBeenCalled();
    });

    test("checkIfUsernameExists should normalize username and return boolean", async () => {
        repository.exists.mockResolvedValue({ _id: "1" });

        const result = await repository.checkIfUsernameExists("  Kashi  ", {
            session: "s1",
        });

        expect(mockNormalizeValue).toHaveBeenCalledWith("  Kashi  ");
        expect(repository.exists).toHaveBeenCalledWith(
            { username: "kashi" },
            { session: "s1" }
        );
        expect(result).toBe(true);
    });

    test("checkIfEmailExists should return false for empty email", async () => {
        const result = await repository.checkIfEmailExists("");

        expect(result).toBe(false);
        expect(repository.exists).not.toHaveBeenCalled();
    });

    test("checkIfEmailExists should normalize email and return boolean", async () => {
        repository.exists.mockResolvedValue(null);

        const result = await repository.checkIfEmailExists("  TEST@EXAMPLE.COM  ");

        expect(mockNormalizeValue).toHaveBeenCalledWith("  TEST@EXAMPLE.COM  ");
        expect(repository.exists).toHaveBeenCalledWith(
            { email: "test@example.com" },
            {}
        );
        expect(result).toBe(false);
    });

    test("checkIfPhoneExists should return false for empty phone number", async () => {
        const result = await repository.checkIfPhoneExists("   ");

        expect(result).toBe(false);
        expect(mockUserModel.findByPhoneNumber).not.toHaveBeenCalled();
    });

    test("checkIfPhoneExists should use model static and return true when found", async () => {
        const query = createChainableQuery({ _id: "1" });
        mockUserModel.findByPhoneNumber.mockReturnValue(query);

        const result = await repository.checkIfPhoneExists(" 0241234567 ", {
            session: "s1",
            lean: true,
        });

        expect(mockUserModel.findByPhoneNumber).toHaveBeenCalledWith("0241234567");
        expect(query.session).toHaveBeenCalledWith("s1");
        expect(query.lean).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
    });

    test("findByIdentifier should trim raw identifier and delegate correctly", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({ id: "1", username: "kashi" }),
        });

        mockUserModel.findByIdentifier.mockReturnValue(query);

        const result = await repository.findByIdentifier("  Kashi  ");

        expect(mockUserModel.findByIdentifier).toHaveBeenCalledWith("Kashi");
        expect(result).toEqual({ id: "1", username: "kashi" });
    });

    test("findByEmail should normalize email and delegate correctly", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({ id: "1", email: "user@example.com" }),
        });

        mockUserModel.findByEmail.mockReturnValue(query);

        const result = await repository.findByEmail("  USER@example.com  ");

        expect(mockNormalizeValue).toHaveBeenCalledWith("  USER@example.com  ");
        expect(mockUserModel.findByEmail).toHaveBeenCalledWith("user@example.com");
        expect(result).toEqual({ id: "1", email: "user@example.com" });
    });

    test("findByUsername should normalize username and delegate correctly", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({ id: "1", username: "kashi" }),
        });

        mockUserModel.findByUsername.mockReturnValue(query);

        const result = await repository.findByUsername("  Kashi  ");

        expect(mockNormalizeValue).toHaveBeenCalledWith("  Kashi  ");
        expect(mockUserModel.findByUsername).toHaveBeenCalledWith("kashi");
        expect(result).toEqual({ id: "1", username: "kashi" });
    });

    test("findByPhoneNumber should trim phone number and delegate correctly", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({ id: "1", phoneNumber: "+233241234567" }),
        });

        mockUserModel.findByPhoneNumber.mockReturnValue(query);

        const result = await repository.findByPhoneNumber(" 0241234567 ");

        expect(mockUserModel.findByPhoneNumber).toHaveBeenCalledWith("0241234567");
        expect(result).toEqual({ id: "1", phoneNumber: "+233241234567" });
    });

    test("findByPhoneNumber should support lean responses", async () => {
        const query = createChainableQuery({
            _id: "1",
            __v: 0,
            phoneNumber: "+233241234567",
        });

        mockUserModel.findByPhoneNumber.mockReturnValue(query);

        const result = await repository.findByPhoneNumber("0241234567", {
            lean: true,
        });

        expect(result).toEqual({
            _id: "1",
            id: "1",
            phoneNumber: "+233241234567",
        });
    });
});