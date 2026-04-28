import { usersService } from "../../services/admin/users.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { getAdminAuditMeta } from "../../utils/admin.audit.js";

const removeEmptyFilters = (filter = {}) => {
    return Object.fromEntries(
        Object.entries(filter).filter(([, value]) => {
            return value !== undefined && value !== null && value !== "";
        })
    );
};

const renderDashboardPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/dashboard", {
        title: data.title ?? "Dashboard",
        totalActiveUsers: data.totalActiveUsers ?? 0,
        totalUsers: data.totalUsers ?? 0,
        totalDeletedUsers: data.totalDeletedUsers ?? 0,
    });
};

const renderUsersPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/users", {
        title: data.title ?? "Users",
        users: data.users ?? [],
        pagination: data.pagination ?? null,
        filters: data.filters ?? {},
    });
};

class UsersController {
    getDashboard = autoCatchFn(async (request, response) => {
        const activeUsersResult = await usersService.getTotalActiveUsers();
        const allUsersResult = await usersService.getTotalUsers();
        const deletedUsersResult = await usersService.getTotalDeletedUsers();

        return renderDashboardPage(response, {
            title: "Dashboard",
            totalActiveUsers: activeUsersResult.totalActiveUsers,
            totalUsers: allUsersResult.totalUsers,
            totalDeletedUsers: deletedUsersResult.totalDeletedUsers,
        });
    });

    getAllActiveUsers = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            username,
            email,
            phoneNumber,
            role,
            subscriptionPlan,
            subscriptionIsActive,
        } = request.query;

        const filter = removeEmptyFilters({
            username,
            email,
            phoneNumber,
            role,
            "subscription.plan": subscriptionPlan,
            "subscription.isActive": subscriptionIsActive,
        });

        const result = await usersService.getAllActiveUsers(filter, {
            page,
            limit,
        });

        return renderUsersPage(response, {
            title: "Active Users",
            users: result.users,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getAllUsers = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            username,
            email,
            phoneNumber,
            role,
            subscriptionPlan,
            subscriptionIsActive,
        } = request.query;

        const filter = removeEmptyFilters({
            username,
            email,
            phoneNumber,
            role,
            "subscription.plan": subscriptionPlan,
            "subscription.isActive": subscriptionIsActive,
        });

        const result = await usersService.getAllUsers(filter, {
            page,
            limit,
        });

        return renderUsersPage(response, {
            title: "All Users",
            users: result.users,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getAllDeletedUsers = autoCatchFn(async (request, response) => {
        const {
            page,
            limit,
            username,
            email,
            phoneNumber,
            role,
            subscriptionPlan,
            subscriptionIsActive,
        } = request.query;

        const filter = removeEmptyFilters({
            username,
            email,
            phoneNumber,
            role,
            "subscription.plan": subscriptionPlan,
            "subscription.isActive": subscriptionIsActive,
        });

        const result = await usersService.getAllDeletedUsers(filter, {
            page,
            limit,
        });

        return renderUsersPage(response, {
            title: "Deleted Users",
            users: result.users,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getSingleUser = autoCatchFn(async (request, response) => {
        const { userId } = request.params;

        const result = await usersService.getUserById(userId);

        return response.status(200).render("pages/admin/user-details", {
            title: "User Details",
            user: result.user,
            viewedUser: result.user,
        });
    });

    createUser = autoCatchFn(async (request, response) => {
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.createUser(
            request.body,
            adminId,
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });

    updateUser = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.editUser(
            adminId,
            request.body,
            {},
            userId,
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });

    deleteUser = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.softDeleteUser(
            adminId,
            userId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });

    restoreUser = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.restoreUser(
            adminId,
            userId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users/deleted");
    });

    updateUserRole = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const { role } = request.body;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.updateUserRole(
            adminId,
            userId,
            role,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });

    activateSubscription = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const { plan } = request.body;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.activateSubscription(
            adminId,
            userId,
            plan,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });

    cancelSubscription = autoCatchFn(async (request, response) => {
        const { userId } = request.params;
        const adminId = request.user?.id ?? request.user?._id;

        const result = await usersService.cancelSubscription(
            adminId,
            userId,
            {},
            getAdminAuditMeta(request)
        );

        request.flash?.("success", result.message);

        return response.redirect("/admin/users");
    });
}

const usersController = new UsersController();

export { usersController, UsersController };
export default usersController;