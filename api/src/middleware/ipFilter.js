const ipFilter = (req, res, next) => {
    const allowed = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [];
    if (allowed.length === 0) return next(); // Bypass bila kosong 

    // IP Asli dari Nginx reverse proxy
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = clientIP.replace(/^::ffff:/, '').trim();

    if (!allowed.includes(cleanIP)) {
        return res.status(403).json({ error: 'Akses Ditolak. IP Anda tidak terdaftar.' });
    }
    next();
};

module.exports = { ipFilter };
