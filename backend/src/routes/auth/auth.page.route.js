import express from "express";
import {
    authPageController,
} from "../../controllers/auth/auth.page.controller.js";
import {
    authMiddleware,
} from "../../middlewares/auth.middleware.js";
import {
    loginRateLimit,
    registerRateLimit,
    refreshTokenRateLimit,
} from "../../middlewares/authRateLimit.middleware.js";
import { alreadyAuthenticated } from "../../middlewares/alreadyAuthenticated.middleware.js";

const authPageRouter = express.Router();

authPageRouter.get(
    "/login",
    alreadyAuthenticated,
    authPageController.getLoginPage
);

authPageRouter.get(
    "/register",
    alreadyAuthenticated,
    authPageController.getRegisterPage
);

authPageRouter.post(
    "/register",
    alreadyAuthenticated,
    registerRateLimit,
    authPageController.register
);

authPageRouter.post(
    "/login",
    alreadyAuthenticated,
    loginRateLimit,
    authPageController.login
);

authPageRouter.get(
    "/refresh-token",
    refreshTokenRateLimit,
    authPageController.refreshToken
);

authPageRouter.post(
    "/refresh-token",
    refreshTokenRateLimit,
    authPageController.refreshToken
);

authPageRouter.post(
    "/logout",
    authPageController.logout
);

authPageRouter.get(
    "/me",
    authMiddleware,
    authPageController.me
);

export { authPageRouter };
export default authPageRouter;