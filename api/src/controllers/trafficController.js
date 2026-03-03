const db = require('../config/database');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const NodeCache = require('node-cache');
const fs = require('fs');

const execPromise = util.promisify(exec);
const cache = new NodeCache({ stdTTL: 30, checkperiod: 30 });

// Fungsi Helper untuk RRD Fetch (Bisa lokal, bisa remote via SSH)
const fetchRRD = async (rrdPath, start = '-1h', end = 'now', resolution = null) => {
    // Bangun perintah rrdtool
    let cmd = `rrdtool fetch "${rrdPath}" AVERAGE`;
    if (resolution) cmd += ` -r ${resolution}`;
    cmd += ` -s ${start} -e ${end}`;

    let stdout;

    if (process.env.USE_REMOTE_RRD === 'true') {
        const SSH2Promise = require('ssh2-promise');
        const sshConfig = {
            host: process.env.SSH_HOST,
            username: process.env.SSH_USER,
            port: process.env.SSH_PORT ? parseInt(process.env.SSH_PORT) : 22
        };

        if (process.env.SSH_KEY_PATH && fs.existsSync(process.env.SSH_KEY_PATH)) {
            sshConfig.identity = process.env.SSH_KEY_PATH;
        } else {
            sshConfig.password = process.env.SSH_PASS;
        }

        const ssh = new SSH2Promise(sshConfig);
        try {
            await ssh.connect();
            stdout = await ssh.exec(cmd);
        } finally {
            ssh.close();
        }
    } else {
        const result = await execPromise(cmd);
        stdout = result.stdout;
    }

    return stdout;
};


const getTraffic = async (req, res) => {
    const graphId = req.params.graph_id;

    // Ambil parameter tanggal dari query (contoh: ?start=2024-02-01&end=2024-03-01)
    // Gunakan default '-1h' dan 'now' jika tidak disediakan
    let start = req.query.start ? req.query.start : '-1h';
    let end = req.query.end ? req.query.end : 'now';
    let resolution = req.query.resolution ? req.query.resolution : null;

    // Jika user memberikan format YYYY-MM-DD, kita ubah ke timestamp epoch
    const parseDate = (dateStr) => {
        if (!dateStr || dateStr.startsWith('-') || dateStr === 'now') return dateStr;
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? dateStr : Math.floor(parsed.getTime() / 1000);
    };

    start = parseDate(start);
    end = parseDate(end);

    const cacheKey = `traffic_${graphId}_${start}_${end}_${resolution || 'auto'}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json({ cached: true, data: cachedData });

    try {
        const [rows] = await db.query(`
            SELECT dtd.data_source_path, gtg.title_cache as title, gt.name as template_name
            FROM graph_templates_item gti
            JOIN data_template_rrd dtr ON gti.task_item_id = dtr.id
            JOIN data_template_data dtd ON dtr.local_data_id = dtd.local_data_id
            LEFT JOIN graph_templates_graph gtg ON gti.local_graph_id = gtg.local_graph_id
            LEFT JOIN graph_templates gt ON gtg.graph_template_id = gt.id
            WHERE gti.local_graph_id = ? 
            LIMIT 1
        `, [graphId]);

        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].data_source_path) {
            return res.status(404).json({ error: 'RRD file associated with this graph not found' });
        }

        let rrdPath = rows[0].data_source_path.replace('<path_rra>', process.env.RRD_PATH);
        if (!rrdPath.startsWith('/')) rrdPath = path.join(process.env.RRD_PATH, rrdPath);

        const stdout = await fetchRRD(rrdPath, start, end, resolution);

        const lines = stdout.trim().split('\n');
        if (lines.length < 3) throw new Error('Data RRD Kosong');

        const headers = lines[0].trim().split(/\s+/);
        const data = [];

        let total_in = 0;
        let total_out = 0;

        let max_in = 0;
        let max_out = 0;
        let current_in = 0;
        let current_out = 0;
        let sum_in = 0; // For average calculation
        let sum_out = 0;
        let count_in = 0;
        let count_out = 0;

        let prev_timestamp = null;

        // Fungsi format bytes/bits menjadi human-readable (KB, MB, GB, dsb)
        // Jika nama template mengandung 'bits/sec', kita asumsikan datanya adalah bit, jika tidak maka byte
        // Cacti biasanya menyimpan semua DS menggunakan tipe data Gauge/Counter yang mewakili satuan dasarnya
        const template_name = rows[0].template_name || '';
        const isBits = template_name.toLowerCase().includes('bits');

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const parts = line.split(':');
            const currentTimestamp = parseInt(parts[0].trim(), 10);
            const values = parts[1].trim().split(/\s+/);
            const row = { timestamp: currentTimestamp * 1000 };

            headers.forEach((h, index) => {
                const val = parseFloat(values[index]);
                row[h] = isNaN(val) ? null : val;
            });

            // Hitung akumulasi byte/bit per baris jika data ada
            if (prev_timestamp) {
                const timeDiff = currentTimestamp - prev_timestamp; // in seconds

                // Asumsi standard nama DS di cacti rrd: traffic_in dan traffic_out
                let t_in = row.traffic_in;
                let t_out = row.traffic_out;

                // Cacti Interface - Traffic menyimban data dalam format Bytes
                // Jika template adalah bits/sec, kalikan nilainya dengan 8
                if (isBits) {
                    t_in = t_in != null ? t_in * 8 : null;
                    t_out = t_out != null ? t_out * 8 : null;
                }

                if (t_in != null) {
                    total_in += t_in * timeDiff;
                    sum_in += t_in;
                    count_in++;
                    if (t_in > max_in) max_in = t_in;
                    current_in = t_in; // Selalu update ke nilai terakhir yang valid
                }
                if (t_out != null) {
                    total_out += t_out * timeDiff;
                    sum_out += t_out;
                    count_out++;
                    if (t_out > max_out) max_out = t_out;
                    current_out = t_out;
                }
            }

            prev_timestamp = currentTimestamp;
            data.push(row);
        }

        const formatTraffic = (value, asBits, isSpeed = false) => {
            if (value === 0 || !value) return '0 ' + (asBits ? 'b' : 'B') + (isSpeed ? '/s' : '');
            const k = 1000; // Standar RRD jaringan menggunakan 1000 untuk kilo (kbit/kbyte), bukan 1024
            const sizes = asBits ? ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb'] : ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
            const i = Math.floor(Math.log(value) / Math.log(k));
            return parseFloat((value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i] + (isSpeed ? '/s' : '');
        };

        // Hitung real timespan dari total waktu data rrd (mengamankan jika 'start' atau 'end' berupa custom string seperti 'now')
        const real_start = data.length > 0 ? data[0].timestamp / 1000 : start;
        const real_end = data.length > 0 ? data[data.length - 1].timestamp / 1000 : real_start;

        const avg_in = count_in > 0 ? sum_in / count_in : 0;
        const avg_out = count_out > 0 ? sum_out / count_out : 0;

        const summary = {
            total_in_raw: total_in,
            total_out_raw: total_out,
            total_in_formatted: formatTraffic(total_in, isBits, false),
            total_out_formatted: formatTraffic(total_out, isBits, false),

            current_in_formatted: formatTraffic(current_in, isBits, true),
            current_out_formatted: formatTraffic(current_out, isBits, true),

            average_in_formatted: formatTraffic(avg_in, isBits, true),
            average_out_formatted: formatTraffic(avg_out, isBits, true),

            max_in_formatted: formatTraffic(max_in, isBits, true),
            max_out_formatted: formatTraffic(max_out, isBits, true),

            time_range_seconds: real_end - real_start,
            data_type: isBits ? 'bits' : 'bytes'
        };

        const graph_info = {
            graph_id: parseInt(graphId, 10),
            title: rows[0].title || 'Unknown Graph',
            template_name: rows[0].template_name || 'Unknown Template'
        };

        const resultData = { cached: false, graph_info, summary, data };
        cache.set(cacheKey, resultData);
        res.json(resultData);
    } catch (error) {
        console.error('getTraffic error:', error);
        res.status(500).json({ error: 'Gagal memproses file RRD traffic: ' + error.message });
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

module.exports = { getTraffic, getTopUsage };
