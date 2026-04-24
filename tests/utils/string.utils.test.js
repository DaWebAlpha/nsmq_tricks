import { describe, test, expect } from "@jest/globals";
import {
    normalizeValue,
    RESERVED_WORDS,
} from "../../backend/src/utils/string.utils.js";

describe("string.utils", () => {
    describe("normalizeValue", () => {
        test("should return non-string values unchanged", () => {
            expect(normalizeValue(null)).toBeNull();
            expect(normalizeValue(undefined)).toBeUndefined();
            expect(normalizeValue(123)).toBe(123);
            expect(normalizeValue(true)).toBe(true);

            const obj = { name: "Kashi" };
            expect(normalizeValue(obj)).toBe(obj);
        });

        test("should trim leading and trailing whitespace", () => {
            expect(normalizeValue("   Hello World   ")).toBe("hello world");
        });

        test("should convert string to lowercase", () => {
            expect(normalizeValue("KaShI")).toBe("kashi");
        });

        test("should replace multiple spaces with a single space", () => {
            expect(normalizeValue("hello     world")).toBe("hello world");
        });

        test("should replace tabs and newlines with a single space", () => {
            expect(normalizeValue("hello\t\tworld\n\nagain")).toBe("hello world again");
        });

        test("should normalize unicode characters using NFKC", () => {
            expect(normalizeValue("ℌ𝔢𝔩𝔩𝔬")).toBe("hello");
        });

        test("should return empty string when input is only whitespace", () => {
            expect(normalizeValue("     ")).toBe("");
            expect(normalizeValue("\n\t   \t")).toBe("");
        });

        test("should preserve normal punctuation while normalizing spaces and case", () => {
            expect(normalizeValue("  Hello,   WORLD!  ")).toBe("hello, world!");
        });

        test("should enforce default maxLength of 1000", () => {
            const input = `A${"B".repeat(1200)}`;
            const result = normalizeValue(input);

            expect(result.length).toBe(1000);
            expect(result).toBe(input.slice(0, 1000).toLowerCase());
        });

        test("should allow custom maxLength option", () => {
            const input = "ABCDEFGHIJK";
            const result = normalizeValue(input, { maxLength: 5 });

            expect(result).toBe("abcde");
        });

        test("should not truncate when input length is within maxLength", () => {
            const input = "Hello World";
            const result = normalizeValue(input, { maxLength: 50 });

            expect(result).toBe("hello world");
        });
    });

    describe("RESERVED_WORDS", () => {
        test("should contain common reserved system words", () => {
            expect(RESERVED_WORDS.has("admin")).toBe(true);
            expect(RESERVED_WORDS.has("root")).toBe(true);
            expect(RESERVED_WORDS.has("api")).toBe(true);
            expect(RESERVED_WORDS.has("support")).toBe(true);
        });

        test("should not contain non-reserved words", () => {
            expect(RESERVED_WORDS.has("kashi")).toBe(false);
            expect(RESERVED_WORDS.has("maxi")).toBe(false);
            expect(RESERVED_WORDS.has("sciencequiz")).toBe(false);
        });

        test("should work correctly with normalized input values", () => {
            const value = normalizeValue("   ADMIN   ");
            expect(RESERVED_WORDS.has(value)).toBe(true);
        });

        test("should remain a Set instance", () => {
            expect(RESERVED_WORDS).toBeInstanceOf(Set);
        });

        test("should reject case-sensitive raw lookups unless normalized first", () => {
            expect(RESERVED_WORDS.has("ADMIN")).toBe(false);
            expect(RESERVED_WORDS.has(normalizeValue("ADMIN"))).toBe(true);
        });
    });
});