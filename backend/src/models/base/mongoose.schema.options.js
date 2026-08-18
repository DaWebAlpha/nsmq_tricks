import { SENSITIVE_FIELDS } from "../../constants/index.js";
import { config } from "../../config/index.js";

/**
 * toJSON/toObject transform for mongoose schemas: replaces _id with a
 * string id, strips the version key and SENSITIVE_FIELDS, and drops
 * null/undefined/empty-string values so serialized documents stay clean
 * for clients.
 * @param {import("mongoose").Document} _document - The original Mongoose document (unused).
 * @param {object} returnedObject - The plain object being serialized; mutated and returned.
 * @returns {object} The cleaned plain object.
 */
const transformDocument = (_document, returnedObject) => {
    if(returnedObject._id){
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
    }

    delete returnedObject.__v;

    for(const field of SENSITIVE_FIELDS){
        delete returnedObject[field];
    }

    for (const key in returnedObject){
        if(
            returnedObject[key] === null ||
            returnedObject[key] === undefined ||
            returnedObject[key] === ""
        ){
            delete returnedObject[key]
        }
    }

    return returnedObject;
}

/**
 * Shared toJSON/toObject config: include virtuals/getters, apply transformDocument.
 * Keeps `getters: true` (deedew omits it) since nsmq's models rely on it.
 */
const serializationOptions = Object.freeze({
    virtuals: true,
    getters: true,
    transform: transformDocument,
})

/**
 * Common mongoose schema options to spread into every model, e.g.
 * `new mongoose.Schema({ ... }, mongooseSchemaOptions)`. Adds timestamps,
 * strict field/query enforcement, optimistic concurrency control, and
 * consistent client-facing serialization via serializationOptions.
 * Keeps `id: true` and env-gated `autoIndex` (nsmq-specific, deedew
 * uses `id: false` and sets autoIndex at the connection level instead).
 */
const mongooseSchemaOptions = Object.freeze({
    timestamps: true,
    strict: true,
    strictQuery: true,
    minimize: false,
    id: true,
    optimisticConcurrency: true,
    autoIndex: config.nodeEnv === "development",
    toJSON: serializationOptions,
    toObject: serializationOptions,
})

export { mongooseSchemaOptions, transformDocument };
