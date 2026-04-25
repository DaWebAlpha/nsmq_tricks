import express from "express";
import { subscriptionController } from "../../controllers/subscriptions/subscription.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const subscriptionRouter = express.Router();

subscriptionRouter.post(
    "/activate",
    authMiddleware,
    subscriptionController.activateSubscription
);

subscriptionRouter.post(
    "/renew",
    authMiddleware,
    subscriptionController.renewSubscription
);

subscriptionRouter.post(
    "/cancel",
    authMiddleware,
    subscriptionController.cancelSubscription
);

subscriptionRouter.get(
    "/active",
    authMiddleware,
    subscriptionController.activeSubscriptions
);

export { subscriptionRouter };
export default subscriptionRouter;