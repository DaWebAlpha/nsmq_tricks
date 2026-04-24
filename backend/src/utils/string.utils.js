/**
 * ---------------------------------------------------------
 * NORMALIZE STRING VALUE
 * ---------------------------------------------------------
 *
 * Purpose:
 * Standardizes string inputs to ensure consistent formatting
 * across the application.
 *
 * Behavior:
 * - Returns value as-is if not a string
 * - Normalizes Unicode characters
 * - Replaces multiple whitespace with a single space
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 * - Optionally enforces maximum length
 *
 * @param {*} val - Input value
 * @param {Object} [options]
 * @param {number} [options.maxLength=1000] - Maximum allowed length
 * @returns {*} Normalized string or original value
 */
const normalizeValue = (val, options = {}) => {
    if (typeof val !== "string") return val;

    const { maxLength = 1000 } = options;

    /**
     * Normalize Unicode (important for consistency)
     */
    let cleanedValue = val.normalize("NFKC");

    /**
     * Prevent excessively large input (basic protection)
     */
    if (cleanedValue.length > maxLength) {
        cleanedValue = cleanedValue.slice(0, maxLength);
    }

    /**
     * Replace multiple whitespace with a single space
     */
    cleanedValue = cleanedValue.replace(/\s+/g, " ");

    /**
     * Trim and lowercase
     */
    return cleanedValue.trim().toLowerCase();
};

/**
 * ---------------------------------------------------------
 * RESERVED WORDS SET
 * ---------------------------------------------------------
 *
 * Purpose:
 * Defines restricted words for usernames, routes, etc.
 *
 * Notes:
 * - Immutable to prevent accidental mutation
 * - Stored in lowercase for normalized comparison
 */
const RESERVED_WORDS = Object.freeze(new Set([
  'admin', 'administrator', 'root', 'system', 'sysadmin', 'superuser',
  'owner', 'master', 'operator', 'dbadmin', 'postmaster', 'hostmaster',
  'support', 'help', 'helpdesk', 'service', 'info', 'contact', 'security',
  'verify', 'verification', 'audit', 'compliance', 'moderator', 'staff',
  'team', 'official', 'billing', 'accounts',
  'api', 'localhost', 'null', 'undefined', 'anonymous', 'guest', 'bot',
  'robot', 'crawler', 'proxy', 'test', 'tester', 'dev', 'developer',
  'staging', 'production', 'internal',
  'legal', 'privacy', 'terms', 'policy', 'tos', 'abuse', 'copyright',
  'trademark', 'claim', 'refund'
]));

export { normalizeValue, RESERVED_WORDS };

export default {
  normalizeValue,
  RESERVED_WORDS,
};