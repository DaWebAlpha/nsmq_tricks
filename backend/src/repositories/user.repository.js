import { User } from "../models/auth/user.model.js";
import { normalizeValue } from "../utils/string.utils.js";
import { BaseRepository } from "./base.repository.js";
import { system_logger } from "../core/pino.logger.js";
import { UnauthenticatedError } from "../errors/unauthenticated.error.js";
import { NotFoundError } from "../errors/notfound.error.js";

/**
 * ---------------------------------------------------------
 * USER REPOSITORY
 * ---------------------------------------------------------
 */
class UserRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    _applyQueryOptions(query, options = {}) {
        if (options.populate) query.populate(options.populate);
        if (options.select) query.select(options.select);
        if (options.session) query.session(options.session);

        if (options.lean === true) {
            query.lean();
        }

        return query;
    }

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

        return options.lean === true ? this._transformLean(doc) : doc;
    }

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

    async checkIfUsernameExists(username, options = {}) {
        const query = this.model
            .findOne({
                username: normalizeValue(String(username || "")),
                isDeleted: false,
            })
            .select("_id");

        this._applyQueryOptions(query, options);

        const user = await query;

        return user;
    }

    async checkIfPhoneExists(phoneNumber, options = {}) {
        const query = this.model
            .findOne({
                phoneNumber: String(phoneNumber || "").trim(),
                isDeleted: false,
            })
            .select("_id");

        this._applyQueryOptions(query, options);

        const user = await query;

        return user;
    }

    async checkIfEmailExists(email, options = {}) {
        const query = this.model
            .findOne({
                email: normalizeValue(String(email || "")),
                isDeleted: false,
            })
            .select("_id");

        this._applyQueryOptions(query, options);

        const user = await query;

        return user;
    }

    async restoreDeletedUserById(userId, adminId, options = {}) {
        const query = this.model.findOneAndUpdate(
            {
                _id: userId,
                isDeleted: true,
            },
            {
                $set: {
                    isDeleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    updatedBy: adminId,
                },
            },
            {
                new: true,
                runValidators: true,
                session: options.session,
            }
        );

        this._applyQueryOptions(query, options);

        const user = await query;

        if (!user) {
            throw new NotFoundError({
                message: `Deleted user with id ${userId} not found`,
            });
        }

        return options.lean === true
            ? this._transformLean(user)
            : this._normalizeDoc(user);
    }

    async activateSubscription(userId, plan = "premium", options = {}) {
        const user = await this.findById(userId, {
            ...options,
            lean: false,
        });

        user.activateSubscription(plan);

        await user.save({
            session: options.session,
        });

        return user;
    }

    async renewSubscription(userId, plan = "premium", options = {}) {
        const user = await this.findById(userId, {
            ...options,
            lean: false,
        });

        user.renewSubscription(plan);

        await user.save({
            session: options.session,
        });

        return user;
    }

    async cancelSubscription(userId, options = {}) {
        const user = await this.findById(userId, {
            ...options,
            lean: false,
        });

        user.cancelSubscription();

        await user.save({
            session: options.session,
        });

        return user;
    }

    async expireSubscription(userId, options = {}) {
        const user = await this.findById(userId, {
            ...options,
            lean: false,
        });

        user.expireSubscription();

        await user.save({
            session: options.session,
        });

        return user;
    }

    async findActiveSubscriptions(options = {}) {
        return this.findAll(
            { isDeleted: false },
            {
                ...options,
                queryBuilder: (query) => query.activeSubscription(),
            }
        );
    }
}

const userRepository = new UserRepository();

export { UserRepository, userRepository };
export default userRepository;