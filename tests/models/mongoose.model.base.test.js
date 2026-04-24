import { jest, describe, test, expect, beforeEach } from "@jest/globals";

/**
 * ---------------------------------------------------------
 * MOCKS
 * ---------------------------------------------------------
 */
const mockBadRequestError = class extends Error {
    constructor({ message = "Bad Request Error", details = null } = {}) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        this.details = details;
        this.isOperational = true;
    }
};

const mockBaseOptions = {
    strict: true,
    strictQuery: true,
    timestamps: true,
    autoIndex: true,
    toJSON: {
        virtuals: true,
        getters: true,
        transform: jest.fn(),
    },
    toObject: {
        virtuals: true,
        getters: true,
        transform: jest.fn(),
    },
    id: true,
};

const mockDOMPurify = {
    sanitize: jest.fn((value) => `sanitized:${value}`),
};

const mockWindow = {};

/**
 * ---------------------------------------------------------
 * SCHEMA MOCK
 * ---------------------------------------------------------
 */
class MockSchema {
    constructor(definition, options) {
        this.definition = definition;
        this.options = options;
        this.methods = {};
        this.statics = {};
        this.hooks = {};
        this.paths = {};

        for (const [key, value] of Object.entries(definition)) {
            this.paths[key] = {
                instance:
                    value?.type === String
                        ? "String"
                        : value?.type === Boolean
                          ? "Boolean"
                          : value?.type === Date
                            ? "Date"
                            : "ObjectID",
            };
        }
    }

    pre(event, handler) {
        this.hooks[event] = handler;
    }

    path(pathName) {
        return this.paths[pathName];
    }
}

const mockSchemaConstructor = jest.fn((definition, options) => {
    return new MockSchema(definition, options);
});

mockSchemaConstructor.Types = {
    ObjectId: "ObjectId",
};

const mockMongoose = {
    Schema: mockSchemaConstructor,
    model: jest.fn(),
    models: {},
};

await jest.unstable_mockModule("mongoose", () => ({
    default: mockMongoose,
}));

await jest.unstable_mockModule("../../backend/src/models/base.options.js", () => ({
    baseOptions: mockBaseOptions,
}));

await jest.unstable_mockModule("dompurify", () => ({
    default: jest.fn(() => mockDOMPurify),
}));

await jest.unstable_mockModule("jsdom", () => ({
    JSDOM: jest.fn(() => ({
        window: mockWindow,
    })),
}));

await jest.unstable_mockModule(
    "../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: mockBadRequestError,
    })
);

const {
    createBaseModel,
    baseFields,
    sanitizeString,
} = await import("../../backend/src/models/mongoose.model.base.js");

describe("mongoose.model.base", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMongoose.models = {};
    });

    describe("sanitizeString", () => {
        test("should sanitize, normalize, and trim string input", () => {
            const value = "  Hello  ";
            const result = sanitizeString(value);

            expect(mockDOMPurify.sanitize).toHaveBeenCalledTimes(1);
            expect(mockDOMPurify.sanitize).toHaveBeenCalledWith("  Hello  ");
            expect(result).toBe("sanitized:  Hello");
        });

        test("should return non-string values unchanged", () => {
            expect(sanitizeString(null)).toBeNull();
            expect(sanitizeString(undefined)).toBeUndefined();
            expect(sanitizeString(123)).toBe(123);
            expect(sanitizeString(true)).toBe(true);
        });
    });

    describe("baseFields", () => {
        test("should include standard audit and soft delete fields", () => {
            expect(baseFields).toHaveProperty("deletedBy");
            expect(baseFields).toHaveProperty("isDeleted");
            expect(baseFields).toHaveProperty("deletedAt");
            expect(baseFields).toHaveProperty("createdBy");
            expect(baseFields).toHaveProperty("updatedBy");
        });

        test("should default isDeleted to false", () => {
            expect(baseFields.isDeleted.default).toBe(false);
        });
    });

    describe("createBaseModel", () => {
        test("should throw when model name is invalid", () => {
            expect(() => createBaseModel("")).toThrow(
                "Model name must be a non-empty string"
            );
            expect(() => createBaseModel(null, {})).toThrow(
                "Model name must be a non-empty string"
            );
        });

        test("should throw when schema definition is invalid", () => {
            expect(() => createBaseModel("User", null)).toThrow(
                "Schema definition must be a valid object"
            );
            expect(() => createBaseModel("User", [])).toThrow(
                "Schema definition must be a valid object"
            );
        });

        test("should throw when configCallback is invalid", () => {
            expect(() =>
                createBaseModel("User", { name: { type: String } }, "bad")
            ).toThrow("configCallback must be a function when provided");
        });

        test("should create schema with custom fields and base fields", () => {
            const mockModel = { modelName: "User" };
            mockMongoose.model.mockReturnValue(mockModel);

            const model = createBaseModel("User", {
                name: { type: String },
                age: { type: Number },
            });

            expect(mockSchemaConstructor).toHaveBeenCalledTimes(1);

            const [definition, options] = mockSchemaConstructor.mock.calls[0];

            expect(definition).toHaveProperty("name");
            expect(definition).toHaveProperty("age");
            expect(definition).toHaveProperty("deletedBy");
            expect(definition).toHaveProperty("isDeleted");
            expect(definition).toHaveProperty("deletedAt");
            expect(definition).toHaveProperty("createdBy");
            expect(definition).toHaveProperty("updatedBy");
            expect(options).toBe(mockBaseOptions);
            expect(model).toBe(mockModel);
        });

        test("should return existing model if already compiled", () => {
            const existingModel = { modelName: "User" };
            mockMongoose.models.User = existingModel;

            const model = createBaseModel("User", {
                name: { type: String },
            });

            expect(mockMongoose.model).not.toHaveBeenCalled();
            expect(model).toBe(existingModel);
        });

        test("should call configCallback with schema", () => {
            const configCallback = jest.fn();
            const mockModel = { modelName: "User" };
            mockMongoose.model.mockReturnValue(mockModel);

            createBaseModel(
                "User",
                {
                    name: { type: String },
                },
                configCallback
            );

            expect(configCallback).toHaveBeenCalledTimes(1);
            expect(configCallback).toHaveBeenCalledWith(expect.any(MockSchema));
        });

        test("should register pre-validate hook", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            expect(schema.hooks).toHaveProperty("validate");
            expect(typeof schema.hooks.validate).toBe("function");
        });

        test("should sanitize modified top-level string fields in pre-validate hook", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
                bio: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preValidate = schema.hooks.validate;

            const doc = {
                schema,
                modifiedPaths: jest.fn(() => ["name", "bio"]),
                get: jest.fn((path) => {
                    if (path === "name") return "  Alice  ";
                    if (path === "bio") return "<b>Hello</b>";
                    return null;
                }),
                set: jest.fn(),
            };

            preValidate.call(doc);

            expect(doc.set).toHaveBeenCalledTimes(2);
            expect(doc.set).toHaveBeenNthCalledWith(1, "name", "sanitized:  Alice");
            expect(doc.set).toHaveBeenNthCalledWith(2, "bio", "sanitized:<b>Hello</b>");
        });

        test("should not sanitize excluded sensitive fields", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                password: { type: String },
                token: { type: String },
                tokenHash: { type: String },
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preValidate = schema.hooks.validate;

            const doc = {
                schema,
                modifiedPaths: jest.fn(() => ["password", "token", "tokenHash", "name"]),
                get: jest.fn((path) => {
                    if (path === "password") return "secret";
                    if (path === "token") return "jwt";
                    if (path === "tokenHash") return "hash";
                    if (path === "name") return " John ";
                    return null;
                }),
                set: jest.fn(),
            };

            preValidate.call(doc);

            expect(doc.set).toHaveBeenCalledTimes(1);
            expect(doc.set).toHaveBeenCalledWith("name", "sanitized: John");
        });

        test("should not sanitize nested paths", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                title: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preValidate = schema.hooks.validate;

            const doc = {
                schema,
                modifiedPaths: jest.fn(() => ["profile.bio", "title"]),
                get: jest.fn((path) => {
                    if (path === "profile.bio") return "<script>x</script>";
                    if (path === "title") return " Boss ";
                    return null;
                }),
                set: jest.fn(),
            };

            preValidate.call(doc);

            expect(doc.set).toHaveBeenCalledTimes(1);
            expect(doc.set).toHaveBeenCalledWith("title", "sanitized: Boss");
        });

        test("should register pre-find hook", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            expect(schema.hooks).toHaveProperty("/^find/");
            expect(typeof schema.hooks["/^find/"]).toBe("function");
        });

        test("should apply soft delete filter in find hook when isDeleted is not present", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preFind = schema.hooks["/^find/"];

            const query = {
                getQuery: jest.fn(() => ({ name: "John" })),
                where: jest.fn(),
            };

            preFind.call(query);

            expect(query.where).toHaveBeenCalledWith({ isDeleted: false });
        });

        test("should not override explicit isDeleted filter in find hook", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preFind = schema.hooks["/^find/"];

            const query = {
                getQuery: jest.fn(() => ({ isDeleted: true })),
                where: jest.fn(),
            };

            preFind.call(query);

            expect(query.where).not.toHaveBeenCalled();
        });

        test("should register pre-aggregate hook", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            expect(schema.hooks).toHaveProperty("aggregate");
            expect(typeof schema.hooks.aggregate).toBe("function");
        });

        test("should prepend aggregate soft delete match when missing", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preAggregate = schema.hooks.aggregate;

            const pipeline = [{ $sort: { createdAt: -1 } }];
            const aggregate = {
                pipeline: jest.fn(() => pipeline),
            };

            preAggregate.call(aggregate);

            expect(pipeline[0]).toEqual({ $match: { isDeleted: false } });
            expect(pipeline[1]).toEqual({ $sort: { createdAt: -1 } });
        });

        test("should not add aggregate soft delete match when pipeline already handles isDeleted", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preAggregate = schema.hooks.aggregate;

            const pipeline = [{ $match: { isDeleted: true } }];
            const aggregate = {
                pipeline: jest.fn(() => pipeline),
            };

            preAggregate.call(aggregate);

            expect(pipeline).toEqual([{ $match: { isDeleted: true } }]);
        });

        test("should insert aggregate match after $geoNear", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const preAggregate = schema.hooks.aggregate;

            const pipeline = [
                { $geoNear: { near: [0, 0], distanceField: "distance" } },
                { $sort: { createdAt: -1 } },
            ];

            const aggregate = {
                pipeline: jest.fn(() => pipeline),
            };

            preAggregate.call(aggregate);

            expect(pipeline[0]).toHaveProperty("$geoNear");
            expect(pipeline[1]).toEqual({ $match: { isDeleted: false } });
            expect(pipeline[2]).toEqual({ $sort: { createdAt: -1 } });
        });

        test("should attach instance methods", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            expect(typeof schema.methods.softDelete).toBe("function");
            expect(typeof schema.methods.restoreDelete).toBe("function");
            expect(typeof schema.methods.hardDelete).toBe("function");
        });

        test("softDelete should mark document as deleted and save without validation", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const doc = {
                isDeleted: false,
                deletedBy: null,
                deletedAt: null,
                save: jest.fn().mockResolvedValue("saved"),
            };

            const result = await schema.methods.softDelete.call(doc, "user-id");

            expect(doc.isDeleted).toBe(true);
            expect(doc.deletedBy).toBe("user-id");
            expect(doc.deletedAt).toBeInstanceOf(Date);
            expect(doc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
            expect(result).toBe("saved");
        });

        test("restoreDelete should restore document and save without validation", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const doc = {
                isDeleted: true,
                deletedBy: "deleter",
                deletedAt: new Date(),
                updatedBy: null,
                save: jest.fn().mockResolvedValue("restored"),
            };

            const result = await schema.methods.restoreDelete.call(doc, "updater-id");

            expect(doc.isDeleted).toBe(false);
            expect(doc.deletedBy).toBeNull();
            expect(doc.deletedAt).toBeNull();
            expect(doc.updatedBy).toBe("updater-id");
            expect(doc.save).toHaveBeenCalledWith({ validateBeforeSave: false });
            expect(result).toBe("restored");
        });

        test("hardDelete should call deleteOne", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;
            const doc = {
                deleteOne: jest.fn().mockResolvedValue("deleted"),
            };

            const result = await schema.methods.hardDelete.call(doc);

            expect(doc.deleteOne).toHaveBeenCalledTimes(1);
            expect(result).toBe("deleted");
        });

        test("should attach paginate static", () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            expect(typeof schema.statics.paginate).toBe("function");
        });

        test("paginate should return paginated result with defaults", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([{ name: "John" }]);
            const lean = jest.fn(() => ({ exec }));
            const limit = jest.fn(() => ({ lean }));
            const skip = jest.fn(() => ({ limit }));

            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(1);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            const result = await schema.statics.paginate.call(modelContext);

            expect(find).toHaveBeenCalledWith(
                { isDeleted: false },
                {},
                { sort: {}, session: undefined }
            );

            expect(result).toEqual({
                data: [{ name: "John" }],
                page: 1,
                limit: 20,
                total: 1,
                total_pages: 1,
                has_next_page: false,
                has_prev_page: false,
            });
        });

        test("paginate should respect explicit isDeleted filter", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const limit = jest.fn(() => ({ lean }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            await schema.statics.paginate.call(
                modelContext,
                { isDeleted: true },
                1,
                20
            );

            expect(find).toHaveBeenCalledWith(
                { isDeleted: true },
                {},
                { sort: {}, session: undefined }
            );
        });

        test("paginate should clamp invalid page and limit values", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const limit = jest.fn(() => ({ lean }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            const result = await schema.statics.paginate.call(
                modelContext,
                {},
                -5,
                0
            );

            expect(skip).toHaveBeenCalledWith(0);
            expect(limit).toHaveBeenCalledWith(20);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
        });

        test("paginate should enforce maxLimit", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const limit = jest.fn(() => ({ lean }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            const result = await schema.statics.paginate.call(
                modelContext,
                {},
                1,
                1000,
                {},
                { maxLimit: 50 }
            );

            expect(limit).toHaveBeenCalledWith(50);
            expect(result.limit).toBe(50);
        });

        test("paginate should apply populate array", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const populate2 = jest.fn(() => ({ lean }));
            const populate1 = jest.fn(() => ({ populate: populate2 }));
            const limit = jest.fn(() => ({ populate: populate1 }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            await schema.statics.paginate.call(
                modelContext,
                {},
                1,
                20,
                {},
                { populate: ["author", "category"] }
            );

            expect(populate1).toHaveBeenCalledWith("author");
            expect(populate2).toHaveBeenCalledWith("category");
        });

        test("paginate should apply single populate", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const populate = jest.fn(() => ({ lean }));
            const limit = jest.fn(() => ({ populate }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            await schema.statics.paginate.call(
                modelContext,
                {},
                1,
                20,
                {},
                { populate: "author" }
            );

            expect(populate).toHaveBeenCalledWith("author");
        });

        test("paginate should skip lean when options.lean is false", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const queryAfterLimit = { exec };
            const limit = jest.fn(() => queryAfterLimit);
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            const result = await schema.statics.paginate.call(
                modelContext,
                {},
                1,
                20,
                {},
                { lean: false }
            );

            expect(result.data).toEqual([]);
        });

        test("paginate should apply select and session", async () => {
            mockMongoose.model.mockReturnValue({});

            createBaseModel("User", {
                name: { type: String },
            });

            const schema = mockSchemaConstructor.mock.results[0].value;

            const exec = jest.fn().mockResolvedValue([]);
            const lean = jest.fn(() => ({ exec }));
            const select = jest.fn(() => ({ lean }));
            const limit = jest.fn(() => ({ select }));
            const skip = jest.fn(() => ({ limit }));
            const find = jest.fn(() => ({ skip }));
            const countSession = jest.fn().mockResolvedValue(0);
            const countDocuments = jest.fn(() => ({
                session: countSession,
            }));

            const modelContext = {
                find,
                countDocuments,
            };

            const session = { id: "session-1" };

            await schema.statics.paginate.call(
                modelContext,
                {},
                1,
                20,
                {},
                { select: "name email", session }
            );

            expect(find).toHaveBeenCalledWith(
                { isDeleted: false },
                {},
                { sort: {}, session }
            );
            expect(select).toHaveBeenCalledWith("name email");
            expect(countSession).toHaveBeenCalledWith(session);
        });
    });
});