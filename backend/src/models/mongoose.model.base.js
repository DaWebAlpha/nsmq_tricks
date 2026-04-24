import mongoose from "mongoose";
import { baseOptions } from "./base.options.js";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { BadRequestError } from "../errors/badrequest.error.js";

/**
 * ---------------------------------------------------------
 * DOMPURIFY SETUP (SERVER-SIDE)
 * ---------------------------------------------------------
 */
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * ---------------------------------------------------------
 * BASE FIELDS (AUDIT + SOFT DELETE)
 * ---------------------------------------------------------
 */
const baseFields = {
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
        default: null,
    },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true,
    },

    deletedAt: {
        type: Date,
        default: null,
        index: true,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
        default: null,
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
};

const DEFAULT_MAX_LIMIT = 100;
const SANITIZE_EXCLUDED_PATHS = new Set([
    "password",
    "token",
    "tokenHash",
    "refreshToken",
    "accessToken",
]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const sanitizeString = (value) => {
    if (typeof value !== "string") return value;

    return DOMPurify.sanitize(value.normalize("NFC")).trim();
};

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
 * ---------------------------------------------------------
 * CREATE BASE MODEL FACTORY
 * ---------------------------------------------------------
 */
const createBaseModel = (name, schemaDefinition = {}, configCallback = null) => {
    if (typeof name !== "string" || name.trim().length === 0) {
        throw new BadRequestError({
            message: "Model name must be a non-empty string",
        });
    }

    if (
        !schemaDefinition ||
        typeof schemaDefinition !== "object" ||
        Array.isArray(schemaDefinition)
    ) {
        throw new BadRequestError({
            message: "Schema definition must be a valid object",
        });
    }

    if (configCallback != null && typeof configCallback !== "function") {
        throw new BadRequestError({
            message: "configCallback must be a function when provided",
        });
    }

    const schema = new mongoose.Schema(
        {
            ...schemaDefinition,
            ...baseFields,
        },
        baseOptions
    );

    /**
     * -----------------------------------------------------
     * PRE-VALIDATE HOOK (INPUT SANITIZATION)
     * -----------------------------------------------------
     *
     * Sanitizes only modified top-level string fields, and excludes
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
     * -----------------------------------------------------
     * GLOBAL FIND FILTER (SOFT DELETE)
     * -----------------------------------------------------
     */
    schema.pre(/^find/, function () {
        const query = this.getQuery();

        if (!hasOwn(query, "isDeleted")) {
            this.where({ isDeleted: false });
        }
    });

    /**
     * -----------------------------------------------------
     * AGGREGATION SOFT DELETE FILTER
     * -----------------------------------------------------
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
     * -----------------------------------------------------
     * INSTANCE METHOD: SOFT DELETE
     * -----------------------------------------------------
     */
    schema.methods.softDelete = function (userId = null) {
        this.isDeleted = true;
        this.deletedBy = userId;
        this.deletedAt = new Date();

        return this.save({ validateBeforeSave: false });
    };

    /**
     * -----------------------------------------------------
     * INSTANCE METHOD: RESTORE
     * -----------------------------------------------------
     */
    schema.methods.restoreDelete = function (userId = null) {
        this.deletedBy = null;
        this.isDeleted = false;
        this.deletedAt = null;
        this.updatedBy = userId;

        return this.save({ validateBeforeSave: false });
    };

    /**
     * -----------------------------------------------------
     * INSTANCE METHOD: HARD DELETE
     * -----------------------------------------------------
     */
    schema.methods.hardDelete = function () {
        return this.deleteOne();
    };

    /**
     * -----------------------------------------------------
     * STATIC METHOD: PAGINATION
     * -----------------------------------------------------
     */
    schema.statics.paginate = async function (
        filter = {},
        page = 1,
        limit = 20,
        projections = {},
        options = {}
    ) {
        const safePage = Math.max(1, Number(page) || 1);
        const requestedLimit = Math.max(1, Number(limit) || 20);
        const safeLimit = Math.min(requestedLimit, options.maxLimit || DEFAULT_MAX_LIMIT);
        const skip = (safePage - 1) * safeLimit;

        const finalFilter = hasOwn(filter, "isDeleted")
            ? filter
            : { ...filter, isDeleted: false };

        let query = this.find(finalFilter, projections, {
            sort: options.sort || {},
            session: options.session,
        })
            .skip(skip)
            .limit(safeLimit);

        if (options.select) {
            query = query.select(options.select);
        }

        if (options.populate) {
            if (Array.isArray(options.populate)) {
                for (const item of options.populate) {
                    query = query.populate(item);
                }
            } else {
                query = query.populate(options.populate);
            }
        }

        if (options.lean !== false) {
            query = query.lean();
        }

        const [data, total] = await Promise.all([
            query.exec(),
            this.countDocuments(finalFilter).session(options.session || null),
        ]);

        return {
            data,
            page: safePage,
            limit: safeLimit,
            total,
            total_pages: Math.ceil(total / safeLimit),
            has_next_page: safePage * safeLimit < total,
            has_prev_page: safePage > 1,
        };
    };

    if (typeof configCallback === "function") {
        configCallback(schema);
    }

    return mongoose.models[name] || mongoose.model(name, schema);
};

export { createBaseModel, baseFields, sanitizeString };
export default createBaseModel;