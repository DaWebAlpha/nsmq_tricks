import { BaseRepository } from "./base.repository.js";
import { UserSecurity } from "../models/auth/userSecurity.model.js";

/**
 * ---------------------------------------------------------
 * SECURITY REPOSITORY
 * ---------------------------------------------------------
 *
 * CRITICAL:
 * Always return mongoose documents (NOT lean)
 * because auth depends on:
 * - instance methods
 * - virtuals
 * - .save()
 */
class SecurityRepository extends BaseRepository {
    constructor() {
        super(UserSecurity);
    }

    async findOne(filter, options = {}) {
        return super.findOne(filter, {
            ...options,
            lean: false,
        });
    }

    async findById(id, options = {}) {
        return super.findById(id, {
            ...options,
            lean: false,
        });
    }

    async findAll(filter = {}, options = {}) {
        return super.findAll(filter, {
            ...options,
            lean: options.lean === true,
        });
    }

    async findByUserId(userId, options = {}) {
        return this.findOne({ userId }, options);
    }

    /**
     * ---------------------------------------------------------
     * INCREMENT LOGIN ATTEMPTS (FIXED)
     * ---------------------------------------------------------
     */
    async incrementLoginAttemptsByUserId(userId, options = {}) {
        const security = await this.findByUserId(userId, {
            ...options,
            lean: false,
        });

        security.incrementLoginAttempts();

        await security.save({
            session: options.session,
            validateBeforeSave: false,
        });

        return security;
    }

    /**
     * ---------------------------------------------------------
     * SUCCESSFUL LOGIN HANDLER
     * ---------------------------------------------------------
     */
    async handleSuccessfulLoginByUserId(userId, options = {}) {
        const security = await this.findByUserId(userId, {
            ...options,
            lean: false,
        });

        security.handleSuccessfulLoginAttempt();

        await security.save({
            session: options.session,
        });

        return security;
    }
}

const securityRepository = new SecurityRepository();

export { SecurityRepository, securityRepository };
export default securityRepository;