const rateLimit = require('express-rate-limit');

const createRateLimiter = ({ windowMs = 60 * 1000, max = 20, message = 'Too many requests, please try again later.' } = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });
};

module.exports = createRateLimiter;
