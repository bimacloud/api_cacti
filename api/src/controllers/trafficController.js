const trafficService = require('../services/trafficService');
const db = require('../config/database');

/**
 * Controller for Traffic API
 */
const getGraphData = async (req, res) => {
    try {
        const { graphId } = req.params;
        const { range = '1m', group = 'none', start, end } = req.query;

        // Simple validation
        const validRanges = ['1d', '1w', '1m'];
        const validGroups = ['none', 'hour', 'day', 'week'];

        if (!start && !validRanges.includes(range)) {
            return res.status(400).json({ error: 'Invalid range. Use 1d, 1w, or 1m' });
        }

        if (!validGroups.includes(group)) {
            return res.status(400).json({ error: 'Invalid group. Use none, hour, day, or week' });
        }

        const result = await trafficService.getGraphTraffic(graphId, range, group, start, end);
        res.json(result);
    } catch (error) {
        console.error('getGraphData error:', error);
        if (error.message === 'Graph not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};

const getTopUsage = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT host_id, field_name, field_value, present 
            FROM host_snmp_cache 
            WHERE field_name IN('ifInOctets', 'ifOutOctets', 'ifHCInOctets')
            LIMIT 10
            `);
        res.json({
            note: "Menarik top usage dari MySQL. Perlu diketahui bahwa data bandwidth tersimpan di RRD, bukan di DB. Direkomendasikan melakukan background parsing setiap 5 menit ke tabel cache database jika butuh data urut.",
            data: rows
        });
    } catch (err) {
        console.error('getTopUsage error:', err);
        res.status(500).json({ error: 'Gagal memproses top usage' });
    }
};

module.exports = { getTraffic: getGraphData, getGraphData, getTopUsage };
