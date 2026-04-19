import { autoCatchFn } from "../../utils/autoCatchFn.js";

/**
 * ---------------------------------------------------------
 * PAGE RENDER HELPER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Creates a reusable route handler for rendering static pages.
 *
 * Why this exists:
 * - Eliminates repeated controller logic for simple page rendering
 * - Standardizes response behavior across static page endpoints
 * - Keeps the controller clean and easy to maintain
 *
 * Behavior:
 * - Returns an Express route handler
 * - Responds with HTTP 200
 * - Renders the provided view with a page title
 *
 * @param {string} view - Template path to render
 * @param {string} title - Human-readable page title
 *
 * @returns {Function} Express route handler wrapped with autoCatchFn
 */
function renderPage(view, title) {
    return autoCatchFn(async (req, res) => {
        return res.status(200).render(view, { title });
    });
}

/**
 * ---------------------------------------------------------
 * PAGE CONTROLLER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles server-rendered routes for static public pages.
 *
 * Responsibilities:
 * - Renders static views such as:
 *   Home, About, Contact, Privacy Policy, Terms, and FAQ
 *
 * Important:
 * - This controller is for server-rendered pages
 * - It does not return JSON responses
 * - It contains no business logic beyond rendering views
 *
 * Design:
 * - Each controller method is generated through a reusable helper
 * - This keeps the class concise and avoids duplicated code
 */
class PageController {
    /**
     * GET /
     * Render the home page
     */
    getHomePage = renderPage("pages/home", "Home");

    /**
     * GET /about
     * Render the about page
     */
    getAboutPage = renderPage("pages/about", "About");

    /**
     * GET /contact
     * Render the contact page
     */
    getContactPage = renderPage("pages/contact", "Contact");

    /**
     * GET /privacy-policy
     * Render the privacy policy page
     */
    getPrivacyPolicyPage = renderPage("pages/privacy-policy", "Privacy Policy");

    /**
     * GET /terms
     * Render the terms page
     */
    getTermsPage = renderPage("pages/terms", "Terms");

    /**
     * GET /faq
     * Render the FAQ page
     */
    getFaqPage = renderPage("pages/faq", "FAQ");
}

/**
 * Singleton controller instance
 * Used by route registration throughout the application
 */
const pageController = new PageController();

/**
 * Named export:
 * Useful for testing or extension
 *
 * Default export:
 * Primary controller instance used in routes
 */
export { pageController, PageController };
export default pageController;