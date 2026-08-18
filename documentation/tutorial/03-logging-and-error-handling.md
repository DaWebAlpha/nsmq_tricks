# Section 3 — Logging & Error Handling

[← Back to index](../README.md) · Previous: [Config & Database Connection](02-config-and-database.md) · Next: [The Base Model Pattern →](04-base-model-pattern.md)

## Why

Two problems show up in every real backend, early:

1. **`console.log` doesn't scale.** It has no severity levels, no structure, and once your app is
   running on a real server you can't easily search or filter it.
2. **`throw new Error("something")` doesn't tell you what HTTP status to send back.** A "user not
   found" error and a "database is down" error are both just `Error` objects — your code has no
   clean way to know one should return 404 and the other 500.

This section fixes both with two small, reusable pieces: a structured logger, and a small family
of typed error classes that carry their own HTTP status code.

## Step 1 — Install a real logger

```bash
npm install pino pino-pretty pino-roll
```

**What each does:** `pino` is a fast, structured logging library — instead of `"User logged in"`,
you log `{ userId, msg: "User logged in" }`, which is searchable and filterable once you have
thousands of lines of logs. `pino-pretty` reformats those structured logs into readable
colored text *while developing* — you wouldn't want that formatting overhead in production.
`pino-roll` writes those logs to files on disk, automatically starting a new file on a schedule
(daily, here) and once a file crosses a size limit, instead of one log file growing forever.

## Step 1a — Declare which fields never get logged

Some data should never end up in a log file, even by accident — passwords, tokens, cookies,
`Authorization` headers. Create `backend/src/constants/sensitiveFields.js`:

```javascript
/**
 * Pino `redact` paths for values that must never be written to a log file —
 * passwords, tokens, cookies, and auth headers. Fields are listed both at
 * the top level of a logged object and nested one level down (the
 * `*.`-prefixed entries), since real log calls hit both shapes.
 * @see https://getpino.io/#/docs/redaction
 */
const SENSITIVE_FIELDS = Object.freeze([
    "password",
    "*.password",
    "token",
    "*.token",
    "access_token",
    "refresh_token",
    "*.access_token",
    "*.refresh_token",
    "accessToken",
    "*.accessToken",
    "refreshToken",
    "*.refreshToken",
    "apiKey",
    "*.apiKey",
    "authorization",
    "*.authorization",
    "headers.authorization",
    "*.headers.authorization",
    "cookie",
    "*.cookie",
    "headers.cookie",
    "*.headers.cookie",
    "req.headers.authorization",
    "req.headers.cookie",
])

export { SENSITIVE_FIELDS };
```

**What this does:** each entry is a [pino `redact` path](https://getpino.io/#/docs/redaction) —
a dotted path (with `*` as a wildcard for "any key at this level") describing where a sensitive
value might live inside whatever object you pass to the logger. The `*.password` /
`headers.authorization` duplication isn't a mistake: the plain path catches the field at the top
level of a logged object (`logger.info({ password })`), the `*.`-prefixed one catches it nested
one level down (`logger.info({ user: { password } })`) — real log calls hit both shapes.

Update `backend/src/constants/index.js` to export it alongside `MONGOOSE_OPTIONS`:

```javascript
export { MONGOOSE_OPTIONS } from "./mongoose.options.js";
export { SENSITIVE_FIELDS } from "./sensitiveFields.js";
```

## Step 1b — Build the logger

Create `backend/src/logger/pino.logger.js`:

```javascript
/**
 * Structured, file-backed logging built on pino. Exports three independent
 * loggers (`systemLogger`, `auditLogger`, `accessLogger`) so general app
 * logs, audit trails, and HTTP access logs can be filtered, retained, and
 * shipped separately instead of interleaving in one stream.
 */

import pino from "pino";
import path from "node:path";
import fs from "node:fs";

import { config } from "../config/index.js";
import { SENSITIVE_FIELDS } from "../constants/index.js";

const isDevelopment = 
        config.nodeEnv === "development";

const logLevel = isDevelopment ? 
                "debug" :
                "info";

const logDirectory = path.resolve(config.logDirectory);

if(!fs.existsSync(logDirectory)){
    fs.mkdirSync(logDirectory, {recursive: true});
}


/**
 * Builds a single `pino-roll` file transport target: a daily-rolled,
 * size-capped log file under `logDirectory`, with older files pruned once
 * `retentionCount` is exceeded.
 *
 * @param {string} fileLocation - Path (relative to `logDirectory`) for the rolled log file, e.g. "system/app-info".
 * @param {string} frequency - Roll frequency accepted by pino-roll, e.g. "daily".
 * @param {string} fileSize - Max file size before rolling to a new file, e.g. "20m".
 * @param {string} [minLevel=logLevel] - Minimum pino level written to this target.
 * @param {number} retentionCount - How many rolled files to keep before older ones are deleted.
 * @returns {object} A pino.transport target descriptor.
 */
const buildTransportTarget = (
    fileLocation,
    frequency,
    fileSize,
    minLevel = logLevel,
    retentionCount
) => ({
    target: "pino-roll",
    level: minLevel,
    options: {
        file: path.join(logDirectory, fileLocation),
        extension: ".json",
        frequency,
        size: fileSize,
        mkdir: true,
        dateFormat: "yyyy-MM-dd",
        sync: false,
        limit: {
            count: retentionCount
        },
    }
})

/**
 * In development, mirror every log line to the terminal via pino-pretty; in
 * production this is an empty array, so each transport writes only its
 * file target.
 */
const terminalTargets = isDevelopment
    ? [
        {
            target: "pino-pretty",
            options: {
                colorize: true,
                ignore: "pid, hostname",
                translateTime: "SYS:yyyy-MM-dd HH:mm:ss",
            }
        }
    ] :
    [];


/** General application info/error logs, split into separate files, both kept 90 days. */
const systemTransport = pino.transport({
    targets: [
        buildTransportTarget(
            "system/app-info", 
            "daily",
            "20m",
            "info",
            90,
        ),
        buildTransportTarget(
            "system/app-error",
            "daily",
            "20m",
            "error",
            90
        ),
        ...terminalTargets,
    ],
});


/** Audit trail logs — kept longer (180 days) than system logs. */
const auditTransport = pino.transport({
    targets: [
        buildTransportTarget(
            "audit/app-audit",
            "daily",
            "20m",
            "info",
            180
        ),
        ...terminalTargets
    ],
});


/** HTTP access logs — high-volume, so kept for a shorter window (30 days). */
const accessTransport = pino.transport({
    targets: [
        buildTransportTarget(
            "access/app-access",
            "daily",
            "20m",
            "info",
            30
        ),
        ...terminalTargets
    ],
});

/**
 * Builds the pino options shared by all three loggers: level, ISO
 * timestamps, a fixed `service`/`environment` base object, sensitive-field
 * redaction, and a `level_label` mixin so every log line carries a
 * readable level name alongside the numeric one.
 *
 * @returns {object} Options passed as the first argument to `pino(...)`.
 */
const getBaseConfig = () => ({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,

    base: {
        service: config.service,
        environment: config.nodeEnv,
    },

    redact: {
        paths: [
            ...SENSITIVE_FIELDS
        ],
        remove: true
    },
    mixin(_context, levelNumber){
        const labels = {
            10: "trace",
            20: "debug",
            30: "info",
            40: "warn",
            50: "error",
            60: "fatal"
        };

        return {
            level_label: labels[levelNumber] || logLevel,
        }
    },
});


/** General application logs (info/error), split into daily rolled files. */
export const systemLogger = pino(
    getBaseConfig(),
    systemTransport
);

/** Audit trail logs, kept longer than system logs (180 vs 90 days). */
export const auditLogger = pino(
    getBaseConfig(),
    auditTransport,
)

/** HTTP access logs. */
export const accessLogger = pino(
    getBaseConfig(),
    accessTransport
)

/** Convenience bundle of all three loggers. */
export const loggers = {
    systemLogger,
    auditLogger,
    accessLogger
}
```

**What this does:** in development, logs get piped through `pino-pretty` for colorized,
human-readable output in your terminal. In production, `terminalTargets` is an empty array, so
each transport is left with only its file target — Pino writes plain structured JSON to disk
instead, the format log-aggregation tools (like Datadog or CloudWatch) actually want.

- `SENSITIVE_FIELDS` is spread (`...SENSITIVE_FIELDS`) into `redact.paths` rather than passed as
  a single array, because pino's `redact.paths` option expects one string per array entry, not a
  nested array — this is the payoff for having declared those paths as their own constant in
  Step 1a instead of inlining them here.
- `three loggers, three transports`: `systemLogger` is general app info/error output (90-day
  retention on both), `auditLogger` is kept longer (180 days) since audit trails tend to matter
  for compliance long after a debug log would be useless, and `accessLogger` (HTTP access logs)
  is kept shortest (30 days) since it's high-volume and mostly useful for near-term traffic
  debugging.
- `minLevel = logLevel` as the default parameter means a transport target that doesn't specify
  its own minimum level (like the `"info"`/`"error"` split above) instead follows whatever level
  the whole app is running at — `"debug"` in development, `"info"` in production — rather than
  silently hardcoding `"info"` regardless of environment.
- `base: { service: config.service, ... }` stamps every single log line, across all three
  loggers, with which service emitted it — this is what makes it possible to search a shared log
  aggregator for logs from just this one service once you're running more than one.

**Demonstration:** anywhere in your code, replace a `console.log("Server started")` with:

```javascript
systemLogger.info("Server started");
```

Run the app — in development you'll see a colorized line with a timestamp and log level. That's
the same call that, in production, becomes a parseable JSON line instead. Check the `logs/`
directory afterward too — you should see `logs/system/`, `logs/audit/`, and `logs/access/`
subfolders appear, each holding a dated, rolled log file.

## Step 1c — Wire the logger into what you already built

Section 2's `database.js` and `server.js` were written against `console.log`/`console.error`
because the logger didn't exist yet. Now that it does, swap them over.

Update `backend/src/config/database.js`:

```javascript
import mongoose from "mongoose";
import { config } from "./index.js";
import { MONGOOSE_OPTIONS } from "../constants/index.js"; 
import { systemLogger } from "../logger/pino.logger.js";

/**
 * Opens the Mongoose connection to MongoDB using the URI from {@link config}
 * and the pool/timeout options from `MONGOOSE_OPTIONS`.
 *
 * Logs and re-throws on failure rather than swallowing it — it's the
 * caller's job (see `server.js`) to decide whether a failed connection
 * should stop the app from starting.
 *
 * @returns {Promise<void>}
 * @throws Re-throws whatever error Mongoose threw while connecting.
 */
const connectDatabase = async() => {
    try{
        await mongoose
              .connect(
                config.mongoUri,
                MONGOOSE_OPTIONS
            )
    }catch(error){
       systemLogger.error({err: error}, "Database connection error");
       throw error;
    }
}


/**
 * Mongoose keeps one persistent connection open behind the scenes — these
 * listeners make sure connection-lifecycle events after the initial
 * `connect()` (e.g. a dropped network link) still reach the logs instead of
 * failing silently.
 */
mongoose.connection.on("connected", () => {
    systemLogger.info(`Database has been connected`);
})

mongoose.connection.on("disconnected", () => {
    systemLogger.warn("Database has been disconnected");
})

mongoose.connection.on("error", (err)=> {
    systemLogger.error({err}, "Database connection error");
})


export {
    connectDatabase
}
```

Update `backend/src/server.js`:

```javascript
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { config } from "./config/index.js";
import { systemLogger} from "./logger/pino.logger.js";


const startServer = async() => {
    try{
        await connectDatabase();

        const server = app.listen(config.port, () => {
            systemLogger.info(`Listening on port: ${config.port}`);
        })
    }catch(error){
        systemLogger.error({err: error}, "Server connection error");
        process.exit(1);
    }
}

startServer()
```

**What changed, and one bug worth noticing:** every `console.log`/`console.error` became a
`systemLogger.info`/`systemLogger.error` call — same information, now structured, leveled, and
routed to the rolled files you just set up instead of only the terminal. Look closely at the
`"error"` event listener in `database.js`: the callback's parameter is named `err`, and it's
logged as `{err}` — **not** `{err: error}`. A connection-error handler that logs a variable
called `error` when its own parameter is actually named `err` will throw a `ReferenceError` the
moment it runs, which is strictly worse than the connection error it was trying to report. It's
an easy typo to make once you've written `{err: error}` a few times elsewhere in the same file
(the `catch (error)` block above it uses `error` correctly, because there the caught variable
really is named `error`) — worth a second look any time you copy a log call between two blocks
with differently-named error variables.

## Step 2 — A typed error hierarchy

### Step 2a — Name your status codes

Before writing error classes, give the HTTP status codes they'll use actual names, so
`HTTP_STATUS.NOT_FOUND` shows up at every call site instead of a bare `404` that's easy to typo
or misread. Create `backend/src/constants/httpStatus.js`:

```javascript
/**
 * Central map of HTTP status codes used across the app, so routes and error
 * classes reference a name (`HTTP_STATUS.NOT_FOUND`) instead of a bare
 * number that's easy to typo or misread.
 */
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
})

export { HTTP_STATUS };
```

Update `backend/src/constants/index.js` to export it alongside what's already there:

```javascript
/**
 * Barrel file re-exporting every constant module.
 */
export { MONGOOSE_OPTIONS } from "./mongoose.options.js";
export { SENSITIVE_FIELDS } from "./sensitiveFields.js";
export { HTTP_STATUS } from "./httpStatus.js";
```

### Step 2b — The base class every error extends

Create `backend/src/errors/app.error.js`:

```javascript
import { HTTP_STATUS } from "../constants/index.js";

/**
 * Base class for all operational application errors.
 *
 * Extends the built-in `Error` with an HTTP status code, an optional
 * machine-readable `code`, and an `isOperational` flag that marks it as an
 * anticipated, handled error rather than an unexpected bug — error-handling
 * middleware uses that flag to decide whether it's safe to show `message`
 * to the client verbatim.
 *
 * @extends Error
 */
class AppError extends Error{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Internal server error"] - Human-readable error message.
     * @param {number} [options.statusCode=HTTP_STATUS.INTERNAL_SERVER_ERROR] - HTTP status code to send in the response.
     * @param {string} [options.code] - Optional machine-readable error code (e.g. "USER_NOT_FOUND").
     */
    constructor({
        message = "Internal server error",
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code
    } = {}){
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        if(Error.captureStackTrace){
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export {
    AppError
}
```

**What this does:** it's a normal `Error` (so `instanceof Error` and `.stack` still work) with
three extra properties bolted on:

- `statusCode` — the HTTP status this error should produce, read from `HTTP_STATUS` rather than a
  bare number.
- `code` — an optional short machine-readable string (`"USER_NOT_FOUND"`) a frontend could switch
  on, separate from the human-readable `message`.
- `isOperational: true` — marks this as an *expected*, handled error (a user submitted bad data),
  as opposed to a genuine bug. You'll see why that distinction matters in Step 4.
- `Error.captureStackTrace(this, this.constructor)` — trims the stack trace so it starts at
  wherever you threw the error, instead of including these constructor frames themselves.
  Double-check that method name if you ever retype it by hand: `Error.captureStackTrace` is the
  real one, and a typo there (e.g. `captureStatckTrace`) doesn't fail quietly — the `if` check
  above only confirms `Error.captureStackTrace` (the correctly-spelled one) exists, so calling a
  misspelled version throws a `TypeError` on every single error you construct, anywhere in the app.

### Step 2c — The specific errors you'll actually throw

Each of these follows the same shape: extend `AppError`, hardcode the `statusCode` for that
status, and give `message` a sensible default so `throw new NotFoundError()` alone still produces
a reasonable response.

`backend/src/errors/badRequest.error.js` — 400, malformed or invalid request data:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";

/**
 * 400 Bad Request — the request was malformed or failed validation.
 *
 * @extends AppError
 */
class BadRequestError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Bad request error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Bad request error",
        code,
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code,
        })
    }
}

export { BadRequestError };
```

`backend/src/errors/notFound.error.js` — 404, the requested resource doesn't exist:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";

/**
 * 404 Not Found — the requested resource doesn't exist.
 *
 * @extends AppError
 */
class NotFoundError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Not found error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Not found error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.NOT_FOUND,
            code
        })
    }
}

export { NotFoundError };
```

`backend/src/errors/conflict.error.js` — 409, the request conflicts with the resource's current
state (a duplicate email on signup, for example):

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";

/**
 * 409 Conflict — the request conflicts with the current state of the
 * resource (e.g. a duplicate email on signup).
 *
 * @extends AppError
 */
class ConflictError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Conflict error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Conflict error",
        code,
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.CONFLICT,
            code,
        })
    }
}

export { ConflictError };
```

**Name the class after what you export.** It's tempting to shorten this to `class Conflict`, but
the moment `errors/index.js` does `export { ConflictError } from "./conflict.error.js"` and no
`ConflictError` identifier exists in that file, you get a `SyntaxError` at import time — and
because ES module barrels are linked together, that one bad export breaks *every* class in the
barrel, not just this one. Keep the class name and the exported name identical.

`backend/src/errors/forbidden.error.js` — 403, the caller is authenticated but not allowed to do
this:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";


/**
 * 403 Forbidden — the caller is authenticated but not allowed to perform
 * this action.
 *
 * @extends AppError
 */
class ForbiddenError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Forbidden error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Forbidden error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.FORBIDDEN,
            code
        })
    }
}

export { ForbiddenError };
```

`backend/src/errors/unauthenticated.error.js` — 401, the request has no valid credentials at all:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";


/**
 * 401 Unauthenticated — the request has no valid credentials.
 *
 * @extends AppError
 */
class UnauthenticatedError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Unauthenticated error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Unauthenticated error",
        code,
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.UNAUTHENTICATED,
            code
        })
    }
}

export {
    UnauthenticatedError,
};
```

`backend/src/errors/internalServer.error.js` — 500, an unexpected failure that isn't the caller's
fault, as opposed to the anticipated 4xx errors above:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { AppError } from "./app.error.js";

/**
 * 500 Internal Server Error — an unexpected failure that isn't the caller's
 * fault, as opposed to the anticipated 4xx errors elsewhere in this folder.
 *
 * @extends AppError
 */
class InternalServerError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Internal server error"] - Human-readable error message.
     * @param {string} [options.code] - Optional machine-readable error code.
     */
    constructor({
        message = "Internal server error",
        code,
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            code,
        })
    }
}

export { InternalServerError };
```

**Two more small things worth getting right, since they're easy to get wrong silently:** make sure
the *constructor* is spelled `constructor`, not `constrcutor` or any other typo — JavaScript
doesn't recognize a misspelled one as *the* constructor at all, so it silently becomes a regular
method that never runs, and `new InternalServerError({ message: "x" })` ends up calling the
default constructor instead (your `message`/`code` are discarded, no error, no warning). And make
sure every field you destructure out of `options` — especially `code` — actually gets passed into
the `super({...})` call; destructuring `code` and then forgetting to forward it is an easy way to
have `error.code` silently be `undefined` no matter what the caller passed in.

**Why bother with a whole class per status code**, instead of one generic
`new AppError({statusCode: 404, ...})` everywhere? Two reasons: `throw new NotFoundError({...})`
reads clearly at the call site (no magic number to look up), and it gives you one obvious place
to add error-specific behavior later if you ever need it.

### Step 2d — Tie them together

Create `backend/src/errors/index.js` so other files can import several at once instead of reaching
into individual files:

```javascript
/**
 * Barrel file re-exporting every typed application error so callers can
 * `import { NotFoundError, ConflictError } from "../errors/index.js"`
 * instead of reaching into individual files.
 */
export { AppError } from "./app.error.js";
export { BadRequestError } from "./badRequest.error.js";
export { NotFoundError } from "./notFound.error.js";
export { UnauthenticatedError } from "./unauthenticated.error.js";
export { ForbiddenError } from "./forbidden.error.js";
export { ConflictError } from "./conflict.error.js";
export { InternalServerError } from "./internalServer.error.js";
```

**Demonstration:** in a scratch file (or your terminal via `node`), import a couple of these and
construct them to confirm each one carries the right status code and message:

```javascript
import { NotFoundError, ConflictError } from "./backend/src/errors/index.js";

const notFound = new NotFoundError();
console.log(notFound.statusCode, notFound.message); // 404 "Not found error"

const conflict = new ConflictError({ code: "DUPLICATE_EMAIL" });
console.log(conflict.statusCode, conflict.code); // 409 "DUPLICATE_EMAIL"
```

## Step 3 — Stop wrapping every route in try/catch

Express doesn't automatically catch errors thrown inside an `async` route handler — an unhandled
rejection there crashes silently or hangs the request. Wrapping every single controller in its own
`try { ... } catch (error) { next(error) }` works, but gets repetitive fast.

Create `backend/src/utils/asyncHandler.js`:

```javascript
/**
 * Wraps an async Express route handler so a rejected promise is forwarded
 * to `next(error)` instead of crashing the process or hanging the request —
 * Express doesn't catch async rejections on its own.
 *
 * @param {Function} fn - An async (or promise-returning) Express route handler.
 * @returns {Function} A new handler with the same signature that catches rejections automatically.
 */
const asyncHandler = (fn) => (request, response, next) => {
    return Promise.resolve(fn(request, response, next)).catch(next);
}

export { asyncHandler };
```

**What this does:** it's a wrapper function — you hand it your `async` route handler, and it
gives you back a *new* function that runs your handler and automatically forwards any rejected
promise to `next(error)`. Every controller you write from here on gets wrapped in it:

```javascript
const getSomething = asyncHandler(async (request, response) => {
    const thing = await someServiceCallThatMightThrow();
    return response.json(thing);
});
```

If `someServiceCallThatMightThrow()` throws, `asyncHandler` catches it and calls Express's
`next(error)` for you — no repeated try/catch boilerplate in every controller.

## Step 4 — One place that turns errors into responses

This is the payoff: a single Express **error-handling middleware** that every thrown error, from
anywhere in the app, eventually flows through. Create `backend/src/middlewares/errorHandler.middleware.js`:

```javascript
import { HTTP_STATUS } from "../constants/index.js";
import { config } from "../config/index.js";
import { systemLogger } from "../logger/pino.logger.js";


/**
 * Express error-handling middleware — must be registered last, after every
 * route and other middleware, and must keep exactly four parameters
 * `(error, request, response, next)` since Express identifies an error
 * handler by that arity alone.
 *
 * Logs the full error (real message, stack, and request context) via
 * `systemLogger` regardless of environment, then sends a JSON error
 * response instead of Express's default HTML error page: operational
 * errors (see the `errors/` classes) show their own message verbatim,
 * anything else falls back to a generic message so unexpected failures
 * don't leak internals to the client. The stack trace in that *response*
 * (as opposed to the log) is only included outside production.
 *
 * @param {Error & {statusCode?: number, code?: string, isOperational?: boolean}} error
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
const errorHandler = (error, request, response, next) => {
    if (response.headersSent) {
        return next(error);
    }

    const code = error.code;
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const isOperational = error.isOperational || false;

    systemLogger.error(
        {
            err: error,
            statusCode,
            isOperational,
            method: request.method,
            url: request.originalUrl,
        },
        "An error occurred during request processing"
    );

    return response.status(statusCode).json({
        success: false,
        message: isOperational ? error.message : "Something went wrong",
        code,
        stack: config.nodeEnv === "development" ?
            error.stack :
            "",
    })
}

export { errorHandler };
```

**What this does, and why each part matters:**

- Express recognizes this as an *error handler* specifically because it takes **four** arguments
  (`error, request, response, next`) instead of three. That's not a style choice — Express inspects
  the function's argument count to decide whether it's a normal middleware or an error handler.
  Get this wrong in a way that's easy to miss: keep all four parameter *names* in the right
  positions too. Express always calls an error handler as `(err, req, res, next)` — if you
  accidentally name the second and third parameters `response, request` instead of
  `request, response`, the code still runs (arity is still 4), but every `response.status(...)`
  call inside is actually running against the real *request* object, which has no `.status()`
  method — an easy mistake to make once you've written a few regular (3-argument) middlewares
  where the parameter order is `(request, response, next)`.
- `if (response.headersSent)` guards against double-responding — if a response already started
  streaming before the error happened, we can't send a fresh JSON error on top of it.
- `statusCode` falls back to `HTTP_STATUS.INTERNAL_SERVER_ERROR` (500) for anything that didn't
  come from one of Section 3's typed error classes — a raw `Error` thrown from deep inside a
  library, for instance, won't have a `.statusCode` at all.
- **The log call and the response body are two separate objects, deliberately.** `systemLogger.error(...)`
  gets the *real* error — `err: error` (pino's standard error serializer, which captures the message,
  stack, and error type), plus `statusCode`/`isOperational`/`method`/`url` for filtering logs later —
  and it logs that every time, in every environment. The response sent to the *client* is the
  client-safe version instead: message masked for anything that isn't `isOperational`, `stack`
  included only outside production. A common mistake here is logging the *client-safe* object
  instead of the real one — that quietly throws away the one piece of information (the real
  message and stack trace) you actually need to debug a production incident, replacing it with
  whatever generic message you decided was safe to show a stranger.
- **The `isOperational` check is the whole point of this section's error hierarchy.** In
  production, a `BadRequestError({message: "Email already exists"})` is safe to show the user
  verbatim — you wrote that message on purpose. A random, un-anticipated bug is *not* safe to show
  verbatim (it might leak a file path or a database detail), so anything that isn't
  `isOperational` gets a generic `"Something went wrong"` instead of its real message in the
  *response* — the log line right above it still has the truth.
- `stack` is only included in the JSON body outside production (`config.nodeEnv === "development"`)
  — handy while you're building the app, but not something you'd want a real client to ever see.
  This only applies to the response; the logged `err` always carries the full stack, since logs
  are internal and that's exactly where a stack trace belongs.

Wire it in at the very end of `app.js` (this is a preview — Section 5 builds the full app shell):

```javascript
import { errorHandler } from "./middlewares/errorHandler.middleware.js";

// ... all your routes go here ...

app.use(errorHandler); // must be LAST — Express only treats a 4-arg middleware as an error handler
```

## Checkpoint

Add a temporary throwing route to try this out:

```javascript
import { asyncHandler } from "./utils/asyncHandler.js";
import { NotFoundError } from "./errors/index.js";

app.get("/test-error", asyncHandler(async () => {
    throw new NotFoundError({ message: "This is a deliberate test error" });
}));
```

**Demonstration:** start the server, visit `http://localhost:4000/test-error`. You should get a
`404` status with a JSON body:

```json
{ "success": false, "message": "This is a deliberate test error", "stack": "NotFoundError: This is a deliberate test error\n    at ..." }
```

The `stack` field only shows up because you're running in development (`NODE_ENV=development`) —
in production it would be an empty string instead. Check your terminal too: you should see a
structured `systemLogger` error line with `method: "GET"`, `url: "/test-error"`, `statusCode: 404`,
and the real `err` details — that line logs the same way no matter what `NODE_ENV` is set to, since
it's for you, not the client. Delete the temporary route once you've confirmed it works.

---

Next: [Section 4 — The Base Model Pattern →](04-base-model-pattern.md)
