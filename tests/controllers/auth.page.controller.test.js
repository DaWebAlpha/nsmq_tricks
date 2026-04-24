import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
};

const mockSetAuthCookies = jest.fn();
const mockClearAuthCookies = jest.fn();
const mockSetCSRFTokenCookie = jest.fn();
const mockGenerateCSRFToken = jest.fn();

await jest.unstable_mockModule(
    "../../backend/src/services/auth/auth.service.js",
    () => ({
        authService: mockAuthService,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/utils/autoCatchFn.js",
    () => ({
        autoCatchFn: (handler) => handler,
    })
);

await jest.unstable_mockModule(
    "../../backend/src/utils/auth.cookies.js",
    () => ({
        setAuthCookies: mockSetAuthCookies,
        clearAuthCookies: mockClearAuthCookies,
        setCSRFTokenCookie: mockSetCSRFTokenCookie,
        REFRESH_TOKEN_COOKIE_NAME: "refresh_token",
    })
);

await jest.unstable_mockModule("../../backend/src/utils/csrf.js", () => ({
    generateCSRFToken: mockGenerateCSRFToken,
}));

const { authPageController } = await import(
    "../../backend/src/controllers/auth/auth.page.controller.js"
);

const createMockResponse = () => {
    const response = {
        status: jest.fn(),
        render: jest.fn(),
        redirect: jest.fn(),
    };

    response.status.mockReturnValue(response);
    response.render.mockReturnValue(response);
    response.redirect.mockReturnValue(response);

    return response;
};

const createMockRequest = (overrides = {}) => ({
    body: {},
    cookies: {},
    headers: {},
    originalUrl: "/dashboard",
    get: jest.fn((headerName) => {
        if (headerName === "Referrer") return undefined;
        return undefined;
    }),
    flash: jest.fn(),
    ...overrides,
});

describe("AuthPageController", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("register", () => {
        test("should register user, set cookies, set csrf token, flash success, and redirect to dashboard", async () => {
            const request = createMockRequest({
                body: {
                    username: "kashi",
                    email: "kashi@example.com",
                    password: "Password123!",
                },
            });

            const response = createMockResponse();

            const serviceResult = {
                message: "Registration successful",
                accessToken: "access-token-1",
                refreshToken: "refresh-token-1",
                user: { id: "user-1" },
                security: { accountStatus: "active" },
            };

            mockAuthService.register.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-register");

            await authPageController.register(request, response);

            expect(mockAuthService.register).toHaveBeenCalledWith(
                request.body,
                request
            );

            expect(mockSetAuthCookies).toHaveBeenCalledWith(response, {
                accessToken: serviceResult.accessToken,
                refreshToken: serviceResult.refreshToken,
            });

            expect(mockSetCSRFTokenCookie).toHaveBeenCalledWith(
                response,
                "csrf-register"
            );

            expect(request.flash).toHaveBeenCalledWith(
                "success",
                serviceResult.message
            );

            expect(response.redirect).toHaveBeenCalledWith("/dashboard");
        });
    });

    describe("login", () => {
        test("should login user, set cookies, set csrf token, flash success, and redirect to dashboard", async () => {
            const request = createMockRequest({
                body: {
                    identifier: "kashi@example.com",
                    password: "Password123!",
                },
            });

            const response = createMockResponse();

            const serviceResult = {
                message: "Login successful",
                accessToken: "access-token-2",
                refreshToken: "refresh-token-2",
                user: { id: "user-1" },
                security: { accountStatus: "active" },
            };

            mockAuthService.login.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-login");

            await authPageController.login(request, response);

            expect(mockAuthService.login).toHaveBeenCalledWith(
                request.body,
                request
            );

            expect(mockSetAuthCookies).toHaveBeenCalledWith(response, {
                accessToken: serviceResult.accessToken,
                refreshToken: serviceResult.refreshToken,
            });

            expect(mockSetCSRFTokenCookie).toHaveBeenCalledWith(
                response,
                "csrf-login"
            );

            expect(request.flash).toHaveBeenCalledWith(
                "success",
                serviceResult.message
            );

            expect(response.redirect).toHaveBeenCalledWith("/dashboard");
        });
    });

    describe("refreshToken", () => {
        test("should refresh session using cookie token, rotate cookies, rotate csrf token, flash success, and redirect to referrer", async () => {
            const request = createMockRequest({
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
                get: jest.fn((headerName) => {
                    if (headerName === "Referrer") return "/protected-page";
                    return undefined;
                }),
                headers: {
                    referer: "/fallback-page",
                },
                originalUrl: "/auth/refresh",
            });

            const response = createMockResponse();

            const serviceResult = {
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            };

            mockAuthService.refreshToken.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-refresh");

            await authPageController.refreshToken(request, response);

            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
                { refreshToken: "cookie-refresh-token" },
                request
            );

            expect(mockSetAuthCookies).toHaveBeenCalledWith(response, {
                accessToken: serviceResult.accessToken,
                refreshToken: serviceResult.refreshToken,
            });

            expect(mockSetCSRFTokenCookie).toHaveBeenCalledWith(
                response,
                "csrf-refresh"
            );

            expect(request.flash).toHaveBeenCalledWith(
                "success",
                serviceResult.message
            );

            expect(response.redirect).toHaveBeenCalledWith("/protected-page");
        });

        test("should fallback to request body refresh token when cookie token is missing", async () => {
            const request = createMockRequest({
                body: {
                    refreshToken: "body-refresh-token",
                },
                headers: {
                    referer: "/fallback-page",
                },
                originalUrl: "/auth/refresh",
            });

            const response = createMockResponse();

            mockAuthService.refreshToken.mockResolvedValue({
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            });

            mockGenerateCSRFToken.mockReturnValue("csrf-refresh");

            await authPageController.refreshToken(request, response);

            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
                { refreshToken: "body-refresh-token" },
                request
            );
        });

        test("should fallback to headers.referer when request.get('Referrer') is missing", async () => {
            const request = createMockRequest({
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
                headers: {
                    referer: "/headers-referer-page",
                },
                originalUrl: "/auth/refresh",
            });

            const response = createMockResponse();

            mockAuthService.refreshToken.mockResolvedValue({
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            });

            mockGenerateCSRFToken.mockReturnValue("csrf-refresh");

            await authPageController.refreshToken(request, response);

            expect(response.redirect).toHaveBeenCalledWith(
                "/headers-referer-page"
            );
        });

        test("should fallback to originalUrl when no referrer header exists", async () => {
            const request = createMockRequest({
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
                headers: {},
                originalUrl: "/some-original-url",
            });

            const response = createMockResponse();

            mockAuthService.refreshToken.mockResolvedValue({
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            });

            mockGenerateCSRFToken.mockReturnValue("csrf-refresh");

            await authPageController.refreshToken(request, response);

            expect(response.redirect).toHaveBeenCalledWith("/some-original-url");
        });
    });

    describe("logout", () => {
        test("should logout user, clear cookies, flash success, and redirect to login", async () => {
            const request = createMockRequest({
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
            });

            const response = createMockResponse();

            mockAuthService.logout.mockResolvedValue({
                message: "Logout successful",
            });

            await authPageController.logout(request, response);

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                { refreshToken: "cookie-refresh-token" },
                request
            );

            expect(mockClearAuthCookies).toHaveBeenCalledWith(response);

            expect(request.flash).toHaveBeenCalledWith(
                "success",
                "Logout successful"
            );

            expect(response.redirect).toHaveBeenCalledWith("/login");
        });

        test("should fallback to request body refresh token during logout when cookie token is missing", async () => {
            const request = createMockRequest({
                body: {
                    refreshToken: "body-refresh-token",
                },
            });

            const response = createMockResponse();

            mockAuthService.logout.mockResolvedValue({
                message: "Logout successful",
            });

            await authPageController.logout(request, response);

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                { refreshToken: "body-refresh-token" },
                request
            );
        });
    });

    describe("me", () => {
        test("should render current authenticated user and security context", async () => {
            const request = createMockRequest({
                user: {
                    id: "user-1",
                    email: "kashi@example.com",
                },
                userSecurity: {
                    accountStatus: "active",
                    isLocked: false,
                },
            });

            const response = createMockResponse();

            await authPageController.me(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("me", {
                success: true,
                message: "Current user fetched successfully",
                user: request.user,
                security: request.userSecurity,
            });
        });
    });
});