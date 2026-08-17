import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { generateCSRFToken } from "../../utils/csrf.js";
import {
    setCSRFTokenCookie,
} from "../../utils/auth.cookies.js";

function renderPage(view, title) {
    return autoCatchFn(async (request, response) => {
        const csrfToken = generateCSRFToken();

        setCSRFTokenCookie(response, csrfToken);

        return response.status(200).render(view, {
            title,
            csrfToken,
            success: request.flash?.("success")?.[0],
            error: request.flash?.("error")?.[0],
            oldInput: {},
            user: request.user,
            security: request.userSecurity,
        });
    });
}

class AdminController {
    adminHomePage = renderPage("pages/admin/home", "Admin Home");

    adminDashboardPage = renderPage("pages/admin/dashboard", "Admin Dashboard");

    adminProfilePage = renderPage("pages/admin/profile", "Admin Profile");

    adminNotesPage = renderPage("pages/admin/notes", "Manage Notes");

    adminCreateNotePage = renderPage("pages/admin/create-note", "Create Note");

    adminSettingsPage = renderPage("pages/admin/settings", "Admin Settings");
}

const adminController = new AdminController();

export { adminController, AdminController };
export default adminController;