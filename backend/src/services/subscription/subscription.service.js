import { userRepository } from "../../repositories/user.repository.js";

class SubscriptionService {
    async activateSubscription(userId, plan = "premium") {
        const user = await userRepository.activateSubscription(userId, plan);

        return {
            user,
            message: "Subscription activated",
        };
    }

    async renewSubscription(userId, plan = "premium") {
        const user = await userRepository.renewSubscription(userId, plan);

        return {
            user,
            message: "Subscription successfully renewed",
        };
    }

    async cancelSubscription(userId) {
        const user = await userRepository.cancelSubscription(userId);

        return {
            user,
            message: "Subscription cancelled",
        };
    }

    async expireSubscription(userId) {
        const user = await userRepository.expireSubscription(userId);

        return {
            user,
            message: "Subscription expired",
        };
    }

    async activeSubscriptions(options = {}) {
        const result = await userRepository.findActiveSubscriptions(options);

        return {
            users: result.docs,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
            message: result.docs.length
                ? "Successfully retrieved users with active subscriptions"
                : "No active subscriptions found",
        };
    }
}

const subscriptionService = new SubscriptionService();

export { subscriptionService, SubscriptionService };