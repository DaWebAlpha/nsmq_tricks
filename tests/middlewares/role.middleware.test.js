import { jest, describe, test, expect, beforeEach } from "@jest/globals";

class MockUnauthenticatedError extends Error {
    constructor({ message = "Unauthenticated" } = {}) {
        super(message);
        this.name = "UnauthenticatedError";
        this.statusCode = 401;
        this.isOperational = true;
    }
}

class MockUnauthorizedError extends Error {
    constructor({ message = "Unauthorized" } = {}) {
        super(message);
        this.name = "UnauthorizedError";
        this.statusCode = 403;
        this.isOperational = true;
    }
}

await jest.unstable_mockModule(
    "../../backend/src/errors/unauthenticated.error.js",
    () => ({
        UnauthenticatedError: MockUnauthenticatedError,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/errors/unauthorized.error.js",
    () => ({
        UnauthorizedError: MockUnauthorizedError,
    })
);

const { roleMiddleware } = await import(
    "../../backend/src/middlewares/role.middleware.js"
);

describe("roleMiddleware", () => {
    let request;
    let response;
    let next;

    beforeEach(() => {
        request = {};
        response = {};
        next = jest.fn();
    });

    test("should throw during setup when no allowed roles are provided", () => {
        expect(() => roleMiddleware()).toThrow(
            "roleMiddleware requires at least one allowed role"
        );
    });

    test("should call next with UnauthenticatedError when request.user is missing", () => {
        const middleware = roleMiddleware("admin");

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message:
                "Authentication required. Please log in to access this resource",
        });
    });

    test("should call next with UnauthorizedError when role is not allowed", () => {
        request.user = { role: "user" };

        const middleware = roleMiddleware("admin", "moderator");

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthorizedError",
            statusCode: 403,
            message:
                "This account type is not allowed to access this resource",
        });
    });

    test("should proceed when role is allowed", () => {
        request.user = { role: "admin" };

        const middleware = roleMiddleware("admin", "moderator");

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    test("should trim configured allowed roles", () => {
        request.user = { role: "admin" };

        const middleware = roleMiddleware(" admin ", " moderator ");

        middleware(request, response, next);

        expect(next).toHaveBeenCalledWith();
    });
});