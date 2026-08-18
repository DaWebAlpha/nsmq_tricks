import mongoose from "mongoose";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { auditFields } from "./auditFields.js";
import { mongooseSchemaOptions } from "./mongoose.schema.options.js";
import {
    softDeleteDocument,
    restoreDocument,
    paginateCollection
} from "./helper/index.js";

/**
 * ---------------------------------------------------------
 * DOMPURIFY SETUP (SERVER-SIDE) — nsmq-only, deedew has no equivalent
 * ---------------------------------------------------------
 */
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * Field names the pre-validate sanitize hook must never touch, even though
 * they're String-typed — running DOMPurify/normalize/trim on a password
 * hash or a token would corrupt it.
 */
const SANITIZE_EXCLUDED_PATHS = new Set([
    "password",
    "token",
    "tokenHash",
    "refreshToken",
    "accessToken",
]);

/**
 * Safe own-property check, immune to a missing/shadowed hasOwnProperty on object.
 * @param {object} object - Object to check.
 * @param {string} key - Property name to look for.
 * @returns {boolean}
 */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Runs a string through DOMPurify (stripping HTML/script content), then
 * Unicode-normalizes and trims it. Non-string input is returned unchanged
 * rather than coerced, so a caller can run this over any field's value
 * without first checking its type.
 * @param {*} value - The value to sanitize.
 * @returns {*} The sanitized string, or `value` unchanged if it wasn't a string.
 */
const sanitizeString = (value) => {
    if (typeof value !== "string") return value;

    return DOMPurify.sanitize(value.normalize("NFC")).trim();
};

/**
 * Prepends a `$match: { isDeleted: false }` stage to an aggregation
 * pipeline for the global soft-delete filter, respecting MongoDB's
 * requirement that `$geoNear`/`$search`/`$vectorSearch` stay first when
 * present.
 * @param {object[]} [pipeline] - The aggregation pipeline stages.
 * @returns {object[]} The pipeline with the soft-delete match stage inserted.
 */
const appendSoftDeleteMatchStage = (pipeline = []) => {
    if (!Array.isArray(pipeline)) return pipeline;

    const firstStage = pipeline[0] || {};
    const firstStageOperator = Object.keys(firstStage)[0];

    /**
     * Preserve pipeline semantics for operators that must remain first.
     */
    const mustRemainFirst = new Set(["$geoNear", "$search", "$vectorSearch"]);

    if (mustRemainFirst.has(firstStageOperator)) {
        const matchStage = { $match: { isDeleted: false } };
        return [firstStage, matchStage, ...pipeline.slice(1)];
    }

    return [{ $match: { isDeleted: false } }, ...pipeline];
};

/**
 * Builds a mongoose Schema pre-wired with audit fields, the shared
 * serialization/consistency options, and soft-delete/restore/pagination
 * instance and static methods — mirroring deedew's createSchema exactly.
 * Also layers in two nsmq-only behaviors deedew has no equivalent for:
 * server-side DOMPurify sanitization of modified string fields on
 * pre-validate, and a global find/aggregate filter that hides
 * soft-deleted documents unless a query explicitly opts in via `isDeleted`.
 * @param {object} schemaDefinition - The model's own field definitions.
 * @param {object} [options] - Extra schema options, merged over mongooseSchemaOptions.
 * @returns {import("mongoose").Schema}
 */
const createSchema = (schemaDefinition, options = {}) => {
    const schema = new mongoose.Schema(
        {
            ...schemaDefinition,
            ...auditFields
        },
        {
            ...mongooseSchemaOptions,
            ...options
        }
    )

    /**
     * Sanitizes only modified top-level string fields, excluding
     * sensitive/auth fields that must never be transformed.
     */
    schema.pre("validate", function () {
        for (const path of this.modifiedPaths()) {
            if (path.includes(".") || SANITIZE_EXCLUDED_PATHS.has(path)) {
                continue;
            }

            const schemaPath = this.schema.path(path);
            if (!schemaPath || schemaPath.instance !== "String") {
                continue;
            }

            const value = this.get(path);
            if (typeof value === "string") {
                this.set(path, sanitizeString(value));
            }
        }
    });

    /**
     * Global find filter: hides soft-deleted documents unless a query
     * explicitly opts in via `isDeleted`.
     */
    schema.pre(/^find/, function () {
        const query = this.getQuery();

        if (!hasOwn(query, "isDeleted")) {
            this.where({ isDeleted: false });
        }
    });

    /**
     * Global aggregation soft-delete filter, mirroring the find-query hook.
     */
    schema.pre("aggregate", function () {
        const pipeline = this.pipeline();
        const alreadyHandlesIsDeleted = pipeline.some(
            (stage) => stage?.$match && hasOwn(stage.$match, "isDeleted")
        );

        if (!alreadyHandlesIsDeleted) {
            this.pipeline().splice(0, this.pipeline().length, ...appendSoftDeleteMatchStage(pipeline));
        }
    });

    /**
     * Instance method: soft-deletes this document.
     * @see softDeleteDocument
     * @param {object} [options]
     * @param {string|import("mongoose").Types.ObjectId} [options.deletedByUserId] - User performing the deletion.
     * @param {string} [options.reason] - Optional justification for the deletion.
     * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
     * @returns {Promise<import("mongoose").Document>}
     */
    schema.methods.softDelete = function({
        deletedByUserId,
        reason,
        session
    } = {}){
        return softDeleteDocument({document: this, deletedByUserId, reason, session});
    }

    /**
     * Instance method: restores this soft-deleted document.
     * @see restoreDocument
     * @param {object} [options]
     * @param {string|import("mongoose").Types.ObjectId} [options.restoreUserId] - User performing the restore.
     * @param {string} [options.reason] - Optional justification for the restore.
     * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
     * @returns {Promise<import("mongoose").Document>}
     */
    schema.methods.restore = function ({ restoreUserId, reason, session = null } = {}) {
        return restoreDocument({ document: this, restoreUserId, reason, session });
    };

    /**
     * Static method: paginates this model's collection.
     * @see paginateCollection
     * @param {object} [params] - Same options as paginateCollection, minus `model`.
     * @returns {Promise<object>}
     */
    schema.statics.paginate = function (params = {}) {
        return paginateCollection({ model: this, ...params });
    };

    return schema;
}

export { createSchema, sanitizeString };
