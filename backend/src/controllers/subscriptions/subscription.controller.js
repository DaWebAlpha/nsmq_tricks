import { subscriptionService } from "../../services/subscription/subscription.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";

class SubscriptionController {
    activateSubscription = autoCatchFn(async (request, response) => {
        const userId = request.user?.id ?? request.user?._id;
        const { plan = "premium" } = request.body;

        const result = await subscriptionService.activateSubscription(userId, plan);

        request.flash?.("success", result.message);

        return response.redirect("/dashboard");
    });

    renewSubscription = autoCatchFn(async (request, response) => {
        const userId = request.user?.id ?? request.user?._id;
        const { plan = "premium" } = request.body;

        const result = await subscriptionService.renewSubscription(userId, plan);

        request.flash?.("success", result.message);

        return response.redirect("/dashboard");
    });

    cancelSubscription = autoCatchFn(async (request, response) => {
        const userId = request.user?.id ?? request.user?._id;

        const result = await subscriptionService.cancelSubscription(userId);

        request.flash?.("success", result.message);

        return response.redirect("/dashboard");
    });

    activeSubscriptions = autoCatchFn(async (request, response) => {
        const result = await subscriptionService.activeSubscriptions(request.query);

        return response.status(200).render("subscriptions", {
            title: "Active Subscriptions",
            users: result.users,
            pagination: result.pagination,
            message: result.message,
        });
    });
}

const subscriptionController = new SubscriptionController();

export { subscriptionController };