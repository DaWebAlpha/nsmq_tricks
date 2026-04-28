import { BaseRepository } from "./base.repository.js";
import { AdminActivity } from "../models/admin/adminActivity.model.js";

class AdminActivityRepository extends BaseRepository {
    constructor() {
        super(AdminActivity);
    }
}

const adminActivityRepository = new AdminActivityRepository();

export { adminActivityRepository, AdminActivityRepository };
export default adminActivityRepository;