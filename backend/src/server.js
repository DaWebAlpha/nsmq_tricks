import { app } from "./app.js";
import { config } from "./config/config.js";
import { databaseConnection } from "./core/mongoose.database.js";
import { system_logger } from "./core/pino.logger.js";
import { gracefulShutdown } from "./utils/gracefulShutdown.js";

/**
 * Application Port Configuration
 *
 * Loaded from environment configuration.
 */
const PORT = config.port;

/**
 * Server Bootstrap Function
 *
 * Purpose:
 * Initializes the application by:
 * - Connecting to the database
 * - Starting the HTTP server
 * - Attaching graceful shutdown handlers
 *
 * Responsibilities:
 * - Ensures database is connected before accepting requests
 * - Logs startup status
 * - Handles initialization errors
 */
const startServer = async function () {
    try {
        /**
         * Step 1: Establish Database Connection
         * Ensures MongoDB is connected before starting the server.
         */
        await databaseConnection();

        /**
         * Step 2: Start HTTP Server
         * Begins listening for incoming requests on the configured port.
         */
        const server = app.listen(PORT, () => {
            system_logger.info(`Listening on PORT ${PORT}`);
        });

        server.on("error", (error) => {
            system_logger.error({ err: error }, "HTTP server startup failed");
            process.exit(1);
        });

        /**
         * Step 3: Attach Graceful Shutdown Handlers
         * Enables safe shutdown on process signals or unexpected failures.
         */
        gracefulShutdown(server);

    } catch (error) {
        /**
         * Step 4: Handle Startup Errors
         * Logs failure and exits process.
         */
        system_logger.error({ err: error }, "Application startup failed");
        process.exit(1);
    }
};

/**
 * Application Entry Point
 *
 * Invokes the server bootstrap process.
 */
startServer();