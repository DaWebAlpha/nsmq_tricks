import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";

const MODULE_PATH = "../../backend/src/config/config.js";

const ORIGINAL_ENV = { ...process.env };

/**
 * Build a fully valid environment for successful module import.
 */
const buildValidEnv = (overrides = {}) => ({
    PORT: "5000",
    MONGO_URI: "mongodb://127.0.0.1:27017/app_test",
    NODE_ENV: "development",
    LOG_LEVEL: "info",
    REDIS_URI: "redis://127.0.0.1:6379",
    MAX_FAILED_ATTEMPTS: "5",
    LOCK_DURATION: "900000",
    JWT_ACCESS_SECRET: "12345678901234567890123456789012",
    ACCESS_TOKEN_COOKIE_NAME: "access_token",
    REFRESH_TOKEN_COOKIE_NAME: "refresh_token",
    ...overrides,
});

/**
 * Import the config module fresh after resetting modules and mocking dotenv.
 * This is required because the module executes validation immediately on import.
 */
const importFreshConfigModule = async ({
    envOverrides = {},
    dotenvReturnValue = {},
} = {}) => {
    jest.resetModules();

    process.env = buildValidEnv(envOverrides);

    const dotenvConfigMock = jest.fn(() => dotenvReturnValue);

    jest.unstable_mockModule("dotenv", () => ({
        default: {
            config: dotenvConfigMock,
        },
    }));

    const importedModule = await import(MODULE_PATH);

    return {
        importedModule,
        dotenvConfigMock,
    };
};

beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("config module", () => {
    describe("successful initialization", () => {
        test("exports a fully validated config object", async () => {
            const { importedModule } = await importFreshConfigModule();

            expect(importedModule.config).toEqual({
                port: 5000,
                mongo_uri: "mongodb://127.0.0.1:27017/app_test",
                node_env: "development",
                log_level: "info",
                redis_uri: "redis://127.0.0.1:6379",
                max_failed_attempts: 5,
                lock_duration: 900000,
                jwt_access_secret: "12345678901234567890123456789012",
                access_token_cookie_name: "access_token",
                refresh_token_cookie_name: "refresh_token",
            });
        });

        test("named export and default export reference the same object", async () => {
            const { importedModule } = await importFreshConfigModule();

            expect(importedModule.default).toBe(importedModule.config);
        });

        test("calls dotenv.config exactly once during module initialization", async () => {
            const { dotenvConfigMock } = await importFreshConfigModule();

            expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
            expect(dotenvConfigMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: expect.any(String),
                })
            );
        });

        test("returns an immutable config object", async () => {
            const { importedModule } = await importFreshConfigModule();

            expect(Object.isFrozen(importedModule.config)).toBe(true);

            expect(() => {
                importedModule.config.port = 9999;
            }).toThrow(TypeError);

            expect(importedModule.config.port).toBe(5000);
        });
    });

    describe("required environment variable validation", () => {
        test.each([
            ["MONGO_URI"],
            ["REDIS_URI"],
            ["JWT_ACCESS_SECRET"],
            ["ACCESS_TOKEN_COOKIE_NAME"],
            ["REFRESH_TOKEN_COOKIE_NAME"],
        ])("throws when %s is missing", async (envKey) => {
            await expect(
                importFreshConfigModule({
                    envOverrides: {
                        [envKey]: "",
                    },
                })
            ).rejects.toThrow(`Missing required environment variable: ${envKey}`);
        });

        test.each([
            ["MONGO_URI"],
            ["REDIS_URI"],
            ["JWT_ACCESS_SECRET"],
            ["ACCESS_TOKEN_COOKIE_NAME"],
            ["REFRESH_TOKEN_COOKIE_NAME"],
        ])("throws when %s contains only whitespace", async (envKey) => {
            await expect(
                importFreshConfigModule({
                    envOverrides: {
                        [envKey]: "   ",
                    },
                })
            ).rejects.toThrow(`Missing required environment variable: ${envKey}`);
        });
    });

    describe("security validation", () => {
        test("throws when JWT_ACCESS_SECRET is shorter than 32 characters", async () => {
            await expect(
                importFreshConfigModule({
                    envOverrides: {
                        JWT_ACCESS_SECRET: "short-secret",
                    },
                })
            ).rejects.toThrow("JWT_ACCESS_SECRET must be at least 32 characters");
        });

        test("accepts JWT_ACCESS_SECRET when it is exactly 32 characters", async () => {
            const exact32 = "12345678901234567890123456789012";

            const { importedModule } = await importFreshConfigModule({
                envOverrides: {
                    JWT_ACCESS_SECRET: exact32,
                },
            });

            expect(importedModule.config.jwt_access_secret).toBe(exact32);
        });
    });

    describe("NODE_ENV validation", () => {
        test.each([
            ["development"],
            ["production"],
            ["test"],
        ])("accepts valid NODE_ENV value: %s", async (nodeEnv) => {
            const { importedModule } = await importFreshConfigModule({
                envOverrides: {
                    NODE_ENV: nodeEnv,
                },
            });

            expect(importedModule.config.node_env).toBe(nodeEnv);
        });

        test("throws when NODE_ENV is invalid", async () => {
            await expect(
                importFreshConfigModule({
                    envOverrides: {
                        NODE_ENV: "staging",
                    },
                })
            ).rejects.toThrow("Invalid NODE_ENV: staging");
        });

        test("throws when NODE_ENV is undefined", async () => {
            const env = buildValidEnv();
            delete env.NODE_ENV;

            jest.resetModules();
            process.env = env;

            jest.unstable_mockModule("dotenv", () => ({
                default: {
                    config: jest.fn(() => ({})),
                },
            }));

            await expect(import(MODULE_PATH)).rejects.toThrow("Invalid NODE_ENV: undefined");
        });
    });

    describe("numeric normalization", () => {
        test("uses provided positive integer values", async () => {
            const { importedModule } = await importFreshConfigModule({
                envOverrides: {
                    PORT: "7000",
                    MAX_FAILED_ATTEMPTS: "8",
                    LOCK_DURATION: "1200000",
                },
            });

            expect(importedModule.config.port).toBe(7000);
            expect(importedModule.config.max_failed_attempts).toBe(8);
            expect(importedModule.config.lock_duration).toBe(1200000);
        });

        test.each([
            ["PORT", "abc", "port", 4000],
            ["PORT", "-1", "port", 4000],
            ["PORT", "0", "port", 4000],
            ["PORT", "5000.5", "port", 4000],
            ["MAX_FAILED_ATTEMPTS", "abc", "max_failed_attempts", 5],
            ["MAX_FAILED_ATTEMPTS", "-2", "max_failed_attempts", 5],
            ["MAX_FAILED_ATTEMPTS", "0", "max_failed_attempts", 5],
            ["MAX_FAILED_ATTEMPTS", "2.5", "max_failed_attempts", 5],
            ["LOCK_DURATION", "abc", "lock_duration", 900000],
            ["LOCK_DURATION", "-100", "lock_duration", 900000],
            ["LOCK_DURATION", "0", "lock_duration", 900000],
            ["LOCK_DURATION", "900000.5", "lock_duration", 900000],
        ])(
            "falls back to default when %s is invalid (%s)",
            async (envKey, envValue, configKey, expectedFallback) => {
                const { importedModule } = await importFreshConfigModule({
                    envOverrides: {
                        [envKey]: envValue,
                    },
                });

                expect(importedModule.config[configKey]).toBe(expectedFallback);
            }
        );
    });

    describe("log level normalization", () => {
        test.each([
            ["fatal"],
            ["error"],
            ["warn"],
            ["info"],
            ["debug"],
            ["trace"],
        ])("accepts valid log level: %s", async (logLevel) => {
            const { importedModule } = await importFreshConfigModule({
                envOverrides: {
                    LOG_LEVEL: logLevel,
                },
            });

            expect(importedModule.config.log_level).toBe(logLevel);
        });

        test("defaults to info when LOG_LEVEL is invalid", async () => {
            const { importedModule } = await importFreshConfigModule({
                envOverrides: {
                    LOG_LEVEL: "verbose",
                },
            });

            expect(importedModule.config.log_level).toBe("info");
        });

        test("defaults to info when LOG_LEVEL is undefined", async () => {
            const env = buildValidEnv();
            delete env.LOG_LEVEL;

            jest.resetModules();
            process.env = env;

            jest.unstable_mockModule("dotenv", () => ({
                default: {
                    config: jest.fn(() => ({})),
                },
            }));

            const importedModule = await import(MODULE_PATH);

            expect(importedModule.config.log_level).toBe("info");
        });
    });

    describe("dotenv integration", () => {
        test("does not fail when dotenv.config returns an empty object", async () => {
            const { importedModule } = await importFreshConfigModule({
                dotenvReturnValue: {},
            });

            expect(importedModule.config).toBeDefined();
        });

        test("uses process.env values after dotenv.config is invoked", async () => {
            const dotenvConfigMock = jest.fn(() => {
                process.env.PORT = "6500";
                return {};
            });

            jest.resetModules();
            process.env = buildValidEnv();

            jest.unstable_mockModule("dotenv", () => ({
                default: {
                    config: dotenvConfigMock,
                },
            }));

            const importedModule = await import(MODULE_PATH);

            expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
            expect(importedModule.config.port).toBe(6500);
        });
    });
});