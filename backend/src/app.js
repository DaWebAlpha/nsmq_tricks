import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Security & Utility Imports
//import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { xss } from "express-xss-sanitizer";
import mongoSanitize from "express-mongo-sanitize";

// Internal Imports
import { config } from "./config/config.js";
import { access_logger } from "./core/pino.logger.js";
import { notFound } from "./middlewares/notFound.js";
import { handleError } from "./middlewares/handleError.js";

// Routes
import { authApiRouter } from "./routes/auth/auth.api.route.js";
import { authPageRouter } from "./routes/auth/auth.page.route.js";
import { pageRouter } from "./routes/pages/pages.routes.js";
import { csrfMiddleware } from "./middlewares/csrf.middleware.js";


import { 
    getClientIP,
    getUserAgent,
    
} from "./utils/request.js";

/**
 * ---------------------------------------------------------
 * EXPRESS APPLICATION INSTANCE
 * ---------------------------------------------------------
 */
const app = express();

/**
 * ---------------------------------------------------------
 * ENVIRONMENT CONFIGURATION
 * ---------------------------------------------------------
 */
const NODE_ENV = config.node_env;

/**
 * ---------------------------------------------------------
 * PATH CONFIGURATION (ESM SAFE)
 * ---------------------------------------------------------
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ---------------------------------------------------------
 * EXPRESS HARDENING
 * ---------------------------------------------------------
 *
 * Removes Express signature header.
 */
app.disable("x-powered-by");

/**
 * ---------------------------------------------------------
 * VIEW ENGINE & STATIC FILES
 * ---------------------------------------------------------
 */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "..", "frontend", "views"));

app.use(
    express.static(path.join(__dirname, "..", "..", "frontend", "public"), {
        maxAge: NODE_ENV === "production" ? "1d" : 0,
        etag: true,
    })
);

/**
 * ---------------------------------------------------------
 * TRUST PROXY
 * ---------------------------------------------------------
 */
app.set("trust proxy", 1);

/**
 * ---------------------------------------------------------
 * SECURITY MIDDLEWARE
 * ---------------------------------------------------------
 */
app.use(helmet());

/**
 * ---------------------------------------------------------
 * ACCESS LOGGER (POST-RESPONSE)
 * ---------------------------------------------------------
 *
 * Logs after response is sent to capture status and duration.
 */
app.use((request, response, next) => {
    const startTime = Date.now();

    response.on("finish", () => {
        access_logger.info({
            method: request.method,
            url: request.originalUrl,
            ip: getClientIP(request),
            status_code: response.statusCode,
            user_agent: getUserAgent(request),
            duration_ms: Date.now() - startTime,
        });
    });

    next();
});

/**
 * ---------------------------------------------------------
 * CORS CONFIGURATION (LOCAL DEFINITION)
 * ---------------------------------------------------------
 *
 * Defined here (not config) to avoid affecting existing config tests.
 */
/* const CORS_ORIGINS = {
    development: ["http://localhost:5173"],
    production: ["https://yourproductiondomain.com"],
};

const allowedOrigins = CORS_ORIGINS[NODE_ENV] || [];

app.use(
    cors({
        origin(origin, callback) {
            // Allow tools like Postman / curl (no origin)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("CORS origin not allowed"));
        },
        credentials: true,
    })
);
 */
/**
 * ---------------------------------------------------------
 * REQUEST PARSERS
 * ---------------------------------------------------------
 */
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(csrfMiddleware);

/**
 * ---------------------------------------------------------
 * MONGO SANITIZE
 * ---------------------------------------------------------
 *
 * Prevents MongoDB operator injection.
 */
app.use((request, _response, next) => {
    if (request.body) {
        request.body = mongoSanitize.sanitize(request.body);
    }

    if (request.query) {
        const cleanQuery = mongoSanitize.sanitize(request.query);
        Object.keys(request.query).forEach((key) => delete request.query[key]);
        Object.assign(request.query, cleanQuery);
    }

    if (request.params) {
        const cleanParams = mongoSanitize.sanitize(request.params);
        Object.keys(request.params).forEach((key) => delete request.params[key]);
        Object.assign(request.params, cleanParams);
    }

    next();
});

/**
 * ---------------------------------------------------------
 * XSS PROTECTION
 * ---------------------------------------------------------
 */
app.use(xss());

/**
 * ---------------------------------------------------------
 * HEALTH CHECK
 * ---------------------------------------------------------
 */
app.get("/health", (_request, response) => {
    return response.status(200).json({
        status: "success",
        message: "Server is healthy",
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

/**
 * ---------------------------------------------------------
 * APPLICATION ROUTES
 * ---------------------------------------------------------
 */
app.use("/auth/api", authApiRouter);
app.use("/auth/page", authPageRouter);

app.use("/", pageRouter);

/**
 * ---------------------------------------------------------
 * ERROR HANDLING
 * ---------------------------------------------------------
 */
app.use(notFound);
app.use(handleError);

export { app };
export default app;