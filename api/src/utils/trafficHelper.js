/**
 * Helper for traffic formatting and calculations
 */

const formatTraffic = (value, asBits = true, isSpeed = false) => {
    if (value === 0 || !value) return '0 ' + (asBits ? 'b' : 'B') + (isSpeed ? '/s' : '');
    const k = 1000;
    const sizes = asBits ? ['b', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb'] : ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.floor(Math.log(value) / Math.log(k));
    if (i < 0) return value.toFixed(2) + ' ' + sizes[0] + (isSpeed ? '/s' : '');
    return parseFloat((value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i] + (isSpeed ? '/s' : '');
};

const calculateSummary = (data, isBits = true) => {
    let total_in = 0;
    let total_out = 0;
    let max_in = 0;
    let max_out = 0;
    let current_in = 0;
    let current_out = 0;
    let sum_in = 0;
    let sum_out = 0;
    let count_in = 0;
    let count_out = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const t_in = row.traffic_in;
        const t_out = row.traffic_out;

        // For summary, we need timeDiff for total volume. 
        // We can estimate based on gap between timestamps.
        let timeDiff = 0;
        if (i > 0) {
            timeDiff = (data[i].timestamp - data[i - 1].timestamp) / 1000;
        }

        if (t_in != null) {
            total_in += t_in * timeDiff;
            sum_in += t_in;
            count_in++;
            if (t_in > max_in) max_in = t_in;
            current_in = t_in;
        }
        if (t_out != null) {
            total_out += t_out * timeDiff;
            sum_out += t_out;
            count_out++;
            if (t_out > max_out) max_out = t_out;
            current_out = t_out;
        }
    }

    const avg_in = count_in > 0 ? sum_in / count_in : 0;
    const avg_out = count_out > 0 ? sum_out / count_out : 0;

    const real_start = data.length > 0 ? data[0].timestamp / 1000 : 0;
    const real_end = data.length > 0 ? data[data.length - 1].timestamp / 1000 : 0;

    return {
        total_in_raw: Math.round(total_in),
        total_out_raw: Math.round(total_out),
        total_in_formatted: formatTraffic(total_in, isBits, false),
        total_out_formatted: formatTraffic(total_out, isBits, false),
        current_in_formatted: formatTraffic(current_in, isBits, true),
        current_out_formatted: formatTraffic(current_out, isBits, true),
        average_in_formatted: formatTraffic(avg_in, isBits, true),
        average_out_formatted: formatTraffic(avg_out, isBits, true),
        max_in_formatted: formatTraffic(max_in, isBits, true),
        max_out_formatted: formatTraffic(max_out, isBits, true),
        time_range_seconds: Math.round(real_end - real_start),
        data_type: isBits ? 'bits' : 'bytes'
    };
};

module.exports = { formatTraffic, calculateSummary };
