import mongoose from "mongoose";
import { system_logger } from "../core/pino.logger.js";
import redis from "../core/redis.js";

/**
 * ---------------------------------------------------------
 * GRACEFUL SHUTDOWN UTILITY
 * ---------------------------------------------------------
 *
 * Purpose:
 * Safely shuts down the application by:
 * - stopping new incoming connections
 * - allowing in-flight requests to complete
 * - closing open external resources
 * - forcing exit only if cleanup exceeds timeout
 *
 * Supported triggers:
 * - SIGINT
 * - SIGTERM
 * - uncaughtException
 * - unhandledRejection
 *
 * Notes:
 * - Designed to run once only
 * - Tracks active sockets so long-lived or stuck connections
 *   can be forcefully destroyed if shutdown hangs
 * - Uses unref() on timeout so it does not keep the event loop alive
 *
 * @param {import("http").Server | import("https").Server} server
 * @param {Object} [options]
 * @param {number} [options.forceExitTimeoutMs=30000]
 * @param {number} [options.connectionDrainTimeoutMs=5000]
 */
export function gracefulShutdown(server, options = {}) {
    const {
        forceExitTimeoutMs = 30_000,
        connectionDrainTimeoutMs = 5_000,
    } = options;

    /**
     * Prevent duplicate shutdown execution
     */
    let isShuttingDown = false;

    /**
     * Track whether handlers have already been registered
     */
    let handlersRegistered = false;

    /**
     * Track active socket connections
     */
    const connections = new Set();

    /**
     * Track sockets so lingering connections can be destroyed if needed
     */
    if (server?.on) {
        server.on("connection", (socket) => {
            connections.add(socket);

            socket.on("close", () => {
                connections.delete(socket);
            });
        });
    }

    /**
     * Safely destroy all tracked sockets
     */
    const destroyOpenSockets = () => {
        for (const socket of connections) {
            try {
                socket.destroy();
            } catch (error) {
                system_logger.error(
                    { err: error },
                    "Failed to destroy socket during shutdown."
                );
            }
        }
    };

    /**
     * Close HTTP server
     */
    const closeHttpServer = async () => {
        if (!server) return;

        if (!server.listening) {
            system_logger.info("HTTP server is not listening. Skipping close.");
            return;
        }

        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    return reject(err);
                }

                system_logger.info("HTTP server closed.");
                resolve();
            });
        });
    };

    /**
     * Close MongoDB connection
     */
    const closeMongoConnection = async () => {
        if (mongoose.connection.readyState === 0) {
            system_logger.info("MongoDB already disconnected. Skipping close.");
            return;
        }

        await mongoose.disconnect();
        system_logger.info("MongoDB connection closed.");
    };

    /**
     * Close Redis connection
     */
    const closeRedisConnection = async () => {
        if (!redis) {
            system_logger.info("Redis client not available. Skipping close.");
            return;
        }

        /**
         * ioredis statuses commonly include:
         * wait, connecting, connect, ready, close, end, reconnecting
         */
        const closableStatuses = new Set([
            "wait",
            "connecting",
            "connect",
            "ready",
            "reconnecting",
        ]);

        if (!closableStatuses.has(redis.status)) {
            system_logger.info(
                { redis_status: redis.status },
                "Redis is not in a closable state. Skipping close."
            );
            return;
        }

        try {
            await redis.quit();
            system_logger.info("Redis connection closed.");
        } catch (error) {
            /**
             * quit() may fail when the connection is unstable.
             * Fallback to disconnect() so shutdown still proceeds.
             */
            system_logger.warn(
                { err: error, redis_status: redis.status },
                "Redis quit failed. Falling back to disconnect()."
            );

            redis.disconnect();
            system_logger.info("Redis disconnected forcefully.");
        }
    };

    /**
     * Sleep helper
     */
    const wait = (ms) =>
        new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            timer.unref?.();
        });

    /**
     * Core shutdown handler
     *
     * @param {string} signal
     * @param {Error|unknown} [error]
     */
    const shutdown = async (signal, error = null) => {
        if (isShuttingDown) {
            system_logger.warn(
                { signal },
                "Shutdown already in progress. Ignoring additional trigger."
            );
            return;
        }

        isShuttingDown = true;

        system_logger.warn(
            {
                signal,
                err: error instanceof Error ? error : undefined,
            },
            "Shutdown signal received. Starting graceful cleanup."
        );

        /**
         * Fail-safe timeout
         * Forces process termination if cleanup hangs too long
         */
        const forceExitTimer = setTimeout(() => {
            system_logger.error(
                {
                    signal,
                    open_connections: connections.size,
                },
                `Shutdown timed out after ${forceExitTimeoutMs}ms. Forcing immediate exit.`
            );

            destroyOpenSockets();
            process.exit(1);
        }, forceExitTimeoutMs);

        forceExitTimer.unref?.();

        try {
            /**
             * Step 1: Stop accepting new requests
             */
            await closeHttpServer();

            /**
             * Step 2: Allow brief drain period for existing sockets
             */
            if (connections.size > 0) {
                system_logger.info(
                    {
                        open_connections: connections.size,
                        drain_timeout_ms: connectionDrainTimeoutMs,
                    },
                    "Allowing existing connections to drain before forceful socket cleanup."
                );

                await wait(connectionDrainTimeoutMs);
            }

            /**
             * Step 3: Close MongoDB connection
             */
            await closeMongoConnection();

            /**
             * Step 4: Close Redis connection
             */
            await closeRedisConnection();

            /**
             * Step 5: Destroy any lingering sockets
             */
            if (connections.size > 0) {
                system_logger.warn(
                    { open_connections: connections.size },
                    "Destroying lingering open sockets."
                );
            }

            destroyOpenSockets();

            clearTimeout(forceExitTimer);

            system_logger.info(
                { signal },
                "Graceful shutdown completed successfully. Process exiting."
            );

            process.exit(signal === "uncaughtException" ? 1 : 0);
        } catch (err) {
            clearTimeout(forceExitTimer);

            system_logger.fatal(
                {
                    signal,
                    err,
                    open_connections: connections.size,
                },
                "Graceful shutdown failed. Forcing process exit."
            );

            destroyOpenSockets();
            process.exit(1);
        }
    };

    /**
     * Register process-level shutdown handlers once
     */
    const registerHandlers = () => {
        if (handlersRegistered) return;
        handlersRegistered = true;

        process.once("SIGINT", () => {
            void shutdown("SIGINT");
        });

        process.once("SIGTERM", () => {
            void shutdown("SIGTERM");
        });

        process.once("uncaughtException", (error) => {
            system_logger.fatal(
                { err: error },
                "Uncaught exception detected."
            );

            void shutdown("uncaughtException", error);
        });

        process.once("unhandledRejection", (reason) => {
            system_logger.fatal(
                {
                    err: reason instanceof Error ? reason : undefined,
                    reason: reason instanceof Error ? reason.message : reason,
                },
                "Unhandled promise rejection detected."
            );

            void shutdown(
                "unhandledRejection",
                reason instanceof Error ? reason : null
            );
        });
    };

    registerHandlers();

    /**
     * Expose shutdown function for manual invocation in tests or bootstrap code
     */
    return {
        shutdown,
    };
}

export default gracefulShutdown;