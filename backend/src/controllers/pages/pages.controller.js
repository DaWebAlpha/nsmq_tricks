import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { generateCSRFToken } from "../../utils/csrf.js";
import {
    setCSRFTokenCookie,
    REFRESH_TOKEN_COOKIE_NAME,
} from "../../utils/auth.cookies.js";

function renderPage(view, title) {
    return autoCatchFn(async (request, response) => {
        const csrfToken = generateCSRFToken();

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).render(view, {
            title,
            csrfToken,
        });
    });
}

class PageController {
    

    getHomePage = autoCatchFn(async (request, response) => {
        const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

        if (refreshToken) {
            return response.redirect("/dashboard");
        }

        const csrfToken = generateCSRFToken();

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).render("pages/home", {
            title: "Home",
            csrfToken,
        });
    });

    getAboutPage = renderPage("pages/about", "About");

    getContactPage = renderPage("pages/contact", "Contact");

    getPrivacyPolicyPage = renderPage("pages/privacy-policy", "Privacy Policy");

    getTermsPage = renderPage("pages/terms", "Terms");

    getFaqPage = renderPage("pages/faq", "FAQ");

    getDashboard = autoCatchFn(async (request, response) => {
        const csrfToken = generateCSRFToken();

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).render("pages/dashboard", {
            title: "Dashboard",
            user: request.user,
            security: request.userSecurity,
            csrfToken,
        });
    });
}

const pageController = new PageController();

export { pageController, PageController };
export default pageController;