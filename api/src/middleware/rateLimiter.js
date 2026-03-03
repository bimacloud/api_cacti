const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // Range 1 menit
    limit: 60,               // Maksimal 60 request per IP / menit
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak request, sistem akan melimitasi sementara (Rate Limit).' }
});

module.exports = { rateLimiter };
