import { jest, describe, test, expect } from "@jest/globals";

const mockUserSecurityModel = function MockUserSecurityModel() {};
mockUserSecurityModel.modelName = "UserSecurity";

class MockBaseRepository {
    constructor(model) {
        if (!model || typeof model !== "function" || !model.modelName) {
            throw new Error("A valid Mongoose model is required");
        }

        this.model = model;
        this.modelName = model.modelName;
    }
}

await jest.unstable_mockModule(
    "../../backend/src/repositories/base.repository.js",
    () => ({
        BaseRepository: MockBaseRepository,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/models/auth/userSecurity.model.js",
    () => ({
        UserSecurity: mockUserSecurityModel,
    })
);

const {
    SecurityRepository,
    securityRepository,
    default: defaultSecurityRepository,
} = await import("../../backend/src/repositories/security.repository.js");

describe("SecurityRepository", () => {
    test("should construct with UserSecurity model", () => {
        const repository = new SecurityRepository();

        expect(repository.model).toBe(mockUserSecurityModel);
        expect(repository.modelName).toBe("UserSecurity");
    });

    test("should export singleton repository instance", () => {
        expect(securityRepository).toBeInstanceOf(SecurityRepository);
    });

    test("default export should be the singleton repository instance", () => {
        expect(defaultSecurityRepository).toBe(securityRepository);
    });
});