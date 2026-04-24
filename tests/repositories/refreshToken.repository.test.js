import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockSystemLogger = {
    warn: jest.fn(),
};

class MockBaseRepository {
    constructor(model) {
        if (!model || typeof model !== "function" || !model.modelName) {
            throw new Error("A valid Mongoose model is required");
        }

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
}

const createChainableQuery = (resolvedValue) => ({
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
    catch: (reject) => Promise.resolve(resolvedValue).catch(reject),
});

const mockRefreshTokenModel = function MockRefreshTokenModel() {};
mockRefreshTokenModel.modelName = "RefreshToken";
mockRefreshTokenModel.findActiveByRawToken = jest.fn();

await jest.unstable_mockModule(
    "../../backend/src/repositories/base.repository.js",
    () => ({
        BaseRepository: MockBaseRepository,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/core/pino.logger.js",
    () => ({
        system_logger: mockSystemLogger,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/models/auth/refreshToken.model.js",
    () => ({
        RefreshToken: mockRefreshTokenModel,
    })
);

const {
    RefreshTokenRepository,
    refreshTokenRepository,
    default: defaultRefreshTokenRepository,
} = await import("../../backend/src/repositories/refreshToken.repository.js");

describe("RefreshTokenRepository", () => {
    let repository;

    beforeEach(() => {
        jest.clearAllMocks();
        repository = new RefreshTokenRepository();
    });

    test("should construct with RefreshToken model", () => {
        expect(repository.model).toBe(mockRefreshTokenModel);
        expect(repository.modelName).toBe("RefreshToken");
    });

    test("_applyQueryOptions should apply populate, select, session, and lean only when lean is true", () => {
        const query = createChainableQuery({});

        const result = repository._applyQueryOptions(query, {
            populate: "userId",
            select: "+tokenHash",
            session: "session-1",
            lean: true,
        });

        expect(query.populate).toHaveBeenCalledWith("userId");
        expect(query.select).toHaveBeenCalledWith("+tokenHash");
        expect(query.session).toHaveBeenCalledWith("session-1");
        expect(query.lean).toHaveBeenCalledTimes(1);
        expect(result).toBe(query);
    });

    test("_applyQueryOptions should not apply lean when lean is false", () => {
        const query = createChainableQuery({});

        repository._applyQueryOptions(query, { lean: false });

        expect(query.lean).not.toHaveBeenCalled();
    });

    test("_findOneOrNull should throw when finder is not a function", async () => {
        await expect(
            repository._findOneOrNull({
                value: "raw-token",
                finder: null,
            })
        ).rejects.toThrow("finder must be a function");
    });

    test("_findOneOrNull should return normalized document for non-lean flow", async () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({
                id: "1",
                tokenHash: "hashed",
            }),
        };

        const finder = jest.fn().mockReturnValue(createChainableQuery(doc));

        const result = await repository._findOneOrNull({
            value: "raw-token",
            finder,
            options: {},
        });

        expect(finder).toHaveBeenCalledWith("raw-token");
        expect(result).toEqual({
            id: "1",
            tokenHash: "hashed",
        });
    });

    test("_findOneOrNull should return transformed lean document when lean is true", async () => {
        const doc = { _id: "1", __v: 0, tokenHash: "hashed" };
        const finder = jest.fn().mockReturnValue(createChainableQuery(doc));

        const result = await repository._findOneOrNull({
            value: "raw-token",
            finder,
            options: { lean: true },
        });

        expect(result).toEqual({
            _id: "1",
            id: "1",
            tokenHash: "hashed",
        });
    });

    test("_findOneOrNull should return null and log warning when token is not found", async () => {
        const finder = jest.fn().mockReturnValue(createChainableQuery(null));

        const result = await repository._findOneOrNull({
            value: "missing-token",
            finder,
            logMessage: "Active refresh token not found",
        });

        expect(result).toBeNull();
        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            {
                model: "RefreshToken",
                value: "missing-token",
            },
            "Active refresh token not found"
        );
    });

    test("findActiveByRawToken should trim raw token and delegate to model static", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({
                id: "1",
                tokenHash: "hashed",
            }),
        });

        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        const result = await repository.findActiveByRawToken("  raw-token  ");

        expect(mockRefreshTokenModel.findActiveByRawToken).toHaveBeenCalledWith("raw-token");
        expect(result).toEqual({
            id: "1",
            tokenHash: "hashed",
        });
    });

    test("findActiveByRawToken should support lean results", async () => {
        const query = createChainableQuery({
            _id: "1",
            __v: 0,
            tokenHash: "hashed",
        });

        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        const result = await repository.findActiveByRawToken("raw-token", {
            lean: true,
        });

        expect(result).toEqual({
            _id: "1",
            id: "1",
            tokenHash: "hashed",
        });
    });

    test("revokeByRawToken should return null and log warning when token is not found", async () => {
        const query = createChainableQuery(null);
        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        const result = await repository.revokeByRawToken("missing-token");

        expect(result).toBeNull();
        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            {
                model: "RefreshToken",
                value: "missing-token",
            },
            "Active refresh token not found"
        );
    });

    test("revokeByRawToken should revoke token and return normalized document", async () => {
        const doc = {
            revoke: jest.fn().mockResolvedValue(undefined),
            toObject: jest.fn().mockReturnValue({
                id: "1",
                revokedAt: "2026-01-01T00:00:00.000Z",
            }),
        };

        const query = createChainableQuery(doc);
        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        const result = await repository.revokeByRawToken(
            "  raw-token  ",
            "logout"
        );

        expect(mockRefreshTokenModel.findActiveByRawToken).toHaveBeenCalledWith("raw-token");
        expect(doc.revoke).toHaveBeenCalledWith("logout");
        expect(result).toEqual({
            id: "1",
            revokedAt: "2026-01-01T00:00:00.000Z",
        });
    });

    test("revokeByRawToken should apply session to query and document when supported", async () => {
        const doc = {
            $session: jest.fn(),
            revoke: jest.fn().mockResolvedValue(undefined),
            toObject: jest.fn().mockReturnValue({
                id: "1",
                revokedAt: "2026-01-01T00:00:00.000Z",
            }),
        };

        const query = createChainableQuery(doc);
        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        await repository.revokeByRawToken(
            "raw-token",
            "logout",
            { session: "session-1" }
        );

        expect(query.session).toHaveBeenCalledWith("session-1");
        expect(doc.$session).toHaveBeenCalledWith("session-1");
        expect(doc.revoke).toHaveBeenCalledWith("logout");
    });

    test("revokeByRawToken should support lean output", async () => {
        const doc = {
            revoke: jest.fn().mockResolvedValue(undefined),
            toObject: jest.fn().mockReturnValue({
                _id: "1",
                __v: 0,
                tokenHash: "hashed",
                revokedAt: "2026-01-01T00:00:00.000Z",
            }),
        };

        const query = createChainableQuery(doc);
        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        const result = await repository.revokeByRawToken(
            "raw-token",
            "logout",
            { lean: true }
        );

        expect(result).toEqual({
            _id: "1",
            id: "1",
            tokenHash: "hashed",
            revokedAt: "2026-01-01T00:00:00.000Z",
        });
    });

    test("revokeByRawToken should throw clear error when revoke method is missing", async () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({ id: "1" }),
        };

        const query = createChainableQuery(doc);
        mockRefreshTokenModel.findActiveByRawToken.mockReturnValue(query);

        await expect(
            repository.revokeByRawToken("raw-token")
        ).rejects.toThrow("RefreshToken document does not implement revoke()");
    });

    test("should export singleton repository instance", () => {
        expect(refreshTokenRepository).toBeInstanceOf(RefreshTokenRepository);
    });

    test("default export should be the singleton repository instance", () => {
        expect(defaultRefreshTokenRepository).toBe(refreshTokenRepository);
    });
});