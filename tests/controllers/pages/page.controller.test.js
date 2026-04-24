import { jest, describe, test, expect, beforeEach } from "@jest/globals";

await jest.unstable_mockModule(
    ".../../../backend/src/utils/autoCatchFn.js",
    () => ({
        autoCatchFn: (handler) => handler,
    })
);

const { pageController, PageController } = await import(
    ".../../../backend/src/controllers/pages/pages.controller.js"
);

const createMockRequest = (overrides = {}) => ({
    ...overrides,
});

const createMockResponse = () => {
    const response = {
        status: jest.fn(),
        render: jest.fn(),
    };

    response.status.mockReturnValue(response);
    response.render.mockReturnValue(response);

    return response;
};

describe("PageController", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should export a singleton instance", () => {
        expect(pageController).toBeInstanceOf(PageController);
    });

    describe("getHomePage", () => {
        test("should return 200 and render the home page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getHomePage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("pages/home", {
                title: "Home",
            });
        });
    });

    describe("getAboutPage", () => {
        test("should return 200 and render the about page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getAboutPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("pages/about", {
                title: "About",
            });
        });
    });

    describe("getContactPage", () => {
        test("should return 200 and render the contact page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getContactPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("pages/contact", {
                title: "Contact",
            });
        });
    });

    describe("getPrivacyPolicyPage", () => {
        test("should return 200 and render the privacy policy page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getPrivacyPolicyPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith(
                "pages/privacy-policy",
                {
                    title: "Privacy Policy",
                }
            );
        });
    });

    describe("getTermsPage", () => {
        test("should return 200 and render the terms page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getTermsPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("pages/terms", {
                title: "Terms",
            });
        });
    });

    describe("getFaqPage", () => {
        test("should return 200 and render the faq page", async () => {
            const request = createMockRequest();
            const response = createMockResponse();

            await pageController.getFaqPage(request, response);

            expect(response.status).toHaveBeenCalledWith(200);
            expect(response.render).toHaveBeenCalledWith("pages/faq", {
                title: "FAQ",
            });
        });
    });
});