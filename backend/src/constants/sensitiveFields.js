/**
 * Field names to strip before returning documents to clients.
 */
const SENSITIVE_FIELDS = Object.freeze([
    "password",
    "__v",
    "__version",
    "token",
    "tokenHash",
    "accessToken",
    "refreshToken",
    "otp",
    "pin",
    "secret",
    "apiKey",
    "clientSecret",
    "cardNumber",
    "cvv",
    "bankAccountNumber",
    "rawToken",
])

export {
    SENSITIVE_FIELDS,
}
