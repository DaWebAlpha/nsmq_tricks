import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import helmet from "helmet";
import cookieParser from "cookie-parser";
import { xss } from "express-xss-sanitizer";
import mongoSanitize from "express-mongo-sanitize";

import { config } from "./config/config.js";
import { access_logger } from "./core/pino.logger.js";
import { notFound } from "./middlewares/notFound.js";
import { handleError } from "./middlewares/handleError.js";

import { authPageRouter } from "./routes/auth/auth.page.route.js";
import { pageRouter } from "./routes/pages/pages.routes.js";
import { subscriptionRouter } from "./routes/subscription/subscription.routes.js";
import { adminRouter } from "./routes/admin/admin.routes.js";
import { viewLocalsMiddleware } from "./middlewares/view.locals.middleware.js";

import { getClientIP, getUserAgent } from "./utils/request.js";

const app = express();

const NODE_ENV = config.node_env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "..", "frontend", "views"));

app.use(
    express.static(path.join(__dirname, "..", "..", "frontend", "public"), {
        maxAge: NODE_ENV === "production" ? "1d" : 0,
        etag: true,
    })
);

app.set("trust proxy", 1);

/**
 * CSP nonce for EJS inline scripts.
 */
app.use((request, response, next) => {
    response.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
});

/**
 * Security middleware.
 *
 * Important MathJax v4 notes:
 * - MathJax v4 injects runtime styles, so styleSrc must allow 'unsafe-inline'.
 * - Do NOT combine style nonce with 'unsafe-inline', because browsers ignore
 *   'unsafe-inline' when a nonce/hash exists in style-src.
 * - MathJax v4 may fetch extra resources from cdn.jsdelivr.net, so connectSrc
 *   must allow the CDN.
 */
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    (request, response) => `'nonce-${response.locals.cspNonce}'`,
                    "https://cdn.jsdelivr.net",
                    "blob:",
                ],

                workerSrc: [
                    "'self'",
                    "blob:",
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net",
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                ],

                fontSrc: [
                    "'self'",
                    "data:",
                    "https://cdn.jsdelivr.net",
                ],

                connectSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                ],

                objectSrc: ["'none'"],

                upgradeInsecureRequests:
                    NODE_ENV === "production" ? [] : null,
            },
        },
    })
);

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

app.use(cookieParser());

app.use(express.json({ limit: "10mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 50000,
}));
app.use(viewLocalsMiddleware);

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


app.use((request, response, next) => {
    const isNotesWriteRoute =
        request.method === "POST" &&
        request.originalUrl.startsWith("/admin/notes");

    if (isNotesWriteRoute && request.body?.content !== undefined) {
        const originalContent = request.body.content;

        xss()(request, response, (error) => {
            request.body.content = originalContent;
            next(error);
        });

        return;
    }

    return xss()(request, response, next);
});

app.get("/health", (_request, response) => {
    return response.status(200).json({
        status: "success",
        message: "Server is healthy",
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.use("/auth/page", authPageRouter);
app.use("/subscription", subscriptionRouter);
app.use("/", pageRouter);
app.use("/admin", adminRouter);

app.get("/test-error", (_request, _response, next) => {
    next(new Error("Something broke"));
});

app.use(notFound);
app.use(handleError);

export { app };
export default app;




