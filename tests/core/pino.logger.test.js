import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPinoInstance = (name) => ({
    loggerName: name,
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
});

const mockTransport = jest.fn((config) => ({
    type: "mock-transport",
    config,
}));

const mockPino = jest.fn((config, transport) => ({
    type: "mock-logger",
    config,
    transport,
}));

mockPino.transport = mockTransport;
mockPino.stdTimeFunctions = {
    isoTime: jest.fn(() => "mock-iso-time"),
};

const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();

const mockJoin = jest.fn((...parts) => parts.join("/"));
const mockResolve = jest.fn((...parts) => parts.join("/"));
const mockDirname = jest.fn(() => "/project/backend/src/core");
const mockFileURLToPath = jest.fn(() => "/project/backend/src/core/pino.logger.js");

describe("pino.logger", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test("should create logs directory when it does not exist", async () => {
        mockExistsSync.mockReturnValue(false);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        const loggerModule = await import("../../backend/src/core/pino.logger.js");

        expect(mockExistsSync).toHaveBeenCalledTimes(1);
        expect(mockMkdirSync).toHaveBeenCalledTimes(1);
        expect(mockMkdirSync).toHaveBeenCalledWith(
            "/project/backend/src/core/../../../logs",
            { recursive: true }
        );

        expect(loggerModule.system_logger).toBeDefined();
        expect(loggerModule.audit_logger).toBeDefined();
        expect(loggerModule.access_logger).toBeDefined();
    });

    test("should not create logs directory when it already exists", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "production",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        expect(mockExistsSync).toHaveBeenCalledTimes(1);
        expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    test("should use debug level in development", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        expect(mockPino).toHaveBeenCalledTimes(3);

        const firstLoggerConfig = mockPino.mock.calls[0][0];
        expect(firstLoggerConfig.level).toBe("debug");
    });

    test("should use info level outside development", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "production",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        const firstLoggerConfig = mockPino.mock.calls[0][0];
        expect(firstLoggerConfig.level).toBe("info");
    });

    test("should configure three transports", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        expect(mockTransport).toHaveBeenCalledTimes(3);
    });

    test("should attach pretty terminal target in development", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        const firstTransportConfig = mockTransport.mock.calls[0][0];
        const targets = firstTransportConfig.targets;

        expect(
            targets.some((target) => target.target === "pino-pretty")
        ).toBe(true);
    });

    test("should not attach pretty terminal target in production", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "production",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        const firstTransportConfig = mockTransport.mock.calls[0][0];
        const targets = firstTransportConfig.targets;

        expect(
            targets.some((target) => target.target === "pino-pretty")
        ).toBe(false);
    });

    test("should create system, audit, and access loggers", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        const loggerModule = await import("../../backend/src/core/pino.logger.js");

        expect(mockPino).toHaveBeenCalledTimes(3);
        expect(loggerModule.system_logger).toBeDefined();
        expect(loggerModule.audit_logger).toBeDefined();
        expect(loggerModule.access_logger).toBeDefined();
        expect(loggerModule.loggers).toEqual({
            system_logger: loggerModule.system_logger,
            audit_logger: loggerModule.audit_logger,
            access_logger: loggerModule.access_logger,
        });
    });

    test("should configure redaction rules in base logger config", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        const firstLoggerConfig = mockPino.mock.calls[0][0];

        expect(firstLoggerConfig.redact).toBeDefined();
        expect(firstLoggerConfig.redact.remove).toBe(true);
        expect(firstLoggerConfig.redact.paths).toEqual(
            expect.arrayContaining([
                "password",
                "*.password",
                "token",
                "*.token",
                "req.headers.authorization",
                "req.headers.cookie",
            ])
        );
    });

    test("should expose mixin that adds readable level labels", async () => {
        mockExistsSync.mockReturnValue(true);

        await jest.unstable_mockModule("pino", () => ({
            default: mockPino,
        }));

        await jest.unstable_mockModule("node:fs", () => ({
            default: {
                existsSync: mockExistsSync,
                mkdirSync: mockMkdirSync,
            },
        }));

        await jest.unstable_mockModule("node:path", () => ({
            default: {
                join: mockJoin,
                resolve: mockResolve,
                dirname: mockDirname,
            },
        }));

        await jest.unstable_mockModule("node:url", () => ({
            fileURLToPath: mockFileURLToPath,
        }));

        await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
            config: {
                node_env: "development",
            },
        }));

        await import("../../backend/src/core/pino.logger.js");

        const firstLoggerConfig = mockPino.mock.calls[0][0];

        expect(firstLoggerConfig.mixin({}, 30)).toEqual({
            level_label: "info",
        });

        expect(firstLoggerConfig.mixin({}, 50)).toEqual({
            level_label: "error",
        });

        expect(firstLoggerConfig.mixin({}, 999)).toEqual({
            level_label: "info",
        });
    });
});