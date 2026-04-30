// services/admin/failedLoginLogs.service.js
import { failedLoginLogRepository } from "../../repositories/failedLoginLogs.repository.js";

const buildAllFailedLoginLogsFilter = (filter = {}) => {
    return {
        ...filter,
        isDeleted: { $in: [true, false] },
    };
};

class FailedLoginLogService {
    async getAllFailedLoginLogs(filter = {}, options = {}) {
        const loginLogsFilter = buildAllFailedLoginLogsFilter(filter);

        const result = await failedLoginLogRepository.findAll(loginLogsFilter, options);

        return {
            failedLoginLogs: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved failed login logs"
                : "No failed login logs",
        };
    }

    async getTotalFailedLoginLogs(filter = {}, options = {}) {
        const loginLogsFilter = buildAllFailedLoginLogsFilter(filter);

        const result = await failedLoginLogRepository.count(loginLogsFilter, options);

        return {
            totalFailedLoginLogs: result,
        };
    }
}

const failedLoginLogService = new FailedLoginLogService();

export { failedLoginLogService, FailedLoginLogService };
export default failedLoginLogService;