const auth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token !== process.env.API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized. Invalid Bearer Token.' });
    }
    next();
};

module.exports = { auth };
