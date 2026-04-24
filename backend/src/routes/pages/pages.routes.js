import express from "express";
import { pageController } from "../../controllers/pages/pages.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";


const pageRouter = express.Router();

pageRouter.get("/", pageController.getHomePage);
pageRouter.get("/about", pageController.getAboutPage);
pageRouter.get("/contact", pageController.getContactPage);
pageRouter.get("/privacy-policy", pageController.getPrivacyPolicyPage);
pageRouter.get("/terms", pageController.getTermsPage);
pageRouter.get("/faq", pageController.getFaqPage)
pageRouter.get("/dashboard", authMiddleware, pageController.getDashboard);

export { pageRouter };
export default pageRouter;