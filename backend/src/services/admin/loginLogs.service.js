// services/admin/loginLogs.service.js
import { loginLogRepository } from "../../repositories/loginLogs.repository.js";

const buildAllLoginLogsFilter = (filter = {}) => {
    return {
        ...filter,
        isDeleted: { $in: [true, false] },
    };
};

class LoginLogService {
    async getAllLoginLogs(filter = {}, options = {}) {
        const loginLogsFilter = buildAllLoginLogsFilter(filter);

        const result = await loginLogRepository.findAll(loginLogsFilter, options);

        return {
            loginLogs: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved login logs"
                : "No login logs",
        };
    }
}

const loginLogService = new LoginLogService();

export { loginLogService, LoginLogService };
export default loginLogService;