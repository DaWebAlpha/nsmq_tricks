import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config/config.js";


/**
 * Environment and Logging Level Configuration
 */
const isDevelopment = config.node_env === "development";
const logLevel = isDevelopment ? "debug" : "info";


/**
 * Ensure the logs directory exists at the project root
 */

const logDirectory = "./logs"

if(!fs.existsSync(logDirectory)){
    fs.mkdirSync(logDirectory, {recursive: true});
}


/**
 * Blueprint for log rotation configuration (Pino-Roll)
 * @param {string} fileLocation - Sub-path within the logs folder
 * @param {string} frequency - How often to rotate (daily/hourly)
 * @param {string} fileSize - Max size before rotation (e.g., '20m')
 * @param {string} minLevel - Minimum log level for this transport
 */

const bluePrint = (fileLocation, frequency, fileSize, minLevel = 'info', daysToDelete) => ({
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
            count: daysToDelete,
        }

    }
})




/*

|--------------------------------------------------------------------------
| DEV TERMINAL PRETTY PRINT
|--------------------------------------------------------------------------

| In development, we format JSON logs into a human-readable, colorized output.
*/

const terminalTargets = isDevelopment
    ? [
        {
            target: "pino-pretty",
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
            }
        }
    ]: [];


const systemTransport = pino.transport({
    targets:[
        bluePrint("system/app-info", "daily", "20m", "info", 90),
        bluePrint("system/app-error", "daily", "20m", "error", 90),
        ...terminalTargets,
    ]
})

const auditTransport = pino.transport({
    targets: [
        bluePrint("audit/app-audit", "daily", "20m", "info", 180),
        ...terminalTargets,
    ]
})

const accessTransport = pino.transport({
    targets: [
        bluePrint("access/app-access", "daily", "20m", "info", 180),
        ...terminalTargets
    ]
})



/*
|--------------------------------------------------------------------------
| BASE LOGGER CONFIGURATION
|--------------------------------------------------------------------------
| Shared settings for all loggers including security redaction.
*/
const getBaseConfig = () => ({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive data from logs to ensure security compliance
    redact: {
        paths: [
            'password',
            '*.password',
            'token',
            '*.token',
            'access_token',
            'refresh_token',
            '*.access_token',
            '*.refresh_token',
            'apiKey',
            '*.apiKey',
            'req.headers.authorization',
            'req.headers.cookie'
        ],
        remove: true // Completely remove these fields from the log object
    },
    // Map numerical levels to human-readable labels
    mixin(_context, levelNumber) {
        const labels = {
            10: 'trace',
            20: 'debug',
            30: 'info',
            40: 'warn',
            50: 'error',
            60: 'fatal'
        };

        return {
            level_label: labels[levelNumber] || 'info'
        };
    }
});


export const system_logger = pino(getBaseConfig(), systemTransport);
export const audit_logger = pino(getBaseConfig(), auditTransport);
export const access_logger = pino(getBaseConfig(), accessTransport);

export default {
    system_logger,
    audit_logger,
    access_logger
};
