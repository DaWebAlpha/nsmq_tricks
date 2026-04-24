import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const MODULE_PATH = "../../backend/src/core/mongoose.database.js";
const LOGGER_PATH = "../../backend/src/core/pino.logger.js";
const CONFIG_PATH = "../../backend/src/config/config.js";

const connectMock = jest.fn();
const infoMock = jest.fn();
const warnMock = jest.fn();
const errorMock = jest.fn();

const setupMocks = async (nodeEnv = "development") => {
    jest.resetModules();

    connectMock.mockReset();
    infoMock.mockReset();
    warnMock.mockReset();
    errorMock.mockReset();

    const handlers = {};
    const onMock = jest.fn((event, handler) => {
        handlers[event] = handler;
    });

    jest.unstable_mockModule("mongoose", () => ({
        default: {
            connect: connectMock,
            connection: {
                readyState: 0,
                on: onMock,
            },
        },
    }));

    jest.unstable_mockModule(LOGGER_PATH, () => ({
        system_logger: {
            info: infoMock,
            warn: warnMock,
            error: errorMock,
        },
    }));

    jest.unstable_mockModule(CONFIG_PATH, () => ({
        config: {
            mongo_uri: "mongodb://127.0.0.1:27017/testdb",
            node_env: nodeEnv,
        },
    }));

    const module = await import(MODULE_PATH);
    const mongoose = (await import("mongoose")).default;

    return {
        databaseConnection: module.databaseConnection,
        mongoose,
        onMock,
        handlers,
    };
};

describe("databaseConnection", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should connect to MongoDB successfully", async () => {
        const { databaseConnection } = await setupMocks("development");

        connectMock.mockResolvedValueOnce();

        await databaseConnection();

        expect(connectMock).toHaveBeenCalledTimes(1);

        const [uri, options] = connectMock.mock.calls[0];

        expect(uri).toBe("mongodb://127.0.0.1:27017/testdb");
        expect(options).toMatchObject({
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            autoIndex: true,
        });

        expect(infoMock).toHaveBeenCalledWith("MongoDB connected successfully");
    });

    it("should not reconnect if already connected", async () => {
        const { databaseConnection, mongoose } = await setupMocks("development");

        mongoose.connection.readyState = 1;

        await databaseConnection();

        expect(connectMock).not.toHaveBeenCalled();
        expect(warnMock).toHaveBeenCalledWith("MongoDB already connected");
    });

    it("should throw error when connection fails", async () => {
        const { databaseConnection } = await setupMocks("development");

        const dbError = new Error("Connection failed");
        connectMock.mockRejectedValueOnce(dbError);

        await expect(databaseConnection()).rejects.toThrow(
            "MongoDB connection failed"
        );

        expect(errorMock).toHaveBeenCalledWith(
            { err: dbError },
            "MongoDB connection failed"
        );
    });

    it("should disable autoIndex in production", async () => {
        const { databaseConnection } = await setupMocks("production");

        connectMock.mockResolvedValueOnce();

        await databaseConnection();

        const [, options] = connectMock.mock.calls[0];
        expect(options.autoIndex).toBe(false);
    });

    it("should register mongoose connection event listeners", async () => {
        const { onMock } = await setupMocks("development");

        expect(onMock).toHaveBeenCalledWith("connected", expect.any(Function));
        expect(onMock).toHaveBeenCalledWith("reconnected", expect.any(Function));
        expect(onMock).toHaveBeenCalledWith("disconnected", expect.any(Function));
        expect(onMock).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should log correctly when mongoose connection events fire", async () => {
        const { handlers } = await setupMocks("development");

        expect(typeof handlers.connected).toBe("function");
        expect(typeof handlers.reconnected).toBe("function");
        expect(typeof handlers.disconnected).toBe("function");
        expect(typeof handlers.error).toBe("function");

        handlers.connected();
        expect(infoMock).toHaveBeenCalledWith("MongoDB connection established");

        handlers.reconnected();
        expect(warnMock).toHaveBeenCalledWith("MongoDB reconnected");

        handlers.disconnected();
        expect(warnMock).toHaveBeenCalledWith("MongoDB connection lost");

        const err = new Error("boom");
        handlers.error(err);

        expect(errorMock).toHaveBeenCalledWith(
            { err },
            "MongoDB connection error"
        );
    });
});