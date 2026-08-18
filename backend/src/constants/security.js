/** Tunable thresholds for the account-lockout system in UserSecurity. */
const SECURITY_CONFIG = Object.freeze({
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15,
});

export { SECURITY_CONFIG };
