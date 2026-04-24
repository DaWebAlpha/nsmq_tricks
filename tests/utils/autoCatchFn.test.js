import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockNext = jest.fn();
const mockReq = {};
const mockRes = {};

const mockBadRequestError = class extends Error {
    constructor({ message }) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
    }
};

await jest.unstable_mockModule(
    "../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: mockBadRequestError,
    })
);

const { autoCatchFn } = await import(
    "../../backend/src/utils/autoCatchFn.js"
);

describe("autoCatchFn", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should call handler successfully (no error)", async () => {
        const handler = jest.fn(async () => "ok");

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(mockNext).not.toHaveBeenCalled();
    });

    test("should catch async errors and pass to next", async () => {
        const error = new Error("Async error");

        const handler = jest.fn(async () => {
            throw error;
        });

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith(error);
    });

    test("should catch sync errors and pass to next", async () => {
        const error = new Error("Sync error");

        const handler = jest.fn(() => {
            throw error;
        });

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
    });

    test("should pass resolved promise without calling next", async () => {
        const handler = jest.fn(() => Promise.resolve("done"));

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
    });

    test("should not call next twice if handler already calls next", async () => {
        const error = new Error("Manual next error");

        const handler = jest.fn((req, res, next) => {
            next(error);
            throw error;
        });

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test("should throw BadRequestError if fn is not a function", () => {
        expect(() => autoCatchFn(null)).toThrow("autoCatchFn requires a function");
    });

    test("should pass arguments correctly to handler", async () => {
        const handler = jest.fn();

        const wrapped = autoCatchFn(handler);

        await wrapped(mockReq, mockRes, mockNext);

        expect(handler).toHaveBeenCalledWith(mockReq, mockRes, expect.any(Function));
    });

    test("should return a promise", async () => {
        const handler = jest.fn(async () => {});

        const wrapped = autoCatchFn(handler);

        const result = wrapped(mockReq, mockRes, mockNext);

        expect(result).toBeInstanceOf(Promise);

        await result;
    });
});