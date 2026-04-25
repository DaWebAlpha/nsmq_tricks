import { config } from "../config/config.js";
import { BadRequestError } from "../errors/badrequest.error.js";

const {
    access_token_cookie_name,
    refresh_token_cookie_name,
    node_env,
} = config;

const ACCESS_TOKEN_COOKIE_NAME = access_token_cookie_name;
const REFRESH_TOKEN_COOKIE_NAME = refresh_token_cookie_name;
const CSRF_TOKEN_COOKIE_NAME = "csrfToken";

const IS_PRODUCTION = node_env === "production";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const assertResponse = (response) => {
    if (
        !response ||
        typeof response.cookie !== "function" ||
        typeof response.clearCookie !== "function"
    ) {
        throw new BadRequestError({
            message: "A valid Express response object is required",
        });
    }
};

const assertToken = (token, fieldName = "token") => {
    if (typeof token !== "string" || token.length === 0) {
        throw new BadRequestError({
            message: `${fieldName} must be a non-empty string`,
        });
    }
};

const buildBaseCookieOptions = () => ({
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
});

const buildHttpOnlyCookieOptions = (maxAge) => ({
    ...buildBaseCookieOptions(),
    httpOnly: true,
    maxAge,
});

const buildReadableCookieOptions = (maxAge) => ({
    ...buildBaseCookieOptions(),
    httpOnly: false,
    maxAge,
});

const buildClearHttpOnlyCookieOptions = () => ({
    ...buildBaseCookieOptions(),
    httpOnly: true,
});

const buildClearReadableCookieOptions = () => ({
    ...buildBaseCookieOptions(),
    httpOnly: false,
});

const setAccessTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "Access token");

    response.cookie(
        ACCESS_TOKEN_COOKIE_NAME,
        token,
        buildHttpOnlyCookieOptions(ACCESS_TOKEN_MAX_AGE_MS)
    );
};

const setRefreshTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "Refresh token");

    response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        token,
        buildHttpOnlyCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
    );
};

const setCSRFTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "CSRF token");

    response.cookie(
        CSRF_TOKEN_COOKIE_NAME,
        token,
        buildReadableCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
    );
};

const setAuthCookies = (
    response,
    { accessToken = null, refreshToken = null } = {}
) => {
    assertResponse(response);

    if (accessToken) setAccessTokenCookie(response, accessToken);
    if (refreshToken) setRefreshTokenCookie(response, refreshToken);
};

const clearAccessTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        ACCESS_TOKEN_COOKIE_NAME,
        buildClearHttpOnlyCookieOptions()
    );
};

const clearRefreshTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        buildClearHttpOnlyCookieOptions()
    );
};

const clearCSRFTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        CSRF_TOKEN_COOKIE_NAME,
        buildClearReadableCookieOptions()
    );
};

const clearAuthCookies = (response) => {
    assertResponse(response);

    clearAccessTokenCookie(response);
    clearRefreshTokenCookie(response);
    clearCSRFTokenCookie(response);
};

export {
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    CSRF_TOKEN_COOKIE_NAME,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setAuthCookies,
    clearAccessTokenCookie,
    clearRefreshTokenCookie,
    setCSRFTokenCookie,
    clearCSRFTokenCookie,
    clearAuthCookies,
};

export default {
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    CSRF_TOKEN_COOKIE_NAME,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setAuthCookies,
    clearAccessTokenCookie,
    clearRefreshTokenCookie,
    setCSRFTokenCookie,
    clearCSRFTokenCookie,
    clearAuthCookies,
};