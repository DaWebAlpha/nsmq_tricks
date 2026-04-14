import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { InternalServerError } from "../errors/internalserver.error.js";

const __dirname = dirname(fileURLToPath(import.meta.url));


const result = dotenv.config({ path: join(__dirname, "../../../.env") });

if (result.error) {
    throw new InternalServerError({
        message: "Failed to load environment file",
        details: result.error.message
    });
}

const {
    PORT,
    MONGO_URI,
    NODE_ENV,
    LOG_LEVEL,
} = process.env;

const configEnvs = {
    MONGO_URI,
};

for (const [key, value] of Object.entries(configEnvs)) {
    if (!value || typeof value !== "string") {
        throw new InternalServerError({
            message: "Internal Server Error",
            details: `Missing .env variable ${key}`
        });
    }
}

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number(fallback);
};

const config = {
    port: toNumber(PORT, 4000),
    mongo_uri: MONGO_URI,
    node_env: NODE_ENV || 'development',
    log_level: LOG_LEVEL || 'info',
};

/* console.log({
    PORT: config.port,
    MONGO_URI: config.mongo_uri,
    NODE_ENV: config.node_env,
    LOG_LEVEL: config.log_level,
}); */

export { config };
export default config;