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

const { authApiController } = await import(
    "../../backend/src/controllers/auth/auth.api.controller.js"
);

const createMockResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn(),
    };

    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);

    return response;
};

describe("AuthApiController", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("register", () => {
        test("should register user, set auth cookies, set csrf cookie, and return 201 json", async () => {
            const request = {
                body: {
                    username: "kashi",
                    email: "kashi@example.com",
                    password: "Password123!",
                },
            };

            const response = createMockResponse();

            const serviceResult = {
                message: "Registration successful",
                accessToken: "access-token-1",
                refreshToken: "refresh-token-1",
                user: { id: "user-1", email: "kashi@example.com" },
                security: { accountStatus: "active" },
            };

            mockAuthService.register.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-token-1");

            await authApiController.register(request, response);

            expect(mockAuthService.register).toHaveBeenCalledTimes(1);
            expect(mockAuthService.register).toHaveBeenCalledWith(
                request.body,
                request
            );

            expect(mockSetAuthCookies).toHaveBeenCalledTimes(1);
            expect(mockSetAuthCookies).toHaveBeenCalledWith(response, {
                accessToken: serviceResult.accessToken,
                refreshToken: serviceResult.refreshToken,
            });

            expect(mockSetCSRFTokenCookie).toHaveBeenCalledTimes(1);
            expect(mockSetCSRFTokenCookie).toHaveBeenCalledWith(
                response,
                "csrf-token-1"
            );

            expect(response.status).toHaveBeenCalledWith(201);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: serviceResult.message,
                user: serviceResult.user,
                security: serviceResult.security,
            });
        });
    });

    describe("login", () => {
        test("should login user, set auth cookies, set csrf cookie, and return 200 json", async () => {
            const request = {
                body: {
                    identifier: "kashi@example.com",
                    password: "Password123!",
                },
            };

            const response = createMockResponse();

            const serviceResult = {
                message: "Login successful",
                accessToken: "access-token-2",
                refreshToken: "refresh-token-2",
                user: { id: "user-1", email: "kashi@example.com" },
                security: { accountStatus: "active" },
            };

            mockAuthService.login.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-token-2");

            await authApiController.login(request, response);

            expect(mockAuthService.login).toHaveBeenCalledTimes(1);
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
                "csrf-token-2"
            );

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: serviceResult.message,
                user: serviceResult.user,
                security: serviceResult.security,
            });
        });
    });

    describe("refreshToken", () => {
        test("should refresh session using cookie token, rotate auth cookies, rotate csrf token, and return 200 json", async () => {
            const request = {
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
                body: {},
            };

            const response = createMockResponse();

            const serviceResult = {
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            };

            mockAuthService.refreshToken.mockResolvedValue(serviceResult);
            mockGenerateCSRFToken.mockReturnValue("csrf-token-refresh");

            await authApiController.refreshToken(request, response);

            expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
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
                "csrf-token-refresh"
            );

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: serviceResult.message,
                userId: serviceResult.userId,
            });
        });

        test("should fallback to request body refresh token when cookie token is missing", async () => {
            const request = {
                cookies: {},
                body: {
                    refreshToken: "body-refresh-token",
                },
            };

            const response = createMockResponse();

            mockAuthService.refreshToken.mockResolvedValue({
                message: "Session refreshed successfully",
                accessToken: "new-access-token",
                refreshToken: "new-refresh-token",
                userId: "user-1",
            });

            mockGenerateCSRFToken.mockReturnValue("csrf-token-refresh");

            await authApiController.refreshToken(request, response);

            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
                { refreshToken: "body-refresh-token" },
                request
            );
        });
    });

    describe("logout", () => {
        test("should logout user, clear auth cookies, and return 200 json", async () => {
            const request = {
                cookies: {
                    refresh_token: "cookie-refresh-token",
                },
                body: {},
            };

            const response = createMockResponse();

            mockAuthService.logout.mockResolvedValue({
                message: "Logout successful",
            });

            await authApiController.logout(request, response);

            expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
            expect(mockAuthService.logout).toHaveBeenCalledWith(
                { refreshToken: "cookie-refresh-token" },
                request
            );

            expect(mockClearAuthCookies).toHaveBeenCalledTimes(1);
            expect(mockClearAuthCookies).toHaveBeenCalledWith(response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Logout successful",
            });
        });

        test("should fallback to request body refresh token during logout when cookie token is missing", async () => {
            const request = {
                cookies: {},
                body: {
                    refreshToken: "body-refresh-token",
                },
            };

            const response = createMockResponse();

            mockAuthService.logout.mockResolvedValue({
                message: "Logout successful",
            });

            await authApiController.logout(request, response);

            expect(mockAuthService.logout).toHaveBeenCalledWith(
                { refreshToken: "body-refresh-token" },
                request
            );
        });
    });

    describe("me", () => {
        test("should return current authenticated user and security context", async () => {
            const request = {
                user: {
                    id: "user-1",
                    email: "kashi@example.com",
                },
                userSecurity: {
                    accountStatus: "active",
                    isLocked: false,
                },
            };

            const response = createMockResponse();

            await authApiController.me(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Current user fetched successfully",
                user: request.user,
                security: request.userSecurity,
            });
        });
    });
});