const db = require('../config/database');

const getDevices = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, hostname, description, status 
            FROM host 
            WHERE deleted = ''
        `);
        res.json({ data: rows });
    } catch (error) {
        console.error('getDevices error:', error);
        res.status(500).json({ error: 'Database query error.' });
    }
};

const getDeviceById = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, hostname, description, status, snmp_community, snmp_version
            FROM host 
            WHERE id = ? AND deleted = '' 
            LIMIT 1
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ error: 'Device not found' });
        res.json({ data: rows[0] });
    } catch (error) {
        console.error('getDeviceById error:', error);
        res.status(500).json({ error: 'Database query error.' });
    }
};

const getDeviceGraphs = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT gl.id as graph_id, gtg.title_cache as title, gt.name as template_name
            FROM graph_local gl
            LEFT JOIN graph_templates_graph gtg ON gl.id = gtg.local_graph_id
            LEFT JOIN graph_templates gt ON gl.graph_template_id = gt.id
            WHERE gl.host_id = ?
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ error: 'No graphs found for this device' });
        res.json({ data: rows });
    } catch (error) {
        console.error('getDeviceGraphs error:', error);
        res.status(500).json({ error: 'Database query error.' });
    }
};

module.exports = { getDevices, getDeviceById, getDeviceGraphs };
