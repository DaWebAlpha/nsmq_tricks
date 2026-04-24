import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockMongoose = {
    connection: {
        readyState: 0,
    },
    disconnect: jest.fn(),
};

const mockSystemLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
};

const mockRedis = {
    status: "end",
    quit: jest.fn(),
    disconnect: jest.fn(),
};

await jest.unstable_mockModule("mongoose", () => ({
    default: mockMongoose,
}));

await jest.unstable_mockModule("../../backend/src/core/pino.logger.js", () => ({
    system_logger: mockSystemLogger,
}));

await jest.unstable_mockModule("../../backend/src/core/redis.js", () => ({
    default: mockRedis,
}));

const { gracefulShutdown } = await import(
    "../../backend/src/utils/gracefulShutdown.js"
);

describe("gracefulShutdown", () => {
    let server;
    let connectionHandler;
    let closeHandler;
    let originalProcessOnce;
    let originalProcessExit;

    beforeEach(() => {
        jest.clearAllMocks();

        mockMongoose.connection.readyState = 0;
        mockMongoose.disconnect.mockResolvedValue(undefined);

        mockRedis.status = "end";
        mockRedis.quit.mockResolvedValue(undefined);
        mockRedis.disconnect.mockImplementation(() => {});

        connectionHandler = null;
        closeHandler = null;

        server = {
            listening: true,
            on: jest.fn((event, handler) => {
                if (event === "connection") {
                    connectionHandler = handler;
                }
            }),
            close: jest.fn((callback) => callback(null)),
        };

        originalProcessOnce = process.once;
        originalProcessExit = process.exit;

        process.once = jest.fn();
        process.exit = jest.fn();
    });

    test("should register connection tracking on the server", () => {
        gracefulShutdown(server);

        expect(server.on).toHaveBeenCalledWith(
            "connection",
            expect.any(Function)
        );
    });

    test("should register process shutdown handlers", () => {
        gracefulShutdown(server);

        expect(process.once).toHaveBeenCalledWith(
            "SIGINT",
            expect.any(Function)
        );
        expect(process.once).toHaveBeenCalledWith(
            "SIGTERM",
            expect.any(Function)
        );
        expect(process.once).toHaveBeenCalledWith(
            "uncaughtException",
            expect.any(Function)
        );
        expect(process.once).toHaveBeenCalledWith(
            "unhandledRejection",
            expect.any(Function)
        );
    });

    test("should close the HTTP server during shutdown", async () => {
        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(server.close).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.info).toHaveBeenCalledWith("HTTP server closed.");
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    test("should skip closing HTTP server when server is not listening", async () => {
        server.listening = false;

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(server.close).not.toHaveBeenCalled();
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "HTTP server is not listening. Skipping close."
        );
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    test("should disconnect mongoose when connection is active", async () => {
        mockMongoose.connection.readyState = 1;

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockMongoose.disconnect).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "MongoDB connection closed."
        );
    });

    test("should skip mongoose disconnect when already disconnected", async () => {
        mockMongoose.connection.readyState = 0;

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockMongoose.disconnect).not.toHaveBeenCalled();
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "MongoDB already disconnected. Skipping close."
        );
    });

    test("should quit redis when redis is in a closable state", async () => {
        mockRedis.status = "ready";

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockRedis.quit).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "Redis connection closed."
        );
    });

    test("should skip redis close when redis is not in a closable state", async () => {
        mockRedis.status = "end";

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockRedis.quit).not.toHaveBeenCalled();
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            { redis_status: "end" },
            "Redis is not in a closable state. Skipping close."
        );
    });

    test("should fall back to redis.disconnect when redis.quit fails", async () => {
        mockRedis.status = "ready";
        mockRedis.quit.mockRejectedValueOnce(new Error("quit failed"));

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockRedis.quit).toHaveBeenCalledTimes(1);
        expect(mockRedis.disconnect).toHaveBeenCalledTimes(1);
        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            {
                err: expect.any(Error),
                redis_status: "ready",
            },
            "Redis quit failed. Falling back to disconnect()."
        );
        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "Redis disconnected forcefully."
        );
    });

    test("should track and destroy lingering sockets during shutdown", async () => {
        jest.useFakeTimers();

        const socket = {
            destroy: jest.fn(),
            on: jest.fn((event, handler) => {
                if (event === "close") {
                    closeHandler = handler;
                }
            }),
        };

        const { shutdown } = gracefulShutdown(server);

        connectionHandler(socket);

        const shutdownPromise = shutdown("SIGTERM");
        await jest.runAllTimersAsync();
        await shutdownPromise;

        expect(socket.destroy).toHaveBeenCalled();

        jest.useRealTimers();
    });

    test("should remove socket from tracking when socket closes", () => {
        const socket = {
            destroy: jest.fn(),
            on: jest.fn((event, handler) => {
                if (event === "close") {
                    closeHandler = handler;
                }
            }),
        };

        gracefulShutdown(server);
        connectionHandler(socket);
        closeHandler();

        expect(socket.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    test("should log and ignore duplicate shutdown calls", async () => {
        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");
        await shutdown("SIGINT");

        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            { signal: "SIGINT" },
            "Shutdown already in progress. Ignoring additional trigger."
        );
    });

    test("should exit with code 1 for uncaughtException shutdown", async () => {
        const { shutdown } = gracefulShutdown(server);

        await shutdown("uncaughtException", new Error("fatal crash"));

        expect(process.exit).toHaveBeenCalledWith(1);
    });

    test("should force exit with code 1 when shutdown fails", async () => {
        server.close.mockImplementationOnce((callback) =>
            callback(new Error("close failed"))
        );

        const { shutdown } = gracefulShutdown(server);

        await shutdown("SIGTERM");

        expect(mockSystemLogger.fatal).toHaveBeenCalledWith(
            {
                signal: "SIGTERM",
                err: expect.any(Error),
                open_connections: 0,
            },
            "Graceful shutdown failed. Forcing process exit."
        );
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    test("should allow manual shutdown when server is undefined", async () => {
        const { shutdown } = gracefulShutdown(undefined);

        await shutdown("SIGTERM");

        expect(mockMongoose.disconnect).not.toHaveBeenCalled();
        expect(mockRedis.quit).not.toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    test("should log uncaughtException and trigger shutdown through registered handler", async () => {
        gracefulShutdown(server);

        const uncaughtExceptionHandler = process.once.mock.calls.find(
            ([event]) => event === "uncaughtException"
        )[1];

        uncaughtExceptionHandler(new Error("boom"));

        await Promise.resolve();

        expect(mockSystemLogger.fatal).toHaveBeenCalledWith(
            { err: expect.any(Error) },
            "Uncaught exception detected."
        );
    });

    test("should log unhandledRejection and trigger shutdown through registered handler", async () => {
        gracefulShutdown(server);

        const unhandledRejectionHandler = process.once.mock.calls.find(
            ([event]) => event === "unhandledRejection"
        )[1];

        unhandledRejectionHandler(new Error("promise failed"));

        await Promise.resolve();

        expect(mockSystemLogger.fatal).toHaveBeenCalledWith(
            {
                err: expect.any(Error),
                reason: "promise failed",
            },
            "Unhandled promise rejection detected."
        );
    });

    test("should log non-Error unhandledRejection reasons correctly", async () => {
        gracefulShutdown(server);

        const unhandledRejectionHandler = process.once.mock.calls.find(
            ([event]) => event === "unhandledRejection"
        )[1];

        unhandledRejectionHandler("plain rejection");

        await Promise.resolve();

        expect(mockSystemLogger.fatal).toHaveBeenCalledWith(
            {
                err: undefined,
                reason: "plain rejection",
            },
            "Unhandled promise rejection detected."
        );
    });

    test("should restore process methods after test expectations", () => {
        process.once = originalProcessOnce;
        process.exit = originalProcessExit;

        expect(typeof process.once).toBe("function");
        expect(typeof process.exit).toBe("function");
    });
});