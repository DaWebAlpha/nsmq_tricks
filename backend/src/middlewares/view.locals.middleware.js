import { generateCSRFToken } from "../utils/csrf.js";
import { setCSRFTokenCookie } from "../utils/auth.cookies.js";

const viewLocalsMiddleware = (request, response, next) => {
    const originalRender = response.render.bind(response);

    response.render = (view, locals = {}, callback) => {
        const existingToken = request.cookies?.csrfToken;

        // Only generate + set a new cookie if there isn't one already
        let csrfToken;
        if (existingToken) {
            csrfToken = existingToken;
            // Do NOT call setCSRFTokenCookie — leave the existing cookie alone
        } else {
            csrfToken = generateCSRFToken();
            setCSRFTokenCookie(response, csrfToken); // only set when fresh
        }

        return originalRender(
            view,
            {
                csrfToken,
                success: request.flash?.("success")?.[0],
                error: request.flash?.("error")?.[0],
                oldInput: {},
                user: request.user,
                security: request.userSecurity,
                ...locals,
            },
            callback
        );
    };

    next();
};
export { viewLocalsMiddleware };
export default viewLocalsMiddleware;