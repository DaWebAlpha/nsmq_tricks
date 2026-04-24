import { config } from "../config/config.js";
import { BadRequestError } from "../errors/badrequest.error.js";

/**
 * ---------------------------------------------------------
 * AUTHENTICATION COOKIE HELPERS
 * ---------------------------------------------------------
 *
 * Purpose:
 * Centralizes secure cookie handling for authentication tokens.
 *
 * Responsibilities:
 * - Standardize cookie configuration across the application
 * - Prevent token leakage (httpOnly cookies)
 * - Enforce consistent security policies
 * - Provide reusable helpers for setting and clearing cookies
 */

const {
    access_token_cookie_name,
    refresh_token_cookie_name,
    node_env,
} = config;

/**
 * ---------------------------------------------------------
 * CONSTANTS
 * ---------------------------------------------------------
 */
const ACCESS_TOKEN_COOKIE_NAME = access_token_cookie_name;
const REFRESH_TOKEN_COOKIE_NAME = refresh_token_cookie_name;
const CSRF_TOKEN_COOKIE_NAME = "csrfToken";

const IS_PRODUCTION = node_env === "production";
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ---------------------------------------------------------
 * INTERNAL GUARDS
 * ---------------------------------------------------------
 */
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

/**
 * ---------------------------------------------------------
 * COOKIE OPTIONS BUILDERS
 * ---------------------------------------------------------
 */
const buildBaseCookieOptions = () => ({
    secure: IS_PRODUCTION,
    sameSite: "strict",
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

/**
 * ---------------------------------------------------------
 * SET ACCESS TOKEN COOKIE
 * ---------------------------------------------------------
 */
const setAccessTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "Access token");

    response.cookie(
        ACCESS_TOKEN_COOKIE_NAME,
        token,
        buildHttpOnlyCookieOptions(ACCESS_TOKEN_MAX_AGE_MS)
    );
};

/**
 * ---------------------------------------------------------
 * SET REFRESH TOKEN COOKIE
 * ---------------------------------------------------------
 */
const setRefreshTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "Refresh token");

    response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        token,
        buildHttpOnlyCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
    );
};

/**
 * ---------------------------------------------------------
 * SET CSRF TOKEN COOKIE
 * ---------------------------------------------------------
 */
const setCSRFTokenCookie = (response, token) => {
    assertResponse(response);
    assertToken(token, "CSRF token");

    response.cookie(
        CSRF_TOKEN_COOKIE_NAME,
        token,
        buildReadableCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
    );
};

/**
 * ---------------------------------------------------------
 * SET AUTH COOKIES
 * ---------------------------------------------------------
 */
const setAuthCookies = (
    response,
    { accessToken = null, refreshToken = null } = {}
) => {
    assertResponse(response);

    if (accessToken) setAccessTokenCookie(response, accessToken);
    if (refreshToken) setRefreshTokenCookie(response, refreshToken);
};

/**
 * ---------------------------------------------------------
 * CLEAR ACCESS TOKEN COOKIE
 * ---------------------------------------------------------
 */
const clearAccessTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        ACCESS_TOKEN_COOKIE_NAME,
        buildClearHttpOnlyCookieOptions()
    );
};

/**
 * ---------------------------------------------------------
 * CLEAR REFRESH TOKEN COOKIE
 * ---------------------------------------------------------
 */
const clearRefreshTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        buildClearHttpOnlyCookieOptions()
    );
};

/**
 * ---------------------------------------------------------
 * CLEAR CSRF TOKEN COOKIE
 * ---------------------------------------------------------
 */
const clearCSRFTokenCookie = (response) => {
    assertResponse(response);

    response.clearCookie(
        CSRF_TOKEN_COOKIE_NAME,
        buildClearReadableCookieOptions()
    );
};

/**
 * ---------------------------------------------------------
 * CLEAR ALL AUTH COOKIES
 * ---------------------------------------------------------
 */
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