import { config } from "../config/config.js";

/**
 * ---------------------------------------------------------
 * SECURITY TRANSFORM
 * ---------------------------------------------------------
 *
 * Purpose:
 * - Normalize API output
 * - Remove sensitive/internal fields
 * - Ensure consistent structure across all models
 */
const SENSITIVE_FIELDS = new Set([
    "password",
    "__v",
    "__version",
    "token",
    "tokenHash",
]);

const securityTransform = (_doc, ret) => {
    /**
     * Safety guard (important for lean / edge cases)
     */
    if (!ret || typeof ret !== "object") return ret;

    /**
     * Convert _id → id (string)
     */
    if (ret._id != null) {
        try {
            ret.id = ret._id.toString();
        } catch {
            ret.id = String(ret._id);
        }
    }

    /**
     * Remove _id completely (clean API output)
     */
    delete ret._id;

    /**
     * Remove sensitive/internal fields
     */
    for (const field of SENSITIVE_FIELDS) {
        if (field in ret) {
            delete ret[field];
        }
    }

    return ret;
};

/**
 * ---------------------------------------------------------
 * BASE SCHEMA OPTIONS
 * ---------------------------------------------------------
 *
 * Purpose:
 * - Enforce consistency across all models
 * - Improve security and reliability
 */
const baseOptions = {
    strict: true,
    strictQuery: true,
    timestamps: true,

    /**
     * Disable autoIndex in production
     */
    autoIndex: config.NODE_ENV === "development",

    /**
     * JSON output (API responses)
     */
    toJSON: {
        virtuals: true,
        getters: true,
        transform: securityTransform,
    },

    /**
     * Object output (internal usage)
     */
    toObject: {
        virtuals: true,
        getters: true,
        transform: securityTransform,
    },

    /**
     * Enables virtual id getter
     */
    id: true,
};

export { baseOptions, securityTransform };
export default baseOptions;