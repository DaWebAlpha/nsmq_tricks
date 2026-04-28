import { generateCSRFToken } from "../utils/csrf.js";
import { setCSRFTokenCookie } from "../utils/auth.cookies.js";

const viewLocalsMiddleware = (request, response, next) => {
    const originalRender = response.render.bind(response);

    response.render = (view, locals = {}, callback) => {
        let csrfToken = request.cookies?.csrfToken;

        // ✅ Only generate if missing
        if (!csrfToken) {
            csrfToken = generateCSRFToken();
            setCSRFTokenCookie(response, csrfToken);
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