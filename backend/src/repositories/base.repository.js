import { NotFoundError } from "../errors/notfound.error.js";

/**
 * ---------------------------------------------------------
 * BASE REPOSITORY
 * ---------------------------------------------------------
 *
 * Purpose:
 * - Centralized data access layer
 * - Standardizes CRUD behavior
 * - Preserves Mongoose documents for auth flows
 */
class BaseRepository {
    constructor(model) {
        if (!model || typeof model !== "function" || !model.modelName) {
            throw new Error("A valid Mongoose model is required");
        }

        this.model = model;
        this.modelName = model.modelName;
    }

    /**
     * Transform lean documents (plain objects)
     */
    _transformLean(doc) {
        if (!doc) return doc;

        if (Array.isArray(doc)) {
            return doc.map((item) => this._transformLean(item));
        }

        const cleanDoc = { ...doc };

        if (cleanDoc._id && !cleanDoc.id) {
            cleanDoc.id = String(cleanDoc._id);
        }

        delete cleanDoc.__v;
        delete cleanDoc.__version;

        return cleanDoc;
    }

    /**
     * Preserve document (DO NOT convert toObject)
     */
    _normalizeDoc(doc) {
        if (!doc) return doc;

        if (Array.isArray(doc)) {
            return doc.map((item) => this._normalizeDoc(item));
        }

        if (typeof doc?.toObject === "function") {
            return doc; // ✅ KEEP DOCUMENT
        }

        return this._transformLean(doc);
    }

    /**
     * Apply query options safely
     */
    _applyQueryOptions(query, options = {}) {
        if (options.session) query.session(options.session);
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);

        if (options.lean === true) {
            query.lean();
        }

        return query;
    }

    async create(payload, options = {}) {
        const [doc] = await this.model.create([payload], options);
        return this._normalizeDoc(doc);
    }

    async insertMany(data, options = {}) {
        const docs = await this.model.insertMany(data, options);
        return this._normalizeDoc(docs);
    }

    async findById(id, options = {}) {
        const query = this.model.findById(id);

        this._applyQueryOptions(query, options);

        const doc = await query;

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} with id ${id} not found`,
            });
        }

        return options.lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    async findOne(filter, options = {}) {
        const query = this.model.findOne(filter);

        this._applyQueryOptions(query, options);

        const doc = await query;

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} not found`,
            });
        }

        return options.lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    async findAll(filter = {}, options = {}) {
        const rawPage = Number(options.page ?? 1);
        const rawLimit = Number(options.limit ?? 20);

        const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;

        const {
            sort = { createdAt: -1 },
            select = "",
            populate = "",
            lean = true,
            session,
        } = options;

        const cappedLimit = Math.min(limit, 100);
        const skip = (page - 1) * cappedLimit;

        const findQuery = this.model
            .find(filter)
            .sort(sort)
            .select(select)
            .populate(populate)
            .skip(skip)
            .limit(cappedLimit);

        if (lean === true) findQuery.lean();
        if (session) findQuery.session(session);

        const countQuery = this.model.countDocuments(filter);
        if (session) countQuery.session(session);

        const [docs, total] = await Promise.all([findQuery, countQuery]);

        return {
            docs: lean === true
                ? this._transformLean(docs)
                : this._normalizeDoc(docs),
            total,
            page,
            limit: cappedLimit,
            totalPages: total === 0 ? 0 : Math.ceil(total / cappedLimit),
        };
    }

    async updateById(id, data, options = {}) {
        const { session, populate, select, lean = false } = options;

        const query = this.model.findByIdAndUpdate(
            id,
            { $set: data },
            {
                new: true,
                runValidators: true,
                session,
            }
        );

        if (populate) query.populate(populate);
        if (select) query.select(select);
        if (lean === true) query.lean();

        const doc = await query;

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} with id ${id} not found`,
            });
        }

        return lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    async deleteById(id, options = {}) {
        const doc = await this.model.findByIdAndDelete(id, options);

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} with id ${id} not found`,
            });
        }

        return this._normalizeDoc(doc);
    }

    async deleteAll(filter = {}, options = {}) {
        return this.model.deleteMany(filter, options);
    }

    async exists(filter = {}, options = {}) {
        const query = this.model.exists(filter);

        if (options.session) query.session(options.session);

        return query;
    }

    async count(filter = {}, options = {}) {
        const query = this.model.countDocuments(filter);

        if (options.session) query.session(options.session);

        return query;
    }
}

export { BaseRepository };
export default BaseRepository;