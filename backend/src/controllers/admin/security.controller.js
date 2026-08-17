import { securityService } from "../../services/admin/security.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { getAdminAuditMeta } from "../../utils/admin.audit.js";

const removeEmptyFilters = (filter = {}) => {
    return Object.fromEntries(
        Object.entries(filter).filter(([, value]) => {
            return value !== undefined && value !== null && value !== "";
        })
    );
};

const getAdminId = (request) => {
    return request.user?.id ?? request.user?._id;
};

const renderSecurityPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/security", {
        title: data.title ?? "Security",
        securityRecords: data.securityRecords ?? [],
        searchResults: data.searchResults ?? [],
        pagination: data.pagination ?? null,
        searchPagination: data.searchPagination ?? null,
        filters: data.filters ?? {},
        success: data.success ?? false,
        error: data.error ?? false,
    });
};

class SecurityController {
    getAllSecurityRecords = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            username,
            email,
            phoneNumber,
            accountStatus,
            accountBanned,
            locked,
            suspended,
            banned,
            loginAttempts,
        } = request.query;

        const filter = removeEmptyFilters({
            username,
            email,
            phoneNumber,
            accountStatus,
            accountBanned,
            locked,
            suspended,
            banned,
            loginAttempts,
        });

        const hasActiveFilters = Object.keys(filter).length > 0;

        const allRecordsResult = await securityService.getAllSecurityRecords({}, {
            page,
            limit,
            sort: { updatedAt: -1 },
        });

        let searchResult = {
            securityRecords: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0,
            },
        };

        if (hasActiveFilters) {
            searchResult = await securityService.getAllSecurityRecords(filter, {
                page: 1,
                limit: 20,
                sort: { updatedAt: -1 },
            });
        }

        return renderSecurityPage(response, {
            title: "Security",
            securityRecords: allRecordsResult.securityRecords,
            searchResults: searchResult.securityRecords,
            pagination: allRecordsResult.pagination,
            searchPagination: searchResult.pagination,
            filters: request.query,
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
        });
    });

    getSingleSecurityRecord = autoCatchFn(async (request, response) => {
        const { securityId } = request.params;

        const result = await securityService.getSecurityById(securityId, {
            populate: {
                path: "userId",
                select: "username email phoneNumber role subscription isDeleted",
            },
        });

        return response.status(200).render("pages/admin/security-details", {
            title: "Security Details",
            security: result.security,
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
        });
    });

    activateAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.activateAccount(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    setPendingAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.setPendingAccount(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    suspendAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.suspendAccount(
            adminId,
            securityId,
            request.body,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    banAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.banAccount(
            adminId,
            securityId,
            request.body,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    unbanAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.unbanAccount(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    unlockAccount = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.unlockAccount(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    addBanWarning = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.addBanWarning(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    resetBanWarnings = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.resetBanWarnings(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    resetLoginAttempts = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.resetLoginAttempts(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });

    bumpAuthVersion = autoCatchFn(async (request, response) => {
        const adminId = getAdminId(request);
        const { securityId } = request.params;

        const result = await securityService.bumpAuthVersion(
            adminId,
            securityId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect(`/admin/security/${securityId}`);
    });
}

const securityController = new SecurityController();

export { securityController, SecurityController };
export default securityController;