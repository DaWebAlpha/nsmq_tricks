import { jest, describe, test, expect, beforeEach } from "@jest/globals";

await jest.unstable_mockModule(
    ".../../../backend/src/utils/autoCatchFn.js",
    () => ({
        autoCatchFn: (handler) => handler,
    })
);

const { apiPageController, ApiPageController } = await import(
    ".../../../backend/src/controllers/pages/pages.api.controller.js"
);

const createMockRequest = (overrides = {}) => ({
    ...overrides,
});

const createMockResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn(),
    };

    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);

    return response;
};

describe("ApiPageController", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should export a singleton instance", () => {
        expect(apiPageController).toBeInstanceOf(ApiPageController);
    });

    describe("getHomePage", () => {
        test("should return 200 with standardized home page payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getHomePage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Home page fetched successfully",
                data: {
                    title: "Home",
                    slug: "home",
                },
            });
        });
    });

    describe("getAboutPage", () => {
        test("should return 200 with standardized about page payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getAboutPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "About page fetched successfully",
                data: {
                    title: "About",
                    slug: "about",
                },
            });
        });
    });

    describe("getContactPage", () => {
        test("should return 200 with standardized contact page payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getContactPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Contact page fetched successfully",
                data: {
                    title: "Contact",
                    slug: "contact",
                },
            });
        });
    });

    describe("getPrivacyPolicyPage", () => {
        test("should return 200 with standardized privacy policy payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getPrivacyPolicyPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Privacy Policy page fetched successfully",
                data: {
                    title: "Privacy Policy",
                    slug: "privacy-policy",
                },
            });
        });
    });

    describe("getTermsPage", () => {
        test("should return 200 with standardized terms payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getTermsPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "Terms page fetched successfully",
                data: {
                    title: "Terms",
                    slug: "terms",
                },
            });
        });
    });

    describe("getFaqPage", () => {
        test("should return 200 with standardized faq payload", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await apiPageController.getFaqPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.json).toHaveBeenCalledWith({
                success: true,
                message: "FAQ page fetched successfully",
                data: {
                    title: "FAQ",
                    slug: "faq",
                },
            });
        });
    });
});