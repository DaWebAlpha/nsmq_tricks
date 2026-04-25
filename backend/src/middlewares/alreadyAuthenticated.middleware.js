import { REFRESH_TOKEN_COOKIE_NAME } from "../utils/auth.cookies.js";

/**
 * ---------------------------------------------------------
 * ALREADY AUTHENTICATED MIDDLEWARE
 * ---------------------------------------------------------
 *
 * Purpose:
 * Prevent logged-in users from accessing auth pages
 * (login/register) and redirect them to dashboard.
 */
const alreadyAuthenticated = (request, response, next) => {
    const refreshToken =
        request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
        return response.redirect("/dashboard");
    }

    return next();
};

export { alreadyAuthenticated };
export default alreadyAuthenticated;