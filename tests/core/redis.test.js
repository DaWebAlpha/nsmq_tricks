import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockOn = jest.fn();

const MockRedis = jest.fn(function RedisMock(uri, options) {
    this.uri = uri;
    this.options = options;
    this.on = mockOn;
});

const mockSystemLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe("redis client module", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test("should create a Redis client with redis_uri from config and production options", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        const redisModule = await import("../../backend/src/core/redis.js");

        expect(MockRedis).toHaveBeenCalledTimes(1);
        expect(MockRedis).toHaveBeenCalledWith(
            "redis://127.0.0.1:6379",
            expect.objectContaining({
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false,
                retryStrategy: expect.any(Function),
            })
        );

        expect(redisModule.default).toBeDefined();
    });

    test("should configure bounded retry strategy", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const redisOptions = MockRedis.mock.calls[0][1];

        expect(redisOptions.retryStrategy(1)).toBe(200);
        expect(redisOptions.retryStrategy(5)).toBe(1000);
        expect(redisOptions.retryStrategy(20)).toBe(2000);
    });

    test("should register connect event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
    });

    test("should register ready event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("ready", expect.any(Function));
    });

    test("should register error event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
    });

    test("should register close event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("close", expect.any(Function));
    });

    test("should register reconnecting event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("reconnecting", expect.any(Function));
    });

    test("should register end event handler", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        expect(mockOn).toHaveBeenCalledWith("end", expect.any(Function));
    });

    test("should log when connect event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const connectHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "connect"
        )?.[1];

        expect(connectHandler).toBeDefined();

        connectHandler();

        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "Redis TCP connection established"
        );
    });

    test("should log when ready event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const readyHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "ready"
        )?.[1];

        expect(readyHandler).toBeDefined();

        readyHandler();

        expect(mockSystemLogger.info).toHaveBeenCalledWith(
            "Redis client is ready for commands"
        );
    });

    test("should log structured error when error event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const errorHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "error"
        )?.[1];

        expect(errorHandler).toBeDefined();

        const error = new Error("connect ECONNREFUSED 127.0.0.1:6379");

        errorHandler(error);

        expect(mockSystemLogger.error).toHaveBeenCalledWith(
            { err: error },
            "Redis connection error"
        );
    });

    test("should log warning when close event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const closeHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "close"
        )?.[1];

        expect(closeHandler).toBeDefined();

        closeHandler();

        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            "Redis connection closed"
        );
    });

    test("should log warning when reconnecting event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const reconnectingHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "reconnecting"
        )?.[1];

        expect(reconnectingHandler).toBeDefined();

        reconnectingHandler();

        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            "Redis client reconnecting"
        );
    });

    test("should log warning when end event fires", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        await import("../../backend/src/core/redis.js");

        const endHandler = mockOn.mock.calls.find(
            ([eventName]) => eventName === "end"
        )?.[1];

        expect(endHandler).toBeDefined();

        endHandler();

        expect(mockSystemLogger.warn).toHaveBeenCalledWith(
            "Redis connection ended"
        );
    });

    test("should export the created Redis singleton instance", async () => {
        await jest.unstable_mockModule("ioredis", () => ({
            default: MockRedis,
        }));

        await jest.unstable_mockModule(
            "../../backend/src/config/config.js",
            () => ({
                default: {
                    redis_uri: "redis://127.0.0.1:6379",
                },
            })
        );

        await jest.unstable_mockModule(
            "../../backend/src/core/pino.logger.js",
            () => ({
                system_logger: mockSystemLogger,
            })
        );

        const redisModule = await import("../../backend/src/core/redis.js");

        expect(redisModule.default).toBeInstanceOf(MockRedis);
        expect(redisModule.default.uri).toBe("redis://127.0.0.1:6379");
        expect(redisModule.default.options).toEqual(
            expect.objectContaining({
                //lazyConnect: true,
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false,
                retryStrategy: expect.any(Function),
            })
        );
    });
});