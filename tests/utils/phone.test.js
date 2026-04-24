import { describe, test, expect, jest, beforeEach } from "@jest/globals";

const mockParsePhoneNumberFromString = jest.fn();

await jest.unstable_mockModule("libphonenumber-js", () => ({
    parsePhoneNumberFromString: mockParsePhoneNumberFromString,
}));

const { normalizePhoneNumber } = await import(
    "../../backend/src/utils/phone.js"
);

describe("normalizePhoneNumber", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should return null when value is not a string", () => {
        expect(normalizePhoneNumber(null)).toBeNull();
        expect(normalizePhoneNumber(undefined)).toBeNull();
        expect(normalizePhoneNumber(12345)).toBeNull();
        expect(normalizePhoneNumber({})).toBeNull();
        expect(mockParsePhoneNumberFromString).not.toHaveBeenCalled();
    });

    test("should return null when value is an empty string after trimming", () => {
        expect(normalizePhoneNumber("")).toBeNull();
        expect(normalizePhoneNumber("     ")).toBeNull();
        expect(mockParsePhoneNumberFromString).not.toHaveBeenCalled();
    });

    test("should use GH as the default country when none is provided", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "GH",
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
            getType: jest.fn(() => "MOBILE"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567");

        expect(mockParsePhoneNumberFromString).toHaveBeenCalledWith(
            "0241234567",
            "GH"
        );

        expect(result).toEqual({
            input: "0241234567",
            country: "GH",
            countryCallingCode: "+233",
            national: "241234567",
            e164: "+233241234567",
            international: "+233 24 123 4567",
            nationalFormatted: "024 123 4567",
            isValid: true,
            type: "MOBILE",
        });
    });

    test("should use the provided default country", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "US",
            countryCallingCode: "1",
            nationalNumber: "2025550123",
            number: "+12025550123",
            formatInternational: jest.fn(() => "+1 202 555 0123"),
            formatNational: jest.fn(() => "(202) 555-0123"),
            getType: jest.fn(() => "FIXED_LINE_OR_MOBILE"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("2025550123", "US");

        expect(mockParsePhoneNumberFromString).toHaveBeenCalledWith(
            "2025550123",
            "US"
        );

        expect(result).toEqual({
            input: "2025550123",
            country: "US",
            countryCallingCode: "+1",
            national: "2025550123",
            e164: "+12025550123",
            international: "+1 202 555 0123",
            nationalFormatted: "(202) 555-0123",
            isValid: true,
            type: "FIXED_LINE_OR_MOBILE",
        });
    });

    test("should trim the input before parsing", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "GH",
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
            getType: jest.fn(() => "MOBILE"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("   0241234567   ");

        expect(mockParsePhoneNumberFromString).toHaveBeenCalledWith(
            "0241234567",
            "GH"
        );

        expect(result.input).toBe("0241234567");
    });

    test("should return null when parser returns null", () => {
        mockParsePhoneNumberFromString.mockReturnValue(null);

        const result = normalizePhoneNumber("0241234567");

        expect(result).toBeNull();
    });

    test("should return null when parsed phone number is invalid", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => false),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567");

        expect(result).toBeNull();
        expect(phoneNumberMock.isValid).toHaveBeenCalledTimes(1);
    });

    test("should fall back to defaultCountry when parsed country is missing", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: undefined,
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
            getType: jest.fn(() => "MOBILE"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567", "GH");

        expect(result.country).toBe("GH");
    });

    test("should return null-safe type when getType is missing", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "GH",
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567");

        expect(result.type).toBeNull();
    });

    test("should return null-safe type when getType returns undefined", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "GH",
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
            getType: jest.fn(() => undefined),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567");

        expect(result.type).toBeNull();
    });

    test("should build the normalized phone response correctly", () => {
        const phoneNumberMock = {
            isValid: jest.fn(() => true),
            country: "GH",
            countryCallingCode: "233",
            nationalNumber: "241234567",
            number: "+233241234567",
            formatInternational: jest.fn(() => "+233 24 123 4567"),
            formatNational: jest.fn(() => "024 123 4567"),
            getType: jest.fn(() => "MOBILE"),
        };

        mockParsePhoneNumberFromString.mockReturnValue(phoneNumberMock);

        const result = normalizePhoneNumber("0241234567");

        expect(result).toStrictEqual({
            input: "0241234567",
            country: "GH",
            countryCallingCode: "+233",
            national: "241234567",
            e164: "+233241234567",
            international: "+233 24 123 4567",
            nationalFormatted: "024 123 4567",
            isValid: true,
            type: "MOBILE",
        });
    });
});