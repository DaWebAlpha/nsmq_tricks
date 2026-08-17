// services/admin/security.service.js
import { securityRepository } from "../../repositories/security.repository.js";
import { userRepository } from "../../repositories/user.repository.js";
import { ACCOUNT_STATUSES } from "../../models/auth/userSecurity.model.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { audit_logger } from "../../core/pino.logger.js";

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

const toPositiveInteger = (value, fallback = 0) => {
    const number = Number(value);

    if (!Number.isInteger(number) || number < 0) {
        return fallback;
    }

    return number;
};

const buildDurationMs = ({
    durationMs = null,
    durationMinutes = null,
    durationHours = null,
    durationDays = null,
} = {}) => {
    if (durationMs !== null && durationMs !== undefined && durationMs !== "") {
        const value = Number(durationMs);

        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }

    if (durationMinutes !== null && durationMinutes !== undefined && durationMinutes !== "") {
        const value = Number(durationMinutes);

        if (Number.isFinite(value) && value > 0) {
            return value * 60 * 1000;
        }
    }

    if (durationHours !== null && durationHours !== undefined && durationHours !== "") {
        const value = Number(durationHours);

        if (Number.isFinite(value) && value > 0) {
            return value * 60 * 60 * 1000;
        }
    }

    if (durationDays !== null && durationDays !== undefined && durationDays !== "") {
        const value = Number(durationDays);

        if (Number.isFinite(value) && value > 0) {
            return value * 24 * 60 * 60 * 1000;
        }
    }

    return null;
};

const buildSecurityFilter = (filter = {}) => {
    const safeFilter = {};

    if (filter.isDeleted !== undefined) {
        safeFilter.isDeleted = filter.isDeleted;
    }

    if (filter.userId) {
        safeFilter.userId = filter.userId;
    }

    if (filter.accountStatus) {
        const status = String(filter.accountStatus).trim().toLowerCase();

        if (Object.values(ACCOUNT_STATUSES).includes(status)) {
            safeFilter.accountStatus = status;
        }
    }

    if (filter.accountBanned !== undefined) {
        const accountBanned = coerceBooleanField(filter.accountBanned);

        if (accountBanned !== undefined) {
            safeFilter.accountBanned = accountBanned;
        }
    }

    if (filter.authVersion !== undefined && filter.authVersion !== "") {
        safeFilter.authVersion = toPositiveInteger(filter.authVersion);
    }

    if (filter.banWarningCount !== undefined && filter.banWarningCount !== "") {
        safeFilter.banWarningCount = toPositiveInteger(filter.banWarningCount);
    }

    if (
        filter.timesAccountHasBeenBanned !== undefined &&
        filter.timesAccountHasBeenBanned !== ""
    ) {
        safeFilter.timesAccountHasBeenBanned = toPositiveInteger(
            filter.timesAccountHasBeenBanned
        );
    }

    if (filter.loginAttempts !== undefined && filter.loginAttempts !== "") {
        safeFilter.loginAttempts = toPositiveInteger(filter.loginAttempts);
    }

    if (filter.locked !== undefined) {
        const locked = coerceBooleanField(filter.locked);

        if (locked === true) {
            safeFilter.lockUntil = { $gt: new Date() };
        }

        if (locked === false) {
            safeFilter.$or = [
                { lockUntil: null },
                { lockUntil: { $exists: false } },
                { lockUntil: { $lte: new Date() } },
            ];
        }
    }

    if (filter.suspended !== undefined) {
        const suspended = coerceBooleanField(filter.suspended);

        if (suspended === true) {
            safeFilter.accountStatus = ACCOUNT_STATUSES.SUSPENDED;
            safeFilter.accountBanned = false;
            safeFilter.bannedUntil = { $gt: new Date() };
        }

        if (suspended === false) {
            safeFilter.accountStatus = { $ne: ACCOUNT_STATUSES.SUSPENDED };
        }
    }

    if (filter.banned !== undefined) {
        const banned = coerceBooleanField(filter.banned);

        if (banned === true) {
            safeFilter.accountStatus = ACCOUNT_STATUSES.BANNED;
            safeFilter.accountBanned = true;
        }

        if (banned === false) {
            safeFilter.accountStatus = { $ne: ACCOUNT_STATUSES.BANNED };
            safeFilter.accountBanned = false;
        }
    }

    if (filter.lastLoginFrom || filter.lastLoginTo) {
        safeFilter.lastLoginAt = {};

        if (filter.lastLoginFrom) {
            const date = new Date(filter.lastLoginFrom);

            if (!Number.isNaN(date.getTime())) {
                safeFilter.lastLoginAt.$gte = date;
            }
        }

        if (filter.lastLoginTo) {
            const date = new Date(filter.lastLoginTo);

            if (!Number.isNaN(date.getTime())) {
                safeFilter.lastLoginAt.$lte = date;
            }
        }

        if (!Object.keys(safeFilter.lastLoginAt).length) {
            delete safeFilter.lastLoginAt;
        }
    }

    return safeFilter;
};

const buildUserSearchFilter = (filter = {}) => {
    const userFilter = {
        isDeleted: false,
    };

    if (filter.username) {
        userFilter.username = {
            $regex: escapeRegex(String(filter.username).trim()),
            $options: "i",
        };
    }

    if (filter.email) {
        userFilter.email = {
            $regex: escapeRegex(String(filter.email).trim()),
            $options: "i",
        };
    }

    if (filter.phoneNumber) {
        userFilter.phoneNumber = {
            $regex: escapeRegex(String(filter.phoneNumber).trim()),
            $options: "i",
        };
    }

    return userFilter;
};

const getEmptyPagination = (options = {}) => {
    return {
        total: 0,
        page: Number(options.page ?? 1),
        limit: Number(options.limit ?? 10),
        totalPages: 0,
    };
};

const buildActiveSecurityFilter = (filter = {}) => {
    return buildSecurityFilter({
        ...filter,
        isDeleted: false,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        accountBanned: false,
    });
};

const buildAllSecurityFilter = (filter = {}) => {
    return buildSecurityFilter({
        ...filter,
        isDeleted: { $in: [true, false] },
    });
};

const buildSuspendedSecurityFilter = (filter = {}) => {
    return buildSecurityFilter({
        ...filter,
        isDeleted: false,
        suspended: true,
    });
};

const buildBannedSecurityFilter = (filter = {}) => {
    return buildSecurityFilter({
        ...filter,
        isDeleted: false,
        banned: true,
    });
};

const buildLockedSecurityFilter = (filter = {}) => {
    return buildSecurityFilter({
        ...filter,
        isDeleted: false,
        locked: true,
    });
};

const assertValidAdminId = (adminId) => {
    if (!adminId) {
        throw new BadRequestError({ message: "AdminId is required" });
    }

    return adminId;
};

const assertValidSecurityId = (securityId) => {
    if (!securityId) {
        throw new BadRequestError({ message: "SecurityId is required" });
    }

    return securityId;
};

const assertValidUserId = (userId) => {
    if (!userId) {
        throw new BadRequestError({ message: "UserId is required" });
    }

    return userId;
};

const assertUserExists = async (userId, options = {}) => {
    const user = await userRepository.findById(userId, options);

    if (!user) {
        throw new BadRequestError({ message: "User not found" });
    }

    return user;
};

const getPagination = (result = {}) => {
    return {
        total: result.total ?? 0,
        page: result.page ?? 1,
        limit: result.limit ?? 10,
        totalPages: result.totalPages ?? 0,
    };
};

class SecurityService {
    async createSecurityRecord(payload = {}, adminId, auditMeta = {}) {
        assertValidAdminId(adminId);

        const userId = assertValidUserId(payload?.userId);
        const accountStatus = String(
            payload?.accountStatus ?? ACCOUNT_STATUSES.ACTIVE
        ).trim().toLowerCase();

        if (!Object.values(ACCOUNT_STATUSES).includes(accountStatus)) {
            throw new BadRequestError({ message: "Invalid account status" });
        }

        await assertUserExists(userId);

        const existingSecurity = await securityRepository.exists({
            userId,
            isDeleted: false,
        });

        if (existingSecurity) {
            throw new BadRequestError({
                message: "Security record already exists for this user",
            });
        }

        const security = await securityRepository.create({
            userId,
            accountStatus,
            accountBanned: accountStatus === ACCOUNT_STATUSES.BANNED,
            createdBy: adminId,
        });

        audit_logger.info({
            securityId: resolveId(security),
            userId,
            createdBy: adminId,
            ...auditMeta,
            message: "Admin created security record",
        });

        return {
            security,
            message: "Security record created successfully",
        };
    }

    async getSecurityById(securityId, options = {}) {
        assertValidSecurityId(securityId);

        const security = await securityRepository.findById(securityId, options);

        return {
            security,
            message: "Security record retrieved successfully",
        };
    }

    async getSecurityByUserId(userId, options = {}) {
        assertValidUserId(userId);

        const security = await securityRepository.findOne(
            {
                userId,
                isDeleted: false,
            },
            options
        );

        return {
            security,
            message: "Security record retrieved successfully",
        };
    }

    async getTotalSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildAllSecurityFilter(filter);
        const result = await securityRepository.count(securityFilter, options);

        return {
            totalSecurityRecords: result,
        };
    }

    async getTotalActiveSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildActiveSecurityFilter(filter);
        const result = await securityRepository.count(securityFilter, options);

        return {
            totalActiveSecurityRecords: result,
        };
    }

    async getTotalSuspendedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildSuspendedSecurityFilter(filter);
        const result = await securityRepository.count(securityFilter, options);

        return {
            totalSuspendedSecurityRecords: result,
        };
    }

    async getTotalBannedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildBannedSecurityFilter(filter);
        const result = await securityRepository.count(securityFilter, options);

        return {
            totalBannedSecurityRecords: result,
        };
    }

    async getTotalLockedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildLockedSecurityFilter(filter);
        const result = await securityRepository.count(securityFilter, options);

        return {
            totalLockedSecurityRecords: result,
        };
    }

    async getAllSecurityRecords(filter = {}, options = {}) {
    const {
        username,
        email,
        phoneNumber,
        ...securityFilterInput
    } = filter;

    const securityFilter = buildAllSecurityFilter(securityFilterInput);

    if (username || email || phoneNumber) {
        const userSearchFilter = buildUserSearchFilter({
            username,
            email,
            phoneNumber,
        });

        const usersResult = await userRepository.findAll(userSearchFilter, {
            page: 1,
            limit: 100,
            lean: true,
            select: "_id",
        });

        const userIds = usersResult.docs?.map((user) => user._id ?? user.id) ?? [];

        if (!userIds.length) {
            return {
                securityRecords: [],
                pagination: getEmptyPagination(options),
                message: "No security records found",
            };
        }

        securityFilter.userId = {
            $in: userIds,
        };
    }

    const result = await securityRepository.findAll(securityFilter, {
        sort: { updatedAt: -1 },
        populate: {
            path: "userId",
            select: "username email phoneNumber role subscription isDeleted",
        },
        ...options,
    });

    return {
        securityRecords: result.docs ?? [],
        pagination: getPagination(result),
        message: result.docs?.length
            ? "Successfully retrieved security records"
            : "No security records found",
    };
}

    async getAllActiveSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildActiveSecurityFilter(filter);

        const result = await securityRepository.findAll(securityFilter, {
            sort: { updatedAt: -1 },
            populate: {
                path: "userId",
                select: "username email phoneNumber role subscription isDeleted",
            },
            ...options,
        });

        return {
            securityRecords: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved active security records"
                : "No active security records found",
        };
    }

    async getAllSuspendedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildSuspendedSecurityFilter(filter);

        const result = await securityRepository.findAll(securityFilter, {
            sort: { bannedUntil: -1 },
            populate: {
                path: "userId",
                select: "username email phoneNumber role subscription isDeleted",
            },
            ...options,
        });

        return {
            securityRecords: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved suspended security records"
                : "No suspended security records found",
        };
    }

    async getAllBannedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildBannedSecurityFilter(filter);

        const result = await securityRepository.findAll(securityFilter, {
            sort: { bannedAt: -1 },
            populate: {
                path: "userId",
                select: "username email phoneNumber role subscription isDeleted",
            },
            ...options,
        });

        return {
            securityRecords: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved banned security records"
                : "No banned security records found",
        };
    }

    async getAllLockedSecurityRecords(filter = {}, options = {}) {
        const securityFilter = buildLockedSecurityFilter(filter);

        const result = await securityRepository.findAll(securityFilter, {
            sort: { lockUntil: -1 },
            populate: {
                path: "userId",
                select: "username email phoneNumber role subscription isDeleted",
            },
            ...options,
        });

        return {
            securityRecords: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved locked security records"
                : "No locked security records found",
        };
    }

    async activateAccount(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                accountStatus: ACCOUNT_STATUSES.ACTIVE,
                accountBanned: false,
                bannedAt: null,
                bannedUntil: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            updatedBy: adminId,
            ...auditMeta,
            message: "Admin activated account security status",
        });

        return {
            security,
            message: "Account activated successfully",
        };
    }

    async setPendingAccount(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                accountStatus: ACCOUNT_STATUSES.PENDING,
                accountBanned: false,
                bannedAt: null,
                bannedUntil: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            updatedBy: adminId,
            ...auditMeta,
            message: "Admin moved account security status to pending",
        });

        return {
            security,
            message: "Account moved to pending successfully",
        };
    }

    async suspendAccount(
        adminId,
        securityId,
        payload = {},
        options = {},
        auditMeta = {}
    ) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const durationMs = buildDurationMs(payload);

        if (!durationMs) {
            throw new BadRequestError({
                message: "Suspension duration is required",
            });
        }

        const now = new Date();
        const bannedUntil = new Date(now.getTime() + durationMs);

        const existingSecurity = await securityRepository.findById(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                accountStatus: ACCOUNT_STATUSES.SUSPENDED,
                accountBanned: false,
                bannedAt: now,
                bannedUntil,
                timesAccountHasBeenBanned:
                    (existingSecurity.timesAccountHasBeenBanned ?? 0) + 1,
                banWarningCount: 0,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.warn({
            securityId: resolveId(security),
            userId: security.userId,
            suspendedBy: adminId,
            bannedUntil,
            durationMs,
            reason: payload.reason ?? null,
            ...auditMeta,
            message: "Admin suspended account",
        });

        return {
            security,
            message: "Account suspended successfully",
        };
    }

    async banAccount(
        adminId,
        securityId,
        payload = {},
        options = {},
        auditMeta = {}
    ) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const existingSecurity = await securityRepository.findById(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                accountStatus: ACCOUNT_STATUSES.BANNED,
                accountBanned: true,
                bannedAt: new Date(),
                bannedUntil: null,
                timesAccountHasBeenBanned:
                    (existingSecurity.timesAccountHasBeenBanned ?? 0) + 1,
                banWarningCount: 0,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.warn({
            securityId: resolveId(security),
            userId: security.userId,
            bannedBy: adminId,
            reason: payload.reason ?? null,
            ...auditMeta,
            message: "Admin permanently banned account",
        });

        return {
            security,
            message: "Account banned successfully",
        };
    }

    async unbanAccount(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                accountStatus: ACCOUNT_STATUSES.ACTIVE,
                accountBanned: false,
                bannedAt: null,
                bannedUntil: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            unbannedBy: adminId,
            ...auditMeta,
            message: "Admin removed account ban/suspension",
        });

        return {
            security,
            message: "Account ban removed successfully",
        };
    }

    async unlockAccount(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                loginAttempts: 0,
                lockUntil: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            unlockedBy: adminId,
            ...auditMeta,
            message: "Admin unlocked account",
        });

        return {
            security,
            message: "Account unlocked successfully",
        };
    }

    async addBanWarning(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const existingSecurity = await securityRepository.findById(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                banWarningCount: (existingSecurity.banWarningCount ?? 0) + 1,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.warn({
            securityId: resolveId(security),
            userId: security.userId,
            warnedBy: adminId,
            ...auditMeta,
            message: "Admin added ban warning",
        });

        return {
            security,
            message: "Ban warning added successfully",
        };
    }

    async resetBanWarnings(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                banWarningCount: 0,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            updatedBy: adminId,
            ...auditMeta,
            message: "Admin reset ban warnings",
        });

        return {
            security,
            message: "Ban warnings reset successfully",
        };
    }

    async resetLoginAttempts(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                loginAttempts: 0,
                lockUntil: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            updatedBy: adminId,
            ...auditMeta,
            message: "Admin reset login attempts",
        });

        return {
            security,
            message: "Login attempts reset successfully",
        };
    }

    async bumpAuthVersion(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const existingSecurity = await securityRepository.findById(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                authVersion: (existingSecurity.authVersion ?? 0) + 1,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.warn({
            securityId: resolveId(security),
            userId: security.userId,
            updatedBy: adminId,
            ...auditMeta,
            message: "Admin bumped auth version and invalidated sessions",
        });

        return {
            security,
            message: "User sessions invalidated successfully",
        };
    }

    async softDeleteSecurityRecord(
        adminId,
        securityId,
        options = {},
        auditMeta = {}
    ) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: adminId,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.warn({
            securityId: resolveId(security),
            userId: security.userId,
            deletedBy: adminId,
            ...auditMeta,
            message: "Admin soft deleted security record",
        });

        return {
            security,
            message: "Security record deleted successfully",
        };
    }

    async restoreSecurityRecord(adminId, securityId, options = {}, auditMeta = {}) {
        assertValidAdminId(adminId);
        assertValidSecurityId(securityId);

        const security = await securityRepository.updateById(
            securityId,
            {
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
                updatedBy: adminId,
            },
            options
        );

        audit_logger.info({
            securityId: resolveId(security),
            userId: security.userId,
            restoredBy: adminId,
            ...auditMeta,
            message: "Admin restored security record",
        });

        return {
            security,
            message: "Security record restored successfully",
        };
    }
}

const securityService = new SecurityService();

export { securityService, SecurityService };
export default securityService;