# Section 2 — Config & Database Connection

[← Back to index](../README.md) · Previous: [Project Setup](01-project-setup.md) · Next: [Logging & Error Handling →](03-logging-and-error-handling.md)

## Why

Your app needs settings that differ between your laptop and a real server: which database to
connect to, which port to run on, what "mode" it's in. Scattering `process.env.SOMETHING` calls
through 50 different files makes it impossible to know, at a glance, what settings your app
actually needs — and a typo in an env var name fails silently instead of loudly.

The fix: **one file** that reads every environment variable once, validates it, and exports a
single frozen `config` object that the rest of the app imports.

## Step 1 — Get a MongoDB connection string

If you don't already have one: create a free account at
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas), create a free "M0" cluster, create a
database user (username + password), and click "Connect → Drivers" to copy a connection string.
It looks like:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/nsmq_tricks?retryWrites=true&w=majority
```

Add it to your `.env` file from Section 1:

```
PORT=4000
MONGO_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/nsmq_tricks?retryWrites=true&w=majority
NODE_ENV=development
LOG_LEVEL=debug
LOG_DIRECTORY=logs
SERVICE=nsmq_tricks
```

## Step 2 — Centralize config reading

Create `backend/src/config/index.js`:

```javascript
/**
 * Reads and validates every environment variable the app needs, once, and
 * exports a single frozen `config` object — the rest of the app imports
 * this instead of reading `process.env` directly.
 */

import dotenv from "dotenv";

dotenv.config();

const {
    PORT,
    MONGO_URI,
    NODE_ENV,
    LOG_LEVEL,
    LOG_DIRECTORY,
    SERVICE,
} = process.env;

const requiredEnvs = {
    MONGO_URI,
}

for (const [key, value] of Object.entries(requiredEnvs)){
    if(typeof value !== "string" ||
        value.trim() === "" ||
        !value
    ){
        throw new Error(
          `Missing .env value: ${key}`  
        )
    }
}

/**
 * Coerces a raw (always-string) env var into a positive number.
 * @param {string|undefined} value - The raw env var value.
 * @param {number} fallback - Value to use if `value` is missing or not a positive finite number.
 * @returns {number}
 */
const toNumber = (value, fallback) => {
    if(!value){
        return fallback;
    }

    const validNumber = Number(value);

    return Number.isFinite(validNumber) &&
           validNumber > 0 ?
           validNumber : 
           fallback
}


const allowedNodeEnvs = [
    "development", 
    "test", 
    "production"
];

const resolvedNodeEnvs = allowedNodeEnvs.includes(NODE_ENV) ? 
                         NODE_ENV : "development";

const allowedLogLevels = [ 
    "trace",
    "debug",
    "info",
    "warn",
    "error",
    "fatal",
    ];

const resolvedLogLevels = allowedLogLevels
                          .includes(LOG_LEVEL) ?
                          LOG_LEVEL : "info";


/**
 * The app's single source of truth for runtime settings. Frozen so no
 * other file can accidentally mutate shared config at runtime.
 * @property {number} port
 * @property {string} mongoUri
 * @property {"development"|"test"|"production"} nodeEnv
 * @property {"trace"|"debug"|"info"|"warn"|"error"|"fatal"} logLevel
 * @property {string} logDirectory
 * @property {string|undefined} service
 */
const config = Object.freeze({
    port: toNumber(PORT, 4000),
    mongoUri: MONGO_URI,
    nodeEnv: resolvedNodeEnvs,
    logLevel: resolvedLogLevels,
    logDirectory: LOG_DIRECTORY || "logs",
    service: SERVICE,
})


export {
    config,
}
```

**What this does, piece by piece:**

- `dotenv.config()` reads your `.env` file and copies its values into `process.env`, Node's
  built-in bag of environment variables. This must run before anything else touches `process.env`.
- The `requiredEnvVars` loop **fails loudly, on startup**, if something essential is missing.
  This is deliberate: better to crash immediately with `Missing required env: MONGO_URI` than to
  start the server and have it mysteriously fail the first time someone tries to log in.
- `toNumber` converts a string env var (env vars are *always* strings, even `"4000"`) into an
  actual number, falling back to a sane default if it's missing or garbage.
- `allowedNodeEnvs`/`allowedLogLevels` are **allow-lists** — if someone sets `NODE_ENV=oops`, we
  silently fall back to `"development"` rather than letting a typo change app behavior in a
  confusing way.
- `Object.freeze(...)` makes the returned object read-only. If some other file accidentally tries
  `config.port = 9999`, that assignment silently fails (or throws, in strict mode) instead of
  quietly corrupting shared config that every other file relies on.
- `logDirectory: LOG_DIRECTORY || "logs"` degrades the same way `toNumber` does for `port` — if
  that var is ever missing, later code that builds file paths out of it (Section 3's logger) gets
  a safe default instead of crashing on startup.
- `service` is just passed through as-is. It doesn't need validating or a fallback here — it's a
  label, not something the app's behavior depends on — but centralizing it means the logger you'll
  build in Section 3 can tag every log line with which service emitted it, without reading
  `process.env` a second time.

**Why one object instead of many exports:** every other file in the app does
`import { config } from "../config/index.js"` and then reads `config.mongoUri`, `config.port`,
etc. — one import, one consistent name, and your editor can autocomplete every available setting.

## Step 3 — Connect to MongoDB

Create `backend/src/constants/mongoose.options.js`:

```javascript
/**
 * Options passed as the second argument to `mongoose.connect(...)` —
 * connection-pool sizing and timeouts, kept separate from connection logic
 * so they can be tuned or reused without touching `database.js`.
 */
const MONGOOSE_OPTIONS = Object.freeze({
    minPoolSize: 5,
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})

export {
    MONGOOSE_OPTIONS
}
```

Create `backend/src/constants/index.js`:

```javascript
export { MONGOOSE_OPTIONS } from "./mongoose.options.js";
```

Create `backend/src/config/database.js`:

```javascript
import mongoose from "mongoose";
import { config } from "./index.js";
import { MONGOOSE_OPTIONS } from "../constants/index.js";

const connectDatabase = async () => {
    try {
        await mongoose.connect(
            config.mongoUri,
            MONGOOSE_OPTIONS
        );
    } catch (error) {
        console.error({ err: error }, "Database connection error");
        throw error;
    }
};

mongoose.connection.on("connected", () => {
    console.log("Database has been connected");
});

mongoose.connection.on("disconnected", () => {
    console.warn("Database has been disconnected");
});

mongoose.connection.on("error", (err) => {
    console.error({ err }, "Database connection error");
});

export { connectDatabase };
```

**What this does:**

- `mongoose.connect(uri, options)` opens the connection. It's `async` because connecting over the
  network takes real time — your server shouldn't start accepting requests before the database is
  ready to answer them. `MONGOOSE_OPTIONS`, from the file you just created, is passed straight
  through as the second argument — it's kept in its own constants file (rather than inlined here)
  so connection-pool tuning stays separate from connection *logic*, and so any other file that
  needs those same options later doesn't have to duplicate them.
- The `try/catch` around the initial `connect(...)` call logs the failure and then `throw error`s
  the *original* error back out — it doesn't swallow it, and it doesn't invent a new one. Whatever
  called `connectDatabase()` (Step 4, below) decides what to do next; this function's only job is
  to make sure the failure is never silent.
- `mongoose.connection.on("connected"/"disconnected"/"error", ...)` are event listeners — Mongoose
  keeps a single persistent connection open behind the scenes, and network hiccups happen *after*
  the initial connect too. These listeners make sure you *hear about it* in your logs instead of
  your app silently failing every query. Note that the `"error"` handler's callback parameter is
  named `err`, not `error` — a common typo here is logging a variable named `error` that was never
  actually declared in that callback's scope, which throws instead of logging.

**Why this lives in its own file, separate from `config/index.js`:** `config/index.js` is *pure*
— it just reads and validates settings, no side effects. `database.js` *does something* (opens a
network connection). Keeping "read config" and "act on config" separate means you can import
`config` anywhere safely, without accidentally triggering a database connection just by importing
a file.

## Step 4 — Wire it into server startup

Update `backend/src/server.js` from Section 1:

```javascript
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { config } from "./config/index.js";


const startServer = async() => {
    try{
        await connectDatabase();

        const server = app.listen(config.port, () => {
            console.log(`Listening on port: ${config.port}`);
        })
    }catch(error){
        console.error({err: error}, "Server connection error");
        process.exit(1);
    }
}

startServer()
```

**What changed and why:** we now `await connectDatabase()` **before** calling `app.listen(...)`.
If the database connection fails, `connectDatabase()` throws, the `catch` block logs it, and we
`process.exit(1)` — the server never starts accepting requests it couldn't actually serve
correctly. This ordering matters: a server that "starts" but can't reach its database is worse
than one that fails to start at all, because it *looks* healthy from the outside. Notice
`config.port` is read directly wherever it's needed rather than copied into a local `PORT`
constant — one source of truth, no risk of the two drifting apart.

## Checkpoint — run it

```bash
npm run dev
```

**Demonstration:** you should see, in order:

```
Database has been connected
Listening on port: 4000
```

Try it broken on purpose: temporarily change one character in `MONGO_URI` in your `.env` file and
restart. You should see a `"Database connection error"` log from `database.js`, then a
`"Server connection error"` log from `server.js`, and the process should exit — **not** start
"successfully" with a broken database underneath it. Then put the correct value back.

---

Next: [Section 3 — Logging & Error Handling →](03-logging-and-error-handling.md)
