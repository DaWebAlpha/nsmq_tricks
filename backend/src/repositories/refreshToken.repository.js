import { BaseRepository } from "./base.repository.js";
import { system_logger } from "../core/pino.logger.js";
import { RefreshToken } from "../models/auth/refreshToken.model.js";

/**
 * ---------------------------------------------------------
 * REFRESH TOKEN REPOSITORY
 * ---------------------------------------------------------
 *
 * Responsibility:
 * Provides repository access for refresh token records and token-specific
 * lookup/revocation flows.
 */
class RefreshTokenRepository extends BaseRepository {
    constructor() {
        super(RefreshToken);
    }

    /**
     * ---------------------------------------------------------
     * APPLY COMMON QUERY MODIFIERS
     * ---------------------------------------------------------
     *
     * Supported Options:
     * - populate
     * - select
     * - session
     * - lean
     *
     * Notes:
     * - lean is applied only when explicitly requested
     */
    _applyQueryOptions(query, options = {}) {
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (options.session) query.session(options.session);
        if (options.lean === true) query.lean();

        return query;
    }

    /**
     * ---------------------------------------------------------
     * EXECUTE STATIC FINDER AND RETURN NULL WHEN NOT FOUND
     * ---------------------------------------------------------
     *
     * Purpose:
     * Executes a model static finder and normalizes the result when found.
     * Returns null instead of throwing when no record exists.
     *
     * @param {Object} params
     * @param {*} params.value
     * @param {Function} params.finder
     * @param {string} [params.logMessage="Active refresh token not found"]
     * @param {Object} [params.options={}]
     * @returns {Promise<Object|null>}
     */
    async _findOneOrNull({
        value,
        finder,
        logMessage = "Active refresh token not found",
        options = {},
    }) {
        if (typeof finder !== "function") {
            throw new TypeError("finder must be a function");
        }

        const query = finder.call(this.model, value);
        this._applyQueryOptions(query, options);

        const doc = await query;

        if (!doc) {
            system_logger.warn(
                {
                    model: this.modelName,
                    value,
                },
                logMessage
            );
            return null;
        }

        return options.lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    /**
     * ---------------------------------------------------------
     * FIND ACTIVE TOKEN BY RAW TOKEN
     * ---------------------------------------------------------
     *
     * Purpose:
     * Resolves a raw refresh token into an active persisted token record.
     *
     * Behavior:
     * - trims the incoming raw token
     * - uses the model static to hash and resolve the token
     * - returns null when token is not found
     *
     * @param {string} rawToken
     * @param {Object} [options={}]
     * @returns {Promise<Object|null>}
     */
    async findActiveByRawToken(rawToken, options = {}) {
        const normalizedToken = String(rawToken || "").trim();

        return this._findOneOrNull({
            value: normalizedToken,
            finder: this.model.findActiveByRawToken,
            logMessage: "Active refresh token not found",
            options,
        });
    }

    /**
     * ---------------------------------------------------------
     * REVOKE ACTIVE TOKEN BY RAW TOKEN
     * ---------------------------------------------------------
     *
     * Purpose:
     * Resolves an active refresh token using the raw token value
     * and revokes it safely through the mongoose document instance.
     *
     * Important:
     * This method fetches the mongoose document directly instead of using
     * the normalized return flow because instance methods such as revoke()
     * only exist on mongoose documents.
     *
     * @param {string} rawToken
     * @param {string} [reason="manual_revocation"]
     * @param {Object} [options={}]
     * @returns {Promise<Object|null>}
     */
    async revokeByRawToken(rawToken, reason = "manual_revocation", options = {}) {
        const normalizedToken = String(rawToken || "").trim();
        const query = this.model.findActiveByRawToken(normalizedToken);

        if (options.session) {
            query.session(options.session);
        }

        const doc = await query;

        if (!doc) {
            system_logger.warn(
                {
                    model: this.modelName,
                    value: normalizedToken,
                },
                "Active refresh token not found"
            );
            return null;
        }

        if (typeof doc.revoke !== "function") {
            throw new Error(`${this.modelName} document does not implement revoke()`);
        }

        if (options.session && typeof doc.$session === "function") {
            doc.$session(options.session);
        }

        await doc.revoke(reason);

        if (options.lean === true) {
            const plainDoc =
                typeof doc.toObject === "function" ? doc.toObject() : doc;

            return this._transformLean(plainDoc);
        }

        return this._normalizeDoc(doc);
    }
}

const refreshTokenRepository = new RefreshTokenRepository();

export { refreshTokenRepository, RefreshTokenRepository };
export default refreshTokenRepository;