import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockConfig = {
    access_token_cookie_name: "accessToken",
    refresh_token_cookie_name: "refreshToken",
    node_env: "development",
};

class MockBadRequestError extends Error {
    constructor({ message = "Bad Request Error", details = null } = {}) {
        super(message);
        this.name = "BadRequestError";
        this.statusCode = 400;
        this.details = details;
        this.isOperational = true;
    }
}

await jest.unstable_mockModule("../../backend/src/config/config.js", () => ({
    config: mockConfig,
}));

await jest.unstable_mockModule(
    "../../backend/src/errors/badrequest.error.js",
    () => ({
        BadRequestError: MockBadRequestError,
    })
);

const {
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
} = await import("../../backend/src/utils/auth.cookies.js");

describe("auth.cookies", () => {
    let response;

    beforeEach(() => {
        jest.clearAllMocks();

        response = {
            cookie: jest.fn(),
            clearCookie: jest.fn(),
        };
    });

    test("should expose cookie name constants", () => {
        expect(ACCESS_TOKEN_COOKIE_NAME).toBe("accessToken");
        expect(REFRESH_TOKEN_COOKIE_NAME).toBe("refreshToken");
        expect(CSRF_TOKEN_COOKIE_NAME).toBe("csrfToken");
    });

    test("should set access token cookie with correct options", () => {
        setAccessTokenCookie(response, "access-token-value");

        expect(response.cookie).toHaveBeenCalledTimes(1);
        expect(response.cookie).toHaveBeenCalledWith(
            "accessToken",
            "access-token-value",
            {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 15 * 60 * 1000,
                path: "/",
            }
        );
    });

    test("should set refresh token cookie with correct options", () => {
        setRefreshTokenCookie(response, "refresh-token-value");

        expect(response.cookie).toHaveBeenCalledTimes(1);
        expect(response.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token-value",
            {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: "/",
            }
        );
    });

    test("should set csrf token cookie with correct options", () => {
        setCSRFTokenCookie(response, "csrf-token-value");

        expect(response.cookie).toHaveBeenCalledTimes(1);
        expect(response.cookie).toHaveBeenCalledWith(
            "csrfToken",
            "csrf-token-value",
            {
                httpOnly: false,
                secure: false,
                sameSite: "strict",
                path: "/",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            }
        );
    });

    test("should set both auth cookies when both tokens are provided", () => {
        setAuthCookies(response, {
            accessToken: "access-token-value",
            refreshToken: "refresh-token-value",
        });

        expect(response.cookie).toHaveBeenCalledTimes(2);
        expect(response.cookie).toHaveBeenNthCalledWith(
            1,
            "accessToken",
            "access-token-value",
            expect.objectContaining({
                httpOnly: true,
                maxAge: 15 * 60 * 1000,
            })
        );
        expect(response.cookie).toHaveBeenNthCalledWith(
            2,
            "refreshToken",
            "refresh-token-value",
            expect.objectContaining({
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            })
        );
    });

    test("should set only access token cookie when only accessToken is provided", () => {
        setAuthCookies(response, {
            accessToken: "access-token-value",
        });

        expect(response.cookie).toHaveBeenCalledTimes(1);
        expect(response.cookie).toHaveBeenCalledWith(
            "accessToken",
            "access-token-value",
            expect.any(Object)
        );
    });

    test("should set only refresh token cookie when only refreshToken is provided", () => {
        setAuthCookies(response, {
            refreshToken: "refresh-token-value",
        });

        expect(response.cookie).toHaveBeenCalledTimes(1);
        expect(response.cookie).toHaveBeenCalledWith(
            "refreshToken",
            "refresh-token-value",
            expect.any(Object)
        );
    });

    test("should not throw when setAuthCookies is called without tokens", () => {
        expect(() => setAuthCookies(response)).not.toThrow();
        expect(response.cookie).not.toHaveBeenCalled();
    });

    test("should clear access token cookie with correct options", () => {
        clearAccessTokenCookie(response);

        expect(response.clearCookie).toHaveBeenCalledTimes(1);
        expect(response.clearCookie).toHaveBeenCalledWith("accessToken", {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            path: "/",
        });
    });

    test("should clear refresh token cookie with correct options", () => {
        clearRefreshTokenCookie(response);

        expect(response.clearCookie).toHaveBeenCalledTimes(1);
        expect(response.clearCookie).toHaveBeenCalledWith("refreshToken", {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            path: "/",
        });
    });

    test("should clear csrf token cookie with correct options", () => {
        clearCSRFTokenCookie(response);

        expect(response.clearCookie).toHaveBeenCalledTimes(1);
        expect(response.clearCookie).toHaveBeenCalledWith("csrfToken", {
            httpOnly: false,
            secure: false,
            sameSite: "strict",
            path: "/",
        });
    });

    test("should clear all auth cookies", () => {
        clearAuthCookies(response);

        expect(response.clearCookie).toHaveBeenCalledTimes(3);
        expect(response.clearCookie).toHaveBeenNthCalledWith(
            1,
            "accessToken",
            expect.any(Object)
        );
        expect(response.clearCookie).toHaveBeenNthCalledWith(
            2,
            "refreshToken",
            expect.any(Object)
        );
        expect(response.clearCookie).toHaveBeenNthCalledWith(
            3,
            "csrfToken",
            expect.any(Object)
        );
    });

    test("should throw BadRequestError when response is invalid", () => {
        expect(() => setAccessTokenCookie(null, "token")).toThrow(
            "A valid Express response object is required"
        );
    });

    test("should throw BadRequestError when access token is invalid", () => {
        expect(() => setAccessTokenCookie(response, "")).toThrow(
            "Access token must be a non-empty string"
        );
    });

    test("should throw BadRequestError when refresh token is invalid", () => {
        expect(() => setRefreshTokenCookie(response, "")).toThrow(
            "Refresh token must be a non-empty string"
        );
    });

    test("should throw BadRequestError when csrf token is invalid", () => {
        expect(() => setCSRFTokenCookie(response, "")).toThrow(
            "CSRF token must be a non-empty string"
        );
    });
});