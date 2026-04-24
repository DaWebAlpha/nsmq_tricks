import { redisRateLimit } from './rateLimit.redis.middleware.js';

export const loginRateLimit = redisRateLimit({
  keyPrefix: 'rate_limit:auth:login',
  windowInSeconds: 60 * 10,
  maxRequests: 5,
  message: 'Too many login attempts, please try again later',
});

export const registerRateLimit = redisRateLimit({
  keyPrefix: 'rate_limit:auth:register',
  windowInSeconds: 60 * 30,
  maxRequests: 5,
  message: 'Too many registration attempts, please try again later',
});

export const refreshTokenRateLimit = redisRateLimit({
  keyPrefix: 'rate_limit:auth:refresh',
  windowInSeconds: 60 * 5,
  maxRequests: 10,
  message: 'Too many token refresh requests, please try again later',
});

export const googleLoginRateLimit = redisRateLimit({
  keyPrefix: 'rate_limit:auth:google',
  windowInSeconds: 60 * 10,
  maxRequests: 5,
  message: 'Too many Google login attempts, please try again later',
});

export default {
  loginRateLimit,
  registerRateLimit,
  refreshTokenRateLimit,
  googleLoginRateLimit,
};