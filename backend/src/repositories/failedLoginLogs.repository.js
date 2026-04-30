import { BaseRepository } from "./base.repository.js";
import { FailedLoginLog } from "../models/auth/failedLoginLogs.model.js";

class FailedLoginLogRepository extends BaseRepository{
    constructor(){
        super(FailedLoginLog)
    }
}

const failedLoginLogRepository = new FailedLoginLogRepository();
export { failedLoginLogRepository, FailedLoginLogRepository};
export default { failedLoginLogRepository };