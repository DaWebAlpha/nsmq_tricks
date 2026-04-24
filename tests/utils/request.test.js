import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import crypto from "node:crypto";

import {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "../../backend/src/utils/request.js";

describe("request utils", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    describe("getClientIP", () => {
        test("should return request.ip first when available", () => {
            const request = {
                ip: "203.0.113.10",
                headers: {
                    "x-forwarded-for": "198.51.100.1, 198.51.100.2",
                    "x-real-ip": "198.51.100.3",
                },
                socket: {
                    remoteAddress: "198.51.100.4",
                },
            };

            expect(getClientIP(request)).toBe("203.0.113.10");
        });

        test("should return first x-forwarded-for IP when request.ip is missing", () => {
            const request = {
                headers: {
                    "x-forwarded-for": "198.51.100.1, 198.51.100.2",
                    "x-real-ip": "198.51.100.3",
                },
                socket: {
                    remoteAddress: "198.51.100.4",
                },
            };

            expect(getClientIP(request)).toBe("198.51.100.1");
        });

        test("should trim x-forwarded-for first IP", () => {
            const request = {
                headers: {
                    "x-forwarded-for": " 198.51.100.1 , 198.51.100.2 ",
                },
                socket: {
                    remoteAddress: "198.51.100.4",
                },
            };

            expect(getClientIP(request)).toBe("198.51.100.1");
        });

        test("should return x-real-ip when request.ip and x-forwarded-for are missing", () => {
            const request = {
                headers: {
                    "x-real-ip": "198.51.100.3",
                },
                socket: {
                    remoteAddress: "198.51.100.4",
                },
            };

            expect(getClientIP(request)).toBe("198.51.100.3");
        });

        test("should return socket.remoteAddress when proxy headers are missing", () => {
            const request = {
                headers: {},
                socket: {
                    remoteAddress: "198.51.100.4",
                },
            };

            expect(getClientIP(request)).toBe("198.51.100.4");
        });

        test('should return "unknown" when no IP source is available', () => {
            const request = {
                headers: {},
                socket: {},
            };

            expect(getClientIP(request)).toBe("unknown");
        });

        test("should return trimmed request.ip", () => {
            const request = {
                ip: " 203.0.113.10 ",
                headers: {},
                socket: {},
            };

            expect(getClientIP(request)).toBe("203.0.113.10");
        });
    });

    describe("getUserAgent", () => {
        test("should return user-agent header when present", () => {
            const request = {
                headers: {
                    "user-agent": "Mozilla/5.0",
                },
            };

            expect(getUserAgent(request)).toBe("Mozilla/5.0");
        });

        test("should return null when user-agent header is missing", () => {
            const request = {
                headers: {},
            };

            expect(getUserAgent(request)).toBeNull();
        });
    });

    describe("getDeviceName", () => {
        test("should return device_name from request body first", () => {
            const request = {
                body: {
                    device_name: "Kashi Laptop",
                },
                headers: {
                    "x-device-name": "Header Device",
                    "device-name": "Legacy Header Device",
                },
            };

            expect(getDeviceName(request)).toBe("Kashi Laptop");
        });

        test("should return x-device-name header when body device_name is missing", () => {
            const request = {
                body: {},
                headers: {
                    "x-device-name": "Chrome on Windows",
                    "device-name": "Legacy Header Device",
                },
            };

            expect(getDeviceName(request)).toBe("Chrome on Windows");
        });

        test("should return device-name header when higher-priority values are missing", () => {
            const request = {
                body: {},
                headers: {
                    "device-name": "Firefox on Ubuntu",
                },
            };

            expect(getDeviceName(request)).toBe("Firefox on Ubuntu");
        });

        test("should trim the returned device name", () => {
            const request = {
                body: {
                    device_name: "  Kashi Phone  ",
                },
                headers: {},
            };

            expect(getDeviceName(request)).toBe("Kashi Phone");
        });

        test('should return empty string when device name is not provided', () => {
            const request = {
                body: {},
                headers: {},
            };

            expect(getDeviceName(request)).toBe("");
        });
    });

    describe("getDeviceId", () => {
        test("should return device_id from request body first", () => {
            const request = {
                body: {
                    device_id: "body-device-id-123",
                },
                headers: {
                    "x-device-id": "header-device-id-456",
                    "device-id": "legacy-device-id-789",
                },
            };

            expect(getDeviceId(request)).toBe("body-device-id-123");
        });

        test("should return x-device-id header when body device_id is missing", () => {
            const request = {
                body: {},
                headers: {
                    "x-device-id": "header-device-id-456",
                    "device-id": "legacy-device-id-789",
                },
            };

            expect(getDeviceId(request)).toBe("header-device-id-456");
        });

        test("should return device-id header when higher-priority values are missing", () => {
            const request = {
                body: {},
                headers: {
                    "device-id": "legacy-device-id-789",
                },
            };

            expect(getDeviceId(request)).toBe("legacy-device-id-789");
        });

        test("should trim the returned device id", () => {
            const request = {
                body: {
                    device_id: "  trimmed-device-id  ",
                },
                headers: {},
            };

            expect(getDeviceId(request)).toBe("trimmed-device-id");
        });

        test("should generate a UUID when no device id is provided", () => {
            const uuidSpy = jest
                .spyOn(crypto, "randomUUID")
                .mockReturnValue("generated-uuid-123");

            const request = {
                body: {},
                headers: {},
            };

            expect(getDeviceId(request)).toBe("generated-uuid-123");
            expect(uuidSpy).toHaveBeenCalledTimes(1);
        });

        test("should generate a UUID when provided device id is empty whitespace", () => {
            const uuidSpy = jest
                .spyOn(crypto, "randomUUID")
                .mockReturnValue("generated-uuid-456");

            const request = {
                body: {
                    device_id: "   ",
                },
                headers: {},
            };

            expect(getDeviceId(request)).toBe("generated-uuid-456");
            expect(uuidSpy).toHaveBeenCalledTimes(1);
        });
    });
});