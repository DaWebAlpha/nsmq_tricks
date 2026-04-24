import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { generateCSRFToken } from "../../utils/csrf.js";
import { setCSRFTokenCookie } from "../../utils/auth.cookies.js";

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
    getLoginPage = renderPage("pages/auth/login", "Login");

    getRegisterPage = renderPage("pages/auth/register", "Register");

    getHomePage = renderPage("pages/home", "Home");

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