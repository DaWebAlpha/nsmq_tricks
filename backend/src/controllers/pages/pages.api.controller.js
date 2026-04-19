import { autoCatchFn } from "../../utils/autoCatchFn.js";

/**
 * ---------------------------------------------------------
 * STATIC PAGE RESPONSE BUILDER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Generates a standardized API response handler for static pages.
 *
 * Why this exists:
 * - Avoids repetition across multiple static page endpoints
 * - Ensures consistent response structure
 * - Centralizes response format for easier future changes
 *
 * Behavior:
 * - Returns a JSON response with:
 *   - success flag
 *   - descriptive message
 *   - structured data payload (title + slug)
 *
 * @param {Object} config
 * @param {string} config.title - Human-readable page title
 * @param {string} config.slug  - Machine-friendly identifier
 *
 * @returns {Function} Express route handler (wrapped with autoCatchFn)
 */
const buildStaticPageResponse = ({ title, slug }) => {
    return autoCatchFn(async (request, response) => {
        return response.status(200).json({
            success: true,
            message: `${title} page fetched successfully`,
            data: {
                title,
                slug,
            },
        });
    });
};

/**
 * ---------------------------------------------------------
 * API PAGE CONTROLLER
 * ---------------------------------------------------------
 *
 * Purpose:
 * Handles API endpoints for static informational pages.
 *
 * Responsibilities:
 * - Exposes endpoints for pages such as:
 *   Home, About, Contact, FAQ, Terms, etc.
 * - Returns standardized JSON responses
 *
 * Important Notes:
 * - This is NOT a server-rendered controller
 * - No templates/views are rendered here
 * - Safe for public, unauthenticated access
 *
 * Design Decisions:
 * - Uses a factory function to eliminate duplication
 * - Each method is a pre-configured handler
 */
class ApiPageController {
    /**
     * GET /api/pages/home
     */
    getHomePage = buildStaticPageResponse({
        title: "Home",
        slug: "home",
    });

    /**
     * GET /api/pages/about
     */
    getAboutPage = buildStaticPageResponse({
        title: "About",
        slug: "about",
    });

    /**
     * GET /api/pages/contact
     */
    getContactPage = buildStaticPageResponse({
        title: "Contact",
        slug: "contact",
    });

    /**
     * GET /api/pages/privacy-policy
     */
    getPrivacyPolicyPage = buildStaticPageResponse({
        title: "Privacy Policy",
        slug: "privacy-policy",
    });

    /**
     * GET /api/pages/terms
     */
    getTermsPage = buildStaticPageResponse({
        title: "Terms",
        slug: "terms",
    });

    /**
     * GET /api/pages/faq
     */
    getFaqPage = buildStaticPageResponse({
        title: "FAQ",
        slug: "faq",
    });
}

/**
 * Singleton instance
 * Used across routes to avoid multiple instantiations
 */
const apiPageController = new ApiPageController();

/**
 * Named export (useful for testing or extension)
 * Default export (primary usage in routes)
 */
export { apiPageController, ApiPageController };
export default apiPageController;