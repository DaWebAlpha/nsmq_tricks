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

const { isPremiumMiddleware } = await import(
    "../../backend/src/middlewares/isPremium.middleware.js"
);

describe("isPremiumMiddleware", () => {
    let request;
    let response;
    let next;

    beforeEach(() => {
        request = {};
        response = {};
        next = jest.fn();
    });

    test("should call next with UnauthenticatedError when request.user is missing", () => {
        const middleware = isPremiumMiddleware();

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthenticatedError",
            statusCode: 401,
            message:
                "Authentication required. Please log in to access this resource",
        });
    });

    test("should call next with UnauthorizedError when user is not premium", () => {
        request.user = { isPremium: false };

        const middleware = isPremiumMiddleware();

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthorizedError",
            statusCode: 403,
            message:
                "This account type is not allowed to access this resource",
        });
    });

    test("should also reject when isPremium is undefined", () => {
        request.user = {};

        const middleware = isPremiumMiddleware();

        middleware(request, response, next);

        expect(next.mock.calls[0][0]).toMatchObject({
            name: "UnauthorizedError",
            statusCode: 403,
        });
    });

    test("should proceed when user has premium access", () => {
        request.user = { isPremium: true };

        const middleware = isPremiumMiddleware();

        middleware(request, response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });
});