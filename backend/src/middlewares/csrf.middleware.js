import { UnauthorizedError } from "../errors/unauthorized.error.js";

const csrfMiddleware = (request, response, next) => {
    try {
        const safeMethods = ["GET", "HEAD", "OPTIONS"];

        if (safeMethods.includes(request.method)) {
            return next();
        }

        const csrfFromHeader = request.headers["x-csrf-token"];
        const csrfFromBody = request.body?._csrf;
        const csrfFromCookie = request.cookies?.csrfToken;

        const submittedToken = csrfFromHeader || csrfFromBody;

        // TEMPORARY DEBUG — remove after fix is confirmed
        console.log("[CSRF DEBUG]", {
            csrfFromBody,
            csrfFromCookie,
            csrfFromHeader,
            submittedToken,
            match: submittedToken === csrfFromCookie,
        });

        if (!submittedToken || !csrfFromCookie) {
            throw new UnauthorizedError({
                message: "CSRF token missing",
            });
        }

        if (submittedToken !== csrfFromCookie) {
            throw new UnauthorizedError({
                message: "Invalid CSRF token",
            });
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export { csrfMiddleware };
export default csrfMiddleware;