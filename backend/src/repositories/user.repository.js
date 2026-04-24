import { User } from "../models/auth/user.model.js";
import { normalizeValue } from "../utils/string.utils.js";
import { BaseRepository } from "./base.repository.js";
import { system_logger } from "../core/pino.logger.js";
import { UnauthenticatedError } from "../errors/unauthenticated.error.js";

/**
 * ---------------------------------------------------------
 * USER REPOSITORY
 * ---------------------------------------------------------
 *
 * Purpose:
 * - Specialized data access for User model
 * - Handles identifier-based lookup (login)
 *
 * CRITICAL:
 * - MUST return full Mongoose document for authentication
 */
class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    /**
     * Apply query options safely
     */
    _applyQueryOptions(query, options = {}) {
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (options.session) query.session(options.session);

        /**
         * DO NOT force lean
         * Only use lean if explicitly requested
         */
        if (options.lean === true) {
            query.lean();
        }

        return query;
    }

    /**
     * ---------------------------------------------------------
     * FIND ONE OR THROW (AUTH-SAFE)
     * ---------------------------------------------------------
     *
     * Purpose:
     * - Centralized lookup with consistent error handling
     *
     * CRITICAL:
     * - Returns full document (NOT transformed)
     */
    async _findOneOrThrow({
        value,
        finder,
        errorMessage = "Invalid credentials",
        logLabel = "identifier",
        options = {},
    }) {
        const query = finder.call(this.model, value);

        this._applyQueryOptions(query, options);

        const doc = await query;

        if (!doc) {
            system_logger.error(
                {
                    model: this.modelName,
                    logLabel,
                    value,
                },
                "User lookup failed"
            );

            throw new UnauthenticatedError({ message: errorMessage });
        }

        /**
         * CRITICAL:
         * Return full document for auth
         */
        return options.lean === true
            ? this._transformLean(doc)
            : doc;
    }

    /**
     * ---------------------------------------------------------
     * FIND BY IDENTIFIER (LOGIN)
     * ---------------------------------------------------------
     *
     * Supports:
     * - username
     * - email
     * - phone number
     *
     * IMPORTANT:
     * - Uses model static `findByIdentifier`
     * - That method includes `.select("+password")`
     */
    async findByIdentifier(identifier, options = {}) {
        const rawIdentifier = String(identifier ?? "").trim();

        return this._findOneOrThrow({
            value: rawIdentifier,
            finder: this.model.findByIdentifier,
            errorMessage: "Invalid credentials",
            logLabel: "identifier",
            options,
        });
    }

    async findByEmail(email, options = {}) {
        const normalizedEmail = normalizeValue(String(email || ""));

        return this._findOneOrThrow({
            value: normalizedEmail,
            finder: this.model.findByEmail,
            errorMessage: "Invalid email",
            logLabel: "email",
            options,
        });
    }

    async findByUsername(username, options = {}) {
        const normalizedUsername = normalizeValue(String(username || ""));

        return this._findOneOrThrow({
            value: normalizedUsername,
            finder: this.model.findByUsername,
            errorMessage: "Invalid username",
            logLabel: "username",
            options,
        });
    }

    async findByPhoneNumber(phoneNumber, options = {}) {
        const rawPhoneNumber = String(phoneNumber || "").trim();

        return this._findOneOrThrow({
            value: rawPhoneNumber,
            finder: this.model.findByPhoneNumber,
            errorMessage: "Invalid phone number",
            logLabel: "phone number",
            options,
        });
    }
}

const userRepository = new UserRepository();

export { UserRepository, userRepository };
export default userRepository;