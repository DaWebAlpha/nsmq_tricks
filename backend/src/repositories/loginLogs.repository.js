import { BaseRepository } from "./base.repository.js";
import { LoginLog } from "../models/auth/loginLogs.model.js"


class LoginLogRepository extends BaseRepository{
    constructor(){
        super(LoginLog);
    }
}

const loginLogRepository = new LoginLogRepository();

export { loginLogRepository, LoginLogRepository};
export default loginLogRepository;