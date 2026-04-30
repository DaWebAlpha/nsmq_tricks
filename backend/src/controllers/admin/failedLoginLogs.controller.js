// controllers/admin/failedLoginLogs.controller.js
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { failedLoginLogService } from "../../services/admin/failedLoginLogs.service.js";

const removeEmptyFilters = (filter = {}) => {
    return Object.fromEntries(
        Object.entries(filter).filter(([, value]) => {
            return value !== undefined && value !== null && value !== "";
        })
    );
};

const renderFailedLoginLogPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/failed-login-logs", {
        title: data.title ?? "Failed Login Logs",
        failedLoginLogs: data.failedLoginLogs ?? [],
        pagination: data.pagination ?? null,
        filters: data.filters ?? {},
    });
};

class FailedLoginLogController {
    getAllFailedLoginLogs = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            identifier,
            ipAddress,
            userAgent,
            deviceName,
            deviceId,
            attemptedAt,
            reason,
        } = request.query;

        const filter = removeEmptyFilters({
            identifier,
            ipAddress,
            userAgent,
            deviceName,
            deviceId,
            attemptedAt,
            reason,
        });

        const result = await failedLoginLogService.getAllFailedLoginLogs(filter, {
            page,
            limit,
            sort: { attemptedAt: -1 },
        });

        return renderFailedLoginLogPage(response, {
            title: "Failed Login Logs",
            failedLoginLogs: result.failedLoginLogs,
            pagination: result.pagination,
            filters: request.query,
        });
    });
}

const failedLoginLogController = new FailedLoginLogController();

export { failedLoginLogController, FailedLoginLogController };
export default failedLoginLogController;