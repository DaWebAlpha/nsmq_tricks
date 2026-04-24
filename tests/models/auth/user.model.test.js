import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockValidator = {
    isEmail: jest.fn(),
};

const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
const mockNormalizeValue = jest.fn();
const mockNormalizePhoneNumber = jest.fn();

const mockSystemLogger = {
    error: jest.fn(),
    warn: jest.fn(),
};

class MockInternalServerError extends Error {
    constructor({ message = "Internal Server Error", details = null } = {}) {
        super(message);
        this.name = "InternalServerError";
        this.statusCode = 500;
        this.details = details;
        this.isOperational = true;
    }
}

class MockBadRequestError extends Error {
    constructor({ message = "Bad Request Error", details = null } = {}) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        this.details = details;
        this.isOperational = true;
    }
}

const RESERVED_WORDS = new Set(["admin", "root", "api"]);

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

await jest.unstable_mockModule("validator", () => ({
    default: mockValidator,
}));

await jest.unstable_mockModule(
    "../../../backend/src/utils/password.argon2.js",
    () => ({
        hashPassword: mockHashPassword,
        verifyPassword: mockVerifyPassword,
    })
);

await jest.unstable_mockModule(
    "../../../backend/src/errors/internalserver.error.js",
    () => ({
        InternalServerError: MockInternalServerError,
    })
);

await jest.unstable_mockModule(
    "../../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: MockBadRequestError,
    })
);

await jest.unstable_mockModule(
    "../../../backend/src/utils/string.utils.js",
    () => ({
        RESERVED_WORDS,
        normalizeValue: mockNormalizeValue,
    })
);

await jest.unstable_mockModule(
    "../../../backend/src/core/pino.logger.js",
    () => ({
        system_logger: mockSystemLogger,
    })
);

await jest.unstable_mockModule("../../../backend/src/utils/phone.js", () => ({
    normalizePhoneNumber: mockNormalizePhoneNumber,
}));

await jest.unstable_mockModule(
    "../../../backend/src/models/mongoose.model.base.js",
    () => ({
        createBaseModel: jest.fn((name, schemaDefinition, callback) => {
            const schema = createMockSchema();
            captured.name = name;
            captured.schemaDefinition = schemaDefinition;
            captured.schema = schema;
            callback(schema);
            return {
                modelName: name,
                schema,
                ...schema.methods,
                ...schema.statics,
            };
        }),
    })
);

const {
    User,
    USERNAME_REGEX,
    PASSWORD_REGEX,
    USER_ROLES,
    userSchemaDefinition,
} = await import("../../../backend/src/models/auth/user.model.js");

describe("user.model", () => {
    beforeEach(() => {
        /**
         * IMPORTANT:
         * Do not call jest.clearAllMocks() here because it would erase
         * the import-time call history for captured.schema.pre and
         * captured.schema.index, which this test suite intentionally asserts.
         */
        mockValidator.isEmail.mockReset();
        mockHashPassword.mockReset();
        mockVerifyPassword.mockReset();
        mockNormalizeValue.mockReset();
        mockNormalizePhoneNumber.mockReset();
        mockSystemLogger.error.mockReset();
        mockSystemLogger.warn.mockReset();

        mockNormalizeValue.mockImplementation((value) =>
            typeof value === "string" ? value.trim().toLowerCase() : value
        );

        mockValidator.isEmail.mockImplementation(
            (value) => value === "user@example.com"
        );

        mockNormalizePhoneNumber.mockImplementation((value) => {
            if (value === "0241234567" || value === "+233241234567") {
                return { e164: "+233241234567" };
            }
            return null;
        });
    });

    test("should create User model through createBaseModel", () => {
        expect(User.modelName).toBe("User");
        expect(captured.name).toBe("User");
    });

    test("should expose supported user roles", () => {
        expect(USER_ROLES).toEqual(["user", "moderator", "admin", "superadmin"]);
    });

    test("should expose username regex", () => {
        expect(USERNAME_REGEX.test("kashi")).toBe(true);
        expect(USERNAME_REGEX.test("ka")).toBe(false);
        expect(USERNAME_REGEX.test("bad space")).toBe(false);
    });

    test("should expose password regex", () => {
        expect(PASSWORD_REGEX.test("Password123!")).toBe(true);
        expect(PASSWORD_REGEX.test("password")).toBe(false);
    });

    test("should define username, email, phoneNumber, password, and role fields", () => {
        expect(userSchemaDefinition).toHaveProperty("username");
        expect(userSchemaDefinition).toHaveProperty("email");
        expect(userSchemaDefinition).toHaveProperty("phoneNumber");
        expect(userSchemaDefinition).toHaveProperty("password");
        expect(userSchemaDefinition).toHaveProperty("role");
    });

    test("username validator should reject reserved words", () => {
        const validatorFn = userSchemaDefinition.username.validate.validator;

        const result = validatorFn("ADMIN");

        expect(result).toBe(false);
    });

    test("username validator should accept non-reserved normalized usernames", () => {
        const validatorFn = userSchemaDefinition.username.validate.validator;

        const result = validatorFn("Kashi");

        expect(result).toBe(true);
    });

    test("email validator should validate normalized email", () => {
        const validatorFn = userSchemaDefinition.email.validate.validator;

        const result = validatorFn("  USER@example.com ");

        expect(mockValidator.isEmail).toHaveBeenCalledWith("user@example.com");
        expect(result).toBe(true);
    });

    test("phoneNumber setter should normalize to e164", () => {
        const setter = userSchemaDefinition.phoneNumber.set;

        const result = setter("0241234567");

        expect(result).toBe("+233241234567");
    });

    test("phoneNumber setter should return original value if normalization fails", () => {
        const setter = userSchemaDefinition.phoneNumber.set;

        const result = setter("bad-number");

        expect(result).toBe("bad-number");
    });

    test("phoneNumber validator should return true for valid number", () => {
        const validatorFn = userSchemaDefinition.phoneNumber.validate.validator;

        expect(validatorFn("0241234567")).toBe(true);
    });

    test("phoneNumber validator should return false for invalid number", () => {
        const validatorFn = userSchemaDefinition.phoneNumber.validate.validator;

        expect(validatorFn("bad-number")).toBe(false);
    });

    test("password validator should allow valid password", () => {
        const validatorFn = userSchemaDefinition.password.validate.validator;

        expect(validatorFn("Password123!")).toBe(true);
    });

    test("password validator should reject invalid password", () => {
        const validatorFn = userSchemaDefinition.password.validate.validator;

        expect(validatorFn("weak")).toBe(false);
    });

    test("should register validate and save middleware", () => {
        expect(captured.schema.pre).toHaveBeenCalledWith(
            "validate",
            expect.any(Function)
        );
        expect(captured.schema.pre).toHaveBeenCalledWith(
            "save",
            expect.any(Function)
        );
    });

    test("should register indexes", () => {
        expect(captured.schema.index).toHaveBeenCalled();
        expect(captured.schema.indexes.length).toBeGreaterThan(0);
    });

    test("pre-validate should normalize username and email", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            username: "  Kashi ",
            email: "  USER@example.com ",
            phoneNumber: null,
            isModified: jest.fn(
                (field) => field === "username" || field === "email"
            ),
            invalidate: jest.fn(),
        };

        preValidate.call(doc);

        expect(doc.username).toBe("kashi");
        expect(doc.email).toBe("user@example.com");
    });

    test("pre-validate should normalize valid phone number", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            username: null,
            email: null,
            phoneNumber: "0241234567",
            isModified: jest.fn((field) => field === "phoneNumber"),
            invalidate: jest.fn(),
        };

        preValidate.call(doc);

        expect(doc.phoneNumber).toBe("+233241234567");
        expect(doc.invalidate).not.toHaveBeenCalled();
    });

    test("pre-validate should invalidate bad phone number", () => {
        const preValidate = captured.schema.pres.validate;

        const doc = {
            username: null,
            email: null,
            phoneNumber: "bad-number",
            isModified: jest.fn((field) => field === "phoneNumber"),
            invalidate: jest.fn(),
        };

        preValidate.call(doc);

        expect(doc.invalidate).toHaveBeenCalledWith(
            "phoneNumber",
            "Invalid phone number"
        );
    });

    test("pre-save should hash modified password and set lastPasswordChangedAt", async () => {
        mockHashPassword.mockResolvedValue("hashed-password");

        const preSave = captured.schema.pres.save;
        const doc = {
            password: "Password123!",
            lastPasswordChangedAt: null,
            isModified: jest.fn((field) => field === "password"),
        };

        await preSave.call(doc);

        expect(mockHashPassword).toHaveBeenCalledWith("Password123!");
        expect(doc.password).toBe("hashed-password");
        expect(doc.lastPasswordChangedAt).toBeInstanceOf(Date);
    });

    test("pre-save should skip hashing when password is not modified", async () => {
        const preSave = captured.schema.pres.save;
        const doc = {
            password: "Password123!",
            isModified: jest.fn(() => false),
        };

        await preSave.call(doc);

        expect(mockHashPassword).not.toHaveBeenCalled();
    });

    test("comparePassword should throw when password field is missing", async () => {
        const comparePassword = captured.schema.methods.comparePassword;
        const doc = {
            password: null,
        };

        await expect(
            comparePassword.call(doc, "Password123!")
        ).rejects.toMatchObject({
            name: "InternalServerError",
            statusCode: 500,
            message: "Internal authentication error",
        });

        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            "Password field not selected in query."
        );
    });

    test("comparePassword should verify password when hash exists", async () => {
        mockVerifyPassword.mockResolvedValue(true);

        const comparePassword = captured.schema.methods.comparePassword;
        const doc = {
            password: "hashed-password",
        };

        const result = await comparePassword.call(doc, "Password123!");

        expect(mockVerifyPassword).toHaveBeenCalledWith(
            "Password123!",
            "hashed-password"
        );
        expect(result).toBe(true);
    });

    test("findByIdentifier should throw for empty identifier", () => {
        const findByIdentifier = captured.schema.statics.findByIdentifier;

        expect(() => findByIdentifier.call({}, "")).toThrow(
            "Identifier is required"
        );
        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            "Attempt to find user with empty identifier"
        );
    });

    test("findByIdentifier should query by phone when identifier normalizes as phone", () => {
        const select = jest.fn();
        const findOne = jest.fn(() => ({ select }));
        const findByIdentifier = captured.schema.statics.findByIdentifier;

        findByIdentifier.call({ findOne }, "0241234567");

        expect(findOne).toHaveBeenCalledWith({
            isDeleted: false,
            phoneNumber: "+233241234567",
        });
        expect(select).toHaveBeenCalledWith("+password");
    });

    test("findByIdentifier should query by username or email when not a phone", () => {
        const select = jest.fn();
        const findOne = jest.fn(() => ({ select }));
        const findByIdentifier = captured.schema.statics.findByIdentifier;

        findByIdentifier.call({ findOne }, "Kashi");

        expect(findOne).toHaveBeenCalledWith({
            isDeleted: false,
            $or: [{ username: "kashi" }, { email: "kashi" }],
        });
        expect(select).toHaveBeenCalledWith("+password");
    });

    test("findByPhoneNumber should throw for invalid phone", () => {
        const findByPhoneNumber = captured.schema.statics.findByPhoneNumber;

        expect(() => findByPhoneNumber.call({}, "bad")).toThrow(
            "Valid phone number is required"
        );
    });

    test("findByPhoneNumber should query normalized phone", () => {
        const select = jest.fn();
        const findOne = jest.fn(() => ({ select }));
        const findByPhoneNumber = captured.schema.statics.findByPhoneNumber;

        findByPhoneNumber.call({ findOne }, "0241234567");

        expect(findOne).toHaveBeenCalledWith({
            isDeleted: false,
            phoneNumber: "+233241234567",
        });
        expect(select).toHaveBeenCalledWith("+password");
    });

    test("findByEmail should throw for empty email", () => {
        const findByEmail = captured.schema.statics.findByEmail;
        mockNormalizeValue.mockReturnValue("");

        expect(() => findByEmail.call({}, "")).toThrow(
            "Valid email is required"
        );
    });

    test("findByEmail should throw for invalid normalized email", () => {
        const findByEmail = captured.schema.statics.findByEmail;
        mockNormalizeValue.mockReturnValue("not-an-email");
        mockValidator.isEmail.mockReturnValue(false);

        expect(() => findByEmail.call({}, "bad")).toThrow(
            "Valid email is required"
        );
    });

    test("findByEmail should query normalized email", () => {
        const select = jest.fn();
        const findOne = jest.fn(() => ({ select }));
        const findByEmail = captured.schema.statics.findByEmail;

        findByEmail.call({ findOne }, " USER@example.com ");

        expect(findOne).toHaveBeenCalledWith({
            email: "user@example.com",
            isDeleted: false,
        });
        expect(select).toHaveBeenCalledWith("+password");
    });

    test("findByUsername should throw for empty username", () => {
        const findByUsername = captured.schema.statics.findByUsername;
        mockNormalizeValue.mockReturnValue("");

        expect(() => findByUsername.call({}, "")).toThrow(
            "Valid username is required"
        );
    });

    test("findByUsername should throw for reserved username", () => {
        const findByUsername = captured.schema.statics.findByUsername;
        mockNormalizeValue.mockReturnValue("admin");

        expect(() => findByUsername.call({}, "admin")).toThrow(
            "Valid username is required"
        );
    });

    test("findByUsername should throw for regex-invalid username", () => {
        const findByUsername = captured.schema.statics.findByUsername;
        mockNormalizeValue.mockReturnValue("bad space");

        expect(() => findByUsername.call({}, "bad space")).toThrow(
            "Valid username is required"
        );
    });

    test("findByUsername should query normalized username", () => {
        const select = jest.fn();
        const findOne = jest.fn(() => ({ select }));
        const findByUsername = captured.schema.statics.findByUsername;

        findByUsername.call({ findOne }, " Kashi ");

        expect(findOne).toHaveBeenCalledWith({
            username: "kashi",
            isDeleted: false,
        });
        expect(select).toHaveBeenCalledWith("+password");
    });
});