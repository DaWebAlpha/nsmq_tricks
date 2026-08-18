import dotenv from "dotenv";

dotenv.config();

const {
    PORT,
    MONGO_URI,
    NODE_ENV,
    LOG_LEVEL,
    JWT_ACCESS_SECRET,
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    SUBSCRIPTION_EXPIRY_TIME,
} = process.env;

const requiredEnvVars = [
    "MONGO_URI",
    "JWT_ACCESS_SECRET",
    "ACCESS_TOKEN_COOKIE_NAME",
    "REFRESH_TOKEN_COOKIE_NAME",
];

for(const key of requiredEnvVars){
    if(!process.env[key]){
        throw new Error(`Missing required env: ${key}`)
    }
}

if(JWT_ACCESS_SECRET.length < 32){
    throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}

const toNumber = (value, fallback) => {
    if(!value){
        return fallback
    }

    const validNumber = Number(value);

    return Number.isFinite(validNumber) &&
           validNumber > 0 ?
           validNumber : fallback;

}

const allowedNodeEnvs = ["development", "test", "production"];
const resolvedNodeEnv = allowedNodeEnvs.includes(NODE_ENV) ?
                        NODE_ENV :
                        "development";

const allowedLogLevels = ["fatal", "error", "warn", "info", "debug", "trace"];
const resolvedLogLevel = allowedLogLevels.includes(LOG_LEVEL) ?
                        LOG_LEVEL :
                        "info";


const config = Object.freeze({
    mongoUri: MONGO_URI,
    port: toNumber(PORT, 4000),
    nodeEnv: resolvedNodeEnv,
    logLevel: resolvedLogLevel,

    jwtAccessSecret: JWT_ACCESS_SECRET,
    accessTokenCookieName: ACCESS_TOKEN_COOKIE_NAME,
    refreshTokenCookieName: REFRESH_TOKEN_COOKIE_NAME,

    subscriptionExpiryTime: toNumber(SUBSCRIPTION_EXPIRY_TIME, 60 * 24 * 365 * 60000), // one year in ms
})

export { config };
