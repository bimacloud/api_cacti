const db = require('../config/database');

const getPopStatus = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, hostname, description, status
            FROM host
            WHERE deleted = '' AND (description LIKE '%POP%' OR hostname LIKE '%pop%')
            ORDER BY status DESC
        `);

        // Cacti status: 0=Unknown, 1=Down, 2=Recovering, 3=Up
        const pops = rows.map(r => ({
            id: r.id,
            pop_name: r.description,
            hostname: r.hostname,
            status_text: r.status === 3 ? 'UP' : r.status === 1 ? 'DOWN' : 'UNKNOWN/RECOVERING',
            status_code: r.status
        }));
        res.json({ data: pops });
    } catch (error) {
        console.error('getPopStatus error:', error);
        res.status(500).json({ error: 'Database query error.' });
    }
};

module.exports = { getPopStatus };
