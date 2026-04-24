import { BaseRepository } from "./base.repository.js";
import { UserSecurity } from "../models/auth/userSecurity.model.js";

/**
 * ---------------------------------------------------------
 * SECURITY REPOSITORY
 * ---------------------------------------------------------
 *
 * Responsibility:
 * Provides repository access for user security records.
 *
 * Notes:
 * - Inherits common CRUD and utility operations from BaseRepository.
 * - Domain-specific security lookup/update helpers can be added here
 *   as the application grows.
 */
class SecurityRepository extends BaseRepository {
    constructor() {
        super(UserSecurity);
    }
}

const securityRepository = new SecurityRepository();

export { SecurityRepository, securityRepository };
export default securityRepository;