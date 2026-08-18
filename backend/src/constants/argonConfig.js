import argon2 from "argon2";

/**
 * Argon2id hashing parameters used by hashPassword.
 */
const ARGON_CONFIG = Object.freeze({
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 2,
    hashLength: 32,
})

export {
    ARGON_CONFIG
}
