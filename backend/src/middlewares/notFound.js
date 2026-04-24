import { system_logger } from "../core/pino.logger.js";
import { getClientIP } from "../utils/request.js";
function notFound(request, response) {

    /**
     * Step 1: Log Unmatched Route
     */
    system_logger.warn(
        {
            path: request.originalUrl,
            method: request.method,
            ip: getClientIP(request),
        },
        "Route not found"
    );

    const message = `The requested URL => ${request.originalUrl} was not found on the server`;

    /**
     * Step 4: SSR Response (HTML)
     */
    return response.status(404).render('404', {
        success: false,
        title: "Resource not found",
        message,
        path: request.originalUrl,
        timestamp: new Date().toISOString(),
    });
}

export { notFound };
export default notFound;