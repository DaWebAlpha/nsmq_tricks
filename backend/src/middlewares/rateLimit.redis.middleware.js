import redis from "../core/redis.js";
import { system_logger } from "../core/pino.logger.js";
import { getClientIP } from "../utils/request.js";
import { TooManyRequestsError } from "../errors/toomanyrequests.error.js";

/**
 * Redis-Based Rate Limiting Middleware
 *
 * Purpose:
 * Protects endpoints from abuse by limiting the number of requests
 * a client (IP or user) can make within a defined time window.
 *
 * Features:
 * - Uses Redis for distributed rate limiting
 * - Supports IP-based or user-based limiting
 * - Automatically sets TTL (expiry) for rate-limit window
 * - Sends standard rate limit headers
 * - Gracefully fails open if Redis is unavailable
 *
 * @param {Object} options
 * @param {string} options.keyPrefix - Prefix for Redis keys
 * @param {number} options.windowInSeconds - Time window for rate limiting
 * @param {number} options.maxRequests - Maximum allowed requests per window
 * @param {string} options.message - Error message when limit is exceeded
 * @param {boolean} options.useUserId - Whether to use user ID instead of IP
 *
 * @returns {Function} Express middleware function
 */
export const redisRateLimit = ({
  keyPrefix = 'rate_limit',
  windowInSeconds = 60,
  maxRequests = 10,
  message = 'Too many requests, please try again later',
  useUserId = false,
} = {}) => {
  return async (req, res, next) => {
    try {

      /**
       * Step 1: Identify Client
       * Uses user ID if available and enabled, otherwise falls back to IP address.
       */
      const ip = getClientIP(req);
      const identifier = useUserId && req.user?.id ? req.user.id : ip;

      /**
       * Step 2: Build Redis Key
       * Format: rate_limit:<identifier>
       */
      const key = `${keyPrefix}:${identifier}`;

      /**
       * Step 3: Increment Request Counter
       * Each request increases the counter atomically in Redis.
       */
      const current = await redis.incr(key);

      /**
       * Step 4: Set Expiry (TTL)
       * - First request sets the expiration window
       * - Subsequent requests ensure TTL is still valid
       */
      if (current === 1) {
        await redis.expire(key, windowInSeconds);
      } else {
        const ttl = await redis.ttl(key);

        /**
         * TTL of -1 means no expiry is set (unexpected scenario),
         * so we reapply the expiration to avoid permanent keys.
         */
        if (ttl === -1) {
          await redis.expire(key, windowInSeconds);
        }
      }

      /**
       * Step 5: Fetch Remaining Time (TTL)
       * Used for headers and retry timing.
       */
      const ttl = await redis.ttl(key);

      /**
       * Step 6: Calculate Remaining Requests
       */
      const remaining = Math.max(maxRequests - current, 0);

      /**
       * Step 7: Set Standard Rate Limit Headers
       * Helps clients understand their rate limit status.
       */
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', ttl > 0 ? ttl : windowInSeconds);

      /**
       * Step 8: Enforce Rate Limit
       * If request count exceeds allowed maximum, block the request.
       */
      if (current > maxRequests) {
        res.setHeader('Retry-After', ttl > 0 ? ttl : windowInSeconds);

        return next(
          new TooManyRequestError({
            message,
          })
        );
      }

      /**
       * Step 9: Allow Request
       */
      next();

    } catch (error) {

      /**
       * Step 10: Fail-Safe Handling
       * If Redis fails, log the error and allow the request to proceed.
       * This prevents accidental denial of service due to infrastructure issues.
       */
      system_logger.error(
        {
          message: error?.message,
          stack: error?.stack,
        },
        'Redis rate limit middleware failed'
      );

      next();
    }
  };
};

export default redisRateLimit;