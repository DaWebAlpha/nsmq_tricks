import { userRepository } from "../../repositories/user.repository.js";
import { normalizeValue } from "../../utils/string.utils.js";
import { normalizePhoneNumber } from "../../utils/phone.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { ConflictError } from "../../errors/conflict.error.js";
import { audit_logger } from "../../core/pino.logger.js";
import withTransaction from "../../utils/db.transaction.js";
import { ACCOUNT_STATUSES } from "../../models/auth/userSecurity.model.js";
import { securityRepository } from "../../repositories/security.repository.js";
import { adminActivityRepository } from "../../repositories/adminActivity.repository.js";
import { ADMIN_ACTIVITY_ACTIONS } from "../../models/admin/adminActivity.model.js";
import {
    USER_ROLES,
    SUBSCRIPTION_PLANS,
} from "../../models/auth/user.model.js";

const resolveId = (doc) => doc?.id ?? doc?._id ?? null;

const escapeRegex = (value = "") => {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const coerceBooleanField = (value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
        return true;
    }

    if (value === false || value === "false" || value === "off" || value === "0") {
        return false;
    }

    return undefined;
};

const normalizeSearchPhoneNumber = (phoneNumber) => {
    const rawPhone = String(phoneNumber || "").trim();

    if (!rawPhone) return null;

    const cleanedPhone = rawPhone.replace(/\s+/g, "");
    const digitsOnly = cleanedPhone.replace(/[^\d]/g, "");

    const candidates = new Set([
        cleanedPhone,
        cleanedPhone.replace(/[^\d+]/g, ""),
        cleanedPhone.replace(/^\+2330/, "+233"),
        digitsOnly,
    ]);

    if (digitsOnly.startsWith("2330")) {
        candidates.add(`+233${digitsOnly.slice(4)}`);
    }

    if (digitsOnly.startsWith("233") && !digitsOnly.startsWith("2330")) {
        candidates.add(`+${digitsOnly}`);
    }

    if (digitsOnly.startsWith("0")) {
        candidates.add(digitsOnly);
        candidates.add(`+233${digitsOnly.slice(1)}`);
    }

    for (const candidate of candidates) {
        const normalizedPhone = normalizePhoneNumber(candidate, "GH");

        if (normalizedPhone?.e164) {
            return normalizedPhone.e164;
        }
    }

    return null;
};

const buildUsersFilter = (filter = {}) => {
    const safeFilter = {};

    if (filter.isDeleted !== undefined) {
        safeFilter.isDeleted = filter.isDeleted;
    }

    if (filter.username) {
        safeFilter.username = {
            $regex: escapeRegex(normalizeValue(String(filter.username))),
            $options: "i",
        };
    }

    if (filter.email) {
        safeFilter.email = {
            $regex: escapeRegex(normalizeValue(String(filter.email))),
            $options: "i",
        };
    }

    if (filter.phoneNumber) {
        const normalizedPhone = normalizeSearchPhoneNumber(filter.phoneNumber);

        if (normalizedPhone) {
            safeFilter.phoneNumber = normalizedPhone;
        } else {
            safeFilter.phoneNumber = {
                $regex: escapeRegex(String(filter.phoneNumber).replace(/[^\d+]/g, "")),
                $options: "i",
            };
        }
    }

    if (filter.role) {
        const role = normalizeValue(String(filter.role));

        if (USER_ROLES.includes(role)) {
            safeFilter.role = role;
        }
    }

    if (filter["subscription.plan"]) {
        const plan = normalizeValue(String(filter["subscription.plan"]));

        if (SUBSCRIPTION_PLANS.includes(plan)) {
            safeFilter["subscription.plan"] = plan;
        }
    }

    if (filter["subscription.isActive"] !== undefined) {
        const isActive = coerceBooleanField(filter["subscription.isActive"]);

        if (isActive !== undefined) {
            safeFilter["subscription.isActive"] = isActive;
        }
    }

    return safeFilter;
};

const buildActiveUsersFilter = (filter = {}) => {
    return buildUsersFilter({
        ...filter,
        isDeleted: false,
    });
};

const buildAllUsersFilter = (filter = {}) => {
    return buildUsersFilter({
        ...filter,
        isDeleted: { $in: [true, false] },
    });
};

const buildDeletedUsersFilter = (filter = {}) => {
    return buildUsersFilter({
        ...filter,
        isDeleted: true,
    });
};

const assertValidUserId = (userId) => {
    if (!userId) {
        throw new BadRequestError({ message: "UserId is required" });
    }

    return userId;
};

const assertValidAdminId = (adminId) => {
    if (!adminId) {
        throw new BadRequestError({ message: "AdminId is required" });
    }

    return adminId;
};

const assertValidRole = (role) => {
    const normalizedRole = normalizeValue(String(role ?? ""));

    if (!USER_ROLES.includes(normalizedRole)) {
        throw new BadRequestError({ message: "Invalid user role" });
    }

    return normalizedRole;
};

const assertValidSubscriptionPlan = (plan) => {
    const normalizedPlan = normalizeValue(String(plan ?? "free"));

    if (!SUBSCRIPTION_PLANS.includes(normalizedPlan)) {
        throw new BadRequestError({ message: "Invalid subscription plan" });
    }

    return normalizedPlan;
};

const assertUserExists = async (userId, options = {}) => {
    const user = await userRepository.findById(userId, options);

    if (!user) {
        throw new BadRequestError({ message: "User not found" });
    }

    return user;
};

const ensureUniqueUserFields = async ({
    userId = null,
    username,
    email,
    phoneNumber,
}) => {
    const [usernameExists, emailExists, phoneExists] = await Promise.all([
        username ? userRepository.checkIfUsernameExists(username) : false,
        email ? userRepository.checkIfEmailExists(email) : false,
        phoneNumber ? userRepository.checkIfPhoneExists(phoneNumber) : false,
    ]);

    if (usernameExists && String(resolveId(usernameExists)) !== String(userId)) {
        throw new ConflictError({ message: "Username already exists" });
    }

    if (emailExists && String(resolveId(emailExists)) !== String(userId)) {
        throw new ConflictError({ message: "Email already exists" });
    }

    if (phoneExists && String(resolveId(phoneExists)) !== String(userId)) {
        throw new ConflictError({ message: "Phone number already exists" });
    }
};

class UsersService {
    async createUser(payload = {}, adminId, auditMeta = {}) {
        const username = normalizeValue(String(payload?.username ?? ""));
        const email = normalizeValue(String(payload?.email ?? ""));
        const password = String(payload?.password ?? "");
        const rawPhoneNumber = String(payload?.phoneNumber ?? "").trim();
        const normalizedPhone = normalizeSearchPhoneNumber(rawPhoneNumber);
        const phoneNumber = normalizedPhone || rawPhoneNumber;
        const role = assertValidRole(payload?.role ?? "user");

        assertValidAdminId(adminId);

        if (!username) throw new BadRequestError({ message: "Username is required" });
        if (!email) throw new BadRequestError({ message: "Email is required" });
        if (!password) throw new BadRequestError({ message: "Password is required" });
        if (!phoneNumber) throw new BadRequestError({ message: "Phone number is required" });

        await ensureUniqueUserFields({
            username,
            email,
            phoneNumber,
        });

        return withTransaction(async (session) => {
            let user;

            try {
                user = await userRepository.create(
                    {
                        username,
                        email,
                        phoneNumber,
                        password,
                        role,
                        createdBy: adminId,
                    },
                    { session }
                );
            } catch (error) {
                if (error.code === 11000) {
                    const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
                    throw new ConflictError({ message: `${field} already exists` });
                }

                if (error.name === "ValidationError") {
                    const messages = Object.values(error.errors).map((e) => e.message);
                    throw new BadRequestError({ message: messages.join("<br />") });
                }

                throw error;
            }

            const userId = resolveId(user);

            if (!userId) {
                throw new BadRequestError({
                    message: "User creation failed: missing user id",
                });
            }

            const security = await securityRepository.create(
                {
                    userId,
                    accountStatus: ACCOUNT_STATUSES.ACTIVE,
                    createdBy: adminId,
                },
                { session }
            );

            await adminActivityRepository.create(
                {
                    actorId: adminId,
                    targetUserId: userId,
                    action: ADMIN_ACTIVITY_ACTIONS.CREATE_USER,
                    description: "Admin created a user",
                    metadata: {
                        username,
                        email,
                        phoneNumber,
                        role,
                    },
                    ...auditMeta,
                },
                { session }
            );

            audit_logger.info({
                userId,
                createdBy: adminId,
                ...auditMeta,
                message: "User registered by admin",
            });

            return {
                user,
                security,
                message: "User registered successfully",
            };
        });
    }

    async editUser(editorId, payload = {}, options = {}, userId, auditMeta = {}) {
        assertValidAdminId(editorId);
        assertValidUserId(userId);

        const existingUser = await assertUserExists(userId);

        const username = normalizeValue(String(payload?.username ?? ""));
        const email = normalizeValue(String(payload?.email ?? ""));
        const rawPhoneNumber = String(payload?.phoneNumber ?? "").trim();
        const normalizedPhone = normalizeSearchPhoneNumber(rawPhoneNumber);
        const phoneNumber = normalizedPhone || rawPhoneNumber;
        const role = payload?.role ? assertValidRole(payload.role) : existingUser.role;

        const subscriptionPlan = payload?.subscription?.plan
            ? assertValidSubscriptionPlan(payload.subscription.plan)
            : existingUser.subscription?.plan ?? "free";

        const subscriptionIsActive =
            payload?.subscription?.isActive !== undefined
                ? coerceBooleanField(payload.subscription.isActive) ?? false
                : existingUser.subscription?.isActive ?? false;

        const subscriptionExpiresAt =
            payload?.subscription?.expiresAt !== undefined
                ? payload.subscription.expiresAt
                    ? new Date(payload.subscription.expiresAt)
                    : null
                : existingUser.subscription?.expiresAt ?? null;

        if (!username) throw new BadRequestError({ message: "Username is required" });
        if (!email) throw new BadRequestError({ message: "Email is required" });
        if (!phoneNumber) throw new BadRequestError({ message: "Phone number is required" });

        if (subscriptionExpiresAt && Number.isNaN(subscriptionExpiresAt.getTime())) {
            throw new BadRequestError({
                message: "Invalid subscription expiry date",
            });
        }

        await ensureUniqueUserFields({
            userId,
            username,
            email,
            phoneNumber,
        });

        const updateData = {
            username,
            email,
            phoneNumber,
            role,
            subscription: {
                isActive: subscriptionIsActive,
                plan: subscriptionIsActive ? subscriptionPlan : "free",
                expiresAt: subscriptionIsActive ? subscriptionExpiresAt : null,
            },
            updatedBy: editorId,
        };

        const user = await userRepository.updateById(userId, updateData, options);

        await adminActivityRepository.create({
            actorId: editorId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.UPDATE_USER,
            description: "Admin updated a user",
            metadata: {
                username,
                email,
                phoneNumber,
                role,
                subscription: updateData.subscription,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            updatedBy: editorId,
            ...auditMeta,
            message: "User updated by admin",
        });

        return {
            user,
            message: "User successfully updated",
        };
    }

    async getUserById(userId, options = {}) {
        assertValidUserId(userId);

        const user = await assertUserExists(userId, options);

        return {
            user,
            message: "User retrieved successfully",
        };
    }

    async updateUserRole(adminId, userId, role, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const normalizedRole = assertValidRole(role);

        const user = await userRepository.updateById(
            userId,
            {
                role: normalizedRole,
                updatedBy: adminId,
            },
            options
        );

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.UPDATE_USER_ROLE,
            description: "Admin updated user role",
            metadata: {
                role: normalizedRole,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            updatedBy: adminId,
            role: normalizedRole,
            ...auditMeta,
            message: "User role updated",
        });

        return {
            user,
            message: "User role updated successfully",
        };
    }

    async activateSubscription(adminId, userId, plan = "premium", options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const subscriptionPlan = assertValidSubscriptionPlan(plan);

        if (subscriptionPlan === "free") {
            throw new BadRequestError({
                message: "Free plan cannot be activated as a paid subscription",
            });
        }

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const user = await userRepository.updateById(
            userId,
            {
                subscription: {
                    isActive: true,
                    plan: subscriptionPlan,
                    expiresAt,
                },
                updatedBy: adminId,
            },
            options
        );

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.ACTIVATE_SUBSCRIPTION,
            description: "Admin activated user subscription",
            metadata: {
                plan: subscriptionPlan,
                expiresAt,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            updatedBy: adminId,
            plan: subscriptionPlan,
            ...auditMeta,
            message: "User subscription activated",
        });

        return {
            user,
            message: "User subscription activated successfully",
        };
    }

    async cancelSubscription(adminId, userId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const user = await userRepository.updateById(
            userId,
            {
                subscription: {
                    isActive: false,
                    plan: "free",
                    expiresAt: null,
                },
                updatedBy: adminId,
            },
            options
        );

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.CANCEL_SUBSCRIPTION,
            description: "Admin cancelled user subscription",
            metadata: {
                plan: "free",
                isActive: false,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            updatedBy: adminId,
            ...auditMeta,
            message: "User subscription cancelled",
        });

        return {
            user,
            message: "User subscription cancelled successfully",
        };
    }

    async hardDelete(adminId, userId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const deletedAt = new Date();

        await userRepository.deleteById(userId, options);

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: userId,
            action: ADMIN_ACTIVITY_ACTIONS.DELETE_USER,
            description: "Admin permanently deleted a user",
            metadata: {
                deletedAt,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId,
            deletedBy: adminId,
            ...auditMeta,
            message: "User permanently deleted",
        });

        return {
            message: "User permanently deleted successfully",
        };
    }

    async softDeleteUser(adminId, userId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const deletedAt = new Date();

        const user = await userRepository.updateById(
            userId,
            {
                isDeleted: true,
                deletedAt,
                deletedBy: adminId,
            },
            options
        );

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.DELETE_USER,
            description: "Admin soft deleted a user",
            metadata: {
                deletedAt,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            deletedBy: adminId,
            ...auditMeta,
            message: "User soft deleted",
        });

        return {
            user,
            message: "User deleted successfully",
        };
    }

    async restoreUser(adminId, userId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidUserId(userId);

        const restoredAt = new Date();

        const user = await userRepository.restoreDeletedUserById(
            userId,
            adminId,
            options
        );

        await adminActivityRepository.create({
            actorId: adminId,
            targetUserId: resolveId(user),
            action: ADMIN_ACTIVITY_ACTIONS.RESTORE_USER,
            description: "Admin restored a deleted user",
            metadata: {
                restoredAt,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId: resolveId(user),
            restoredBy: adminId,
            ...auditMeta,
            message: "User restored",
        });

        return {
            user,
            message: "User restored successfully",
        };
    }

    
    async getTotalActiveUsers(filter = {}, options = {}) {
        const activeUsersFilter = buildActiveUsersFilter(filter);
        const result = await userRepository.count(activeUsersFilter, options);

        return {
            totalActiveUsers: result,
        };
    }

    async getAllActiveUsers(filter = {}, options = {}) {
        const activeUsersFilter = buildActiveUsersFilter(filter);
        const result = await userRepository.findAll(activeUsersFilter, options);

        return {
            users: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved active users"
                : "No active users found",
        };
    }

    async getTotalUsers(filter = {}, options = {}) {
        const allUsersFilter = buildAllUsersFilter(filter);
        const result = await userRepository.count(allUsersFilter, options);

        return {
            totalUsers: result,
        };
    }

    async getAllUsers(filter = {}, options = {}) {
        const allUsersFilter = buildAllUsersFilter(filter);
        const result = await userRepository.findAll(allUsersFilter, options);

        return {
            users: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved users"
                : "No users found",
        };
    }

    async getTotalDeletedUsers(filter = {}, options = {}) {
        const deletedUsersFilter = buildDeletedUsersFilter(filter);
        const result = await userRepository.count(deletedUsersFilter, options);

        return {
            totalDeletedUsers: result,
        };
    }

    async getAllDeletedUsers(filter = {}, options = {}) {
        const deletedUsersFilter = buildDeletedUsersFilter(filter);
        const result = await userRepository.findAll(deletedUsersFilter, options);

        return {
            users: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved deleted users"
                : "No deleted users found",
        };
    }
}

const usersService = new UsersService();

export { usersService, UsersService };
export default usersService;