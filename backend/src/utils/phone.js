import {
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/**
 * ---------------------------------------------------------
 * NORMALIZE PHONE NUMBER
 * ---------------------------------------------------------
 *
 * Purpose:
 * - Validates phone numbers using international rules
 * - Detects country when possible
 * - Returns normalized formats for storage and SMS usage
 *
 * @param {string} value - Raw phone number input
 * @param {string} defaultCountry - ISO country code fallback (e.g. "GH", "US")
 * @returns {Object|null}
 */
const normalizePhoneNumber = (value, defaultCountry = "GH") => {
  if (typeof value !== "string") return null;

  /**
   * Basic cleanup + guard against empty input
   */
  let raw = value.trim();

  if (!raw) return null;

  /**
   * Prevent excessively large input
   */
  if (raw.length > 50) {
    raw = raw.slice(0, 50);
  }

  /**
   * Parse phone number
   */
  const phoneNumber = parsePhoneNumberFromString(raw, defaultCountry);

  if (!phoneNumber) return null;

  const isValid = phoneNumber.isValid();

  if (!isValid) return null;

  return {
    input: raw,
    country: phoneNumber.country || defaultCountry,
    countryCallingCode: `+${phoneNumber.countryCallingCode}`,
    national: phoneNumber.nationalNumber,
    e164: phoneNumber.number, // best for DB + OTP
    international: phoneNumber.formatInternational(),
    nationalFormatted: phoneNumber.formatNational(),
    isValid,
    type: phoneNumber.getType?.() || null,
  };
};

export { normalizePhoneNumber };
export default normalizePhoneNumber;