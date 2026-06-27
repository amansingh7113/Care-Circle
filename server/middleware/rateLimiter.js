// Lightweight in-memory rate limiter to protect sensitive endpoints (CC-011)
const rateLimitCache = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitCache.entries()) {
    if (now > data.resetTime) {
      rateLimitCache.delete(ip);
    }
  }
}, 300 * 1000).unref();

const createRateLimiter = ({ windowMs = 60 * 1000, max = 20, message = 'Too many requests, please try again later.' } = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}_${ip}`;
    const now = Date.now();

    if (!rateLimitCache.has(key)) {
      rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const data = rateLimitCache.get(key);
    if (now > data.resetTime) {
      rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    data.count += 1;
    if (data.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

module.exports = createRateLimiter;
