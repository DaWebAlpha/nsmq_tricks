import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockStartSession = jest.fn();
const mockMongoose = {
    startSession: mockStartSession,
};

const mockSystemLogger = {
    error: jest.fn(),
};

class MockBadRequestError extends Error {
    constructor({ message = "Bad Request Error", details = null } = {}) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        this.details = details;
        this.isOperational = true;
    }
}

await jest.unstable_mockModule("mongoose", () => ({
    default: mockMongoose,
}));

await jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
    system_logger: mockSystemLogger,
}));

await jest.unstable_mockModule(
    "../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: MockBadRequestError,
    })
);

const { withTransaction } = await import(
    "../../backend/src/utils/db.transaction.js"
);

describe("db.transaction", () => {
    let mockSession;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSession = {
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            abortTransaction: jest.fn(),
            endSession: jest.fn(),
            inTransaction: jest.fn(() => true),
        };

        mockStartSession.mockResolvedValue(mockSession);
        mockSession.commitTransaction.mockResolvedValue(undefined);
        mockSession.abortTransaction.mockResolvedValue(undefined);
        mockSession.endSession.mockResolvedValue(undefined);
    });

    test("should execute work inside a transaction and commit on success", async () => {
        const work = jest.fn(async (session) => {
            expect(session).toBe(mockSession);
            return { success: true };
        });

        const result = await withTransaction(work);

        expect(mockStartSession).toHaveBeenCalledTimes(1);
        expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
        expect(work).toHaveBeenCalledTimes(1);
        expect(work).toHaveBeenCalledWith(mockSession);
        expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.abortTransaction).not.toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ success: true });
    });

    test("should abort transaction and rethrow original error when work fails", async () => {
        const transactionError = new Error("Transaction failed");
        const work = jest.fn(async () => {
            throw transactionError;
        });

        await expect(withTransaction(work)).rejects.toThrow("Transaction failed");

        expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.commitTransaction).not.toHaveBeenCalled();
        expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test("should throw BadRequestError when work is not a function", async () => {
        await expect(withTransaction(null)).rejects.toMatchObject({
            name: "BadRequestError",
            statusCode: 400,
            message: "withTransaction requires a function",
        });

        expect(mockStartSession).not.toHaveBeenCalled();
    });

    test("should rethrow commitTransaction error and abort transaction", async () => {
        const commitError = new Error("Commit failed");
        const work = jest.fn(async () => "done");

        mockSession.commitTransaction.mockRejectedValue(commitError);

        await expect(withTransaction(work)).rejects.toThrow("Commit failed");

        expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test("should log abortTransaction failure and rethrow original error", async () => {
        const originalError = new Error("Work failed");
        const abortError = new Error("Abort failed");

        const work = jest.fn(async () => {
            throw originalError;
        });

        mockSession.abortTransaction.mockRejectedValue(abortError);

        await expect(withTransaction(work)).rejects.toThrow("Work failed");

        expect(mockSystemLogger.error).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            {
                err: abortError,
                original_error: originalError,
            },
            "Database transaction abort failed"
        );
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test("should skip abort if session reports no active transaction", async () => {
        const originalError = new Error("Work failed");
        const work = jest.fn(async () => {
            throw originalError;
        });

        mockSession.inTransaction.mockReturnValue(false);

        await expect(withTransaction(work)).rejects.toThrow("Work failed");

        expect(mockSession.abortTransaction).not.toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test("should log endSession failure without masking success result", async () => {
        const work = jest.fn(async () => "ok");
        const endSessionError = new Error("End session failed");

        mockSession.endSession.mockRejectedValue(endSessionError);

        const result = await withTransaction(work);

        expect(result).toBe("ok");
        expect(mockSystemLogger.error).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            { err: endSessionError },
            "Database session cleanup failed"
        );
    });

    test("should propagate startSession failure", async () => {
        const startSessionError = new Error("Unable to start session");
        mockStartSession.mockRejectedValue(startSessionError);

        const work = jest.fn();

        await expect(withTransaction(work)).rejects.toThrow(
            "Unable to start session"
        );

        expect(work).not.toHaveBeenCalled();
    });

    test("should support synchronous work functions", async () => {
        const work = jest.fn((session) => {
            expect(session).toBe(mockSession);
            return "sync-result";
        });

        const result = await withTransaction(work);

        expect(result).toBe("sync-result");
        expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
});