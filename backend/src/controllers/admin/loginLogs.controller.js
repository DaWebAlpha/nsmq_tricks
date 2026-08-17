// controllers/admin/loginLogs.controller.js
import loginLogService, { LoginLogService } from "../../services/admin/loginLogs.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";

const removeEmptyFilters = (filter = {}) => {
    return Object.fromEntries(
        Object.entries(filter).filter(([, value]) => {
            return value !== undefined && value !== null && value !== "";
        })
    );
};

const renderLoginLogsPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/login-logs", {
        title: data.title ?? "Login Logs",
        loginLogs: data.loginLogs ?? [],
        pagination: data.pagination ?? null,
        filters: data.filters ?? {},
    });
};

class LoginLogController {
    getAllLoginLogs = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            userId,
            identifier,
            ipAddress,
            userAgent,
            deviceName,
            deviceId,
            loginAt,
        } = request.query;

        const filter = removeEmptyFilters({
            userId,
            identifier,
            ipAddress,
            userAgent,
            deviceName,
            deviceId,
            loginAt,
        });

        const result = await loginLogService.getAllLoginLogs(filter, {
            page,
            limit,
            sort: { loginAt: -1 },
        });

        return renderLoginLogsPage(response, {
            title: "Login Logs",
            loginLogs: result.loginLogs,
            pagination: result.pagination,
            filters: request.query,
        });
    });
}

const loginLogController = new LoginLogController();

export { loginLogController, LoginLogController, LoginLogService };
export default loginLogController;