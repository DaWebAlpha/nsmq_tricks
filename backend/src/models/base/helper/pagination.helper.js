const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_LIMIT = 100;

/**
 * Safe own-property check, immune to a missing/shadowed hasOwnProperty on object.
 * @param {object} object - Object to check.
 * @param {string} key - Property name to look for.
 * @returns {boolean}
 */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Defaults every paginated read to isDeleted: false — the single place
 * this rule is enforced, instead of every list service having to remember
 * it. A caller that genuinely wants deleted documents (an admin "trash"
 * view) opts out by passing isDeleted explicitly in `filter`.
 * @param {object} options
 * @param {import("mongoose").Model} options.model - The Mongoose model to query.
 * @param {object} [options.filter={}] - Extra query conditions.
 * @param {object|string|null} [options.projection=null] - Fields to select.
 * @param {number} [options.page=1] - 1-indexed page number.
 * @param {number} [options.limit=DEFAULT_PAGE_SIZE] - Page size, clamped to DEFAULT_MAX_LIMIT.
 * @param {object} [options.options={}] - sort/populate/lean plus any raw Mongoose query options.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<{data: object[], page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean}>}
 */
const paginateCollection = async ({
    model,
    filter = {},
    projection = null,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    options = {},
    session = null,
} = {}) => {
    const safePage = Math.max(1, Number(page) || 1);

    const requestedLimit = Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE);
    const safeLimit = Math.min(requestedLimit, DEFAULT_MAX_LIMIT);

    const skip = (safePage - 1) * safeLimit;

    const finalFilter = hasOwn(filter, "isDeleted")
        ? filter
        : { ...filter, isDeleted: false };

    const { sort, populate, lean, ...queryOptions } = options;

    let query = model.find(finalFilter, projection).setOptions(queryOptions);

    if (session) {
        query = query.session(session);
    }

    if (sort) {
        query = query.sort(sort);
    }

    query = query.skip(skip).limit(safeLimit);

    if (populate) {
        query = query.populate(populate);
    }

    /**
     * Opt-in, not opt-out. .lean() bypasses toJSON entirely, so a
     * caller has to explicitly confirm a model has nothing to hide
     * before asking for the faster path.
     */
    if (lean === true) {
        query = query.lean();
    }

    let countQuery = model.countDocuments(finalFilter);

    if (session) {
        countQuery = countQuery.session(session);
    }

    const [data, total] = await Promise.all([
        query.exec(),
        countQuery.exec(),
    ]);

    return {
        data,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPreviousPage: safePage > 1,
    };
};

export { paginateCollection, DEFAULT_PAGE_SIZE, DEFAULT_MAX_LIMIT };
