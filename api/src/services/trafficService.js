const db = require('../config/database');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const { resolveTimeRange } = require('../utils/timeHelper');
const { aggregateData } = require('../utils/aggregationHelper');
const { calculateSummary } = require('../utils/trafficHelper');

const execPromise = util.promisify(exec);

/**
 * Service to handle traffic data logic
 */
class TrafficService {
    async fetchRRD(rrdPath, start, end) {
        let cmd = `rrdtool fetch "${rrdPath}" AVERAGE -s ${start} -e ${end}`;
        let stdout;

        if (process.env.USE_REMOTE_RRD === 'true' || process.env.USE_REMOTE_RRD === true) {
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

            console.log(`Connecting to SSH: ${sshConfig.host}:${sshConfig.port} as ${sshConfig.username}`);
            const ssh = new SSH2Promise(sshConfig);
            try {
                await ssh.connect();
                console.log('SSH Connected successfully');
                stdout = await ssh.exec(cmd);
            } catch (authError) {
                console.error('SSH Connection/Auth Failed:', authError.message);
                throw authError;
            } finally {
                ssh.close();
            }
        } else {
            const result = await execPromise(cmd);
            stdout = result.stdout;
        }

        return stdout;
    }

    parseRRDOutput(stdout) {
        const lines = stdout.trim().split('\n');
        if (lines.length < 3) return [];

        const headers = lines[0].trim().split(/\s+/);
        const data = [];

        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const parts = line.split(':');
            const timestamp = parseInt(parts[0].trim(), 10) * 1000;
            const values = parts[1].trim().split(/\s+/);

            const row = { timestamp };
            headers.forEach((h, index) => {
                const val = parseFloat(values[index]);
                row[h] = isNaN(val) ? null : val;
            });

            // Convert traffic_in/traffic_out to bits/sec if they exist
            // Assuming default RRD precision is bytes/sec for standard Cacti templates
            // We multiply by 8 to get bits/sec as requested by user
            if (row.traffic_in !== undefined && row.traffic_in !== null) row.traffic_in *= 8;
            if (row.traffic_out !== undefined && row.traffic_out !== null) row.traffic_out *= 8;

            data.push(row);
        }

        return data;
    }

    async getGraphTraffic(graphId, range = '1m', group = 'none', customStart = null, customEnd = null) {
        const { start, end } = resolveTimeRange(range, customStart, customEnd);

        // Get RRD path from database
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

        if (!rows || rows.length === 0) {
            throw new Error('Graph not found');
        }

        let rrdPath = rows[0].data_source_path.replace('<path_rra>', process.env.RRD_PATH);
        if (!rrdPath.startsWith('/')) rrdPath = path.join(process.env.RRD_PATH, rrdPath);

        const templateName = rows[0].template_name || '';
        const isBits = templateName.toLowerCase().includes('bits');

        const stdout = await this.fetchRRD(rrdPath, start, end);
        const rawData = this.parseRRDOutput(stdout);

        const summary = calculateSummary(rawData, isBits);
        const processedData = aggregateData(rawData, group);

        return {
            graph_info: {
                graph_id: parseInt(graphId, 10),
                title: rows[0].title,
                template_name: rows[0].template_name
            },
            summary,
            range,
            group,
            data: processedData
        };
    }
}

module.exports = new TrafficService();
