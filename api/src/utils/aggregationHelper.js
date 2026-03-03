/**
 * Helper to aggregate time-series data
 */

const getGroupLabel = (timestamp, group) => {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    if (group === 'hour') {
        return `${y}-${m}-${d} ${h}:00:00`;
    }
    if (group === 'day') {
        return `${y}-${m}-${d} 00:00:00`;
    }
    if (group === 'week') {
        const target = new Date(date.valueOf());
        const dayNr = (date.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        const week = 1 + Math.ceil((firstThursday - target) / 604800000);
        return `${y}-W${String(week).padStart(2, '0')}`;
    }
    // Default for 'none' or raw data
    return `${y}-${m}-${d} ${h}:${min}:00`;
};

const aggregateData = (rawData, group = 'none') => {
    if (group === 'none' || !group) {
        return rawData.map(item => ({
            ...item,
            label: getGroupLabel(item.timestamp, 'none')
        }));
    }

    const groups = {};

    rawData.forEach(item => {
        const label = getGroupLabel(item.timestamp, group);
        if (!label) return;

        if (!groups[label]) {
            groups[label] = {
                label,
                sum_in: 0,
                sum_out: 0,
                max_in: 0,
                max_out: 0,
                count_in: 0,
                count_out: 0
            };
        }

        const trafficIn = item.traffic_in;
        const trafficOut = item.traffic_out;

        if (trafficIn !== null && trafficIn !== undefined) {
            groups[label].sum_in += trafficIn;
            groups[label].count_in++;
            if (trafficIn > groups[label].max_in) groups[label].max_in = trafficIn;
        }

        if (trafficOut !== null && trafficOut !== undefined) {
            groups[label].sum_out += trafficOut;
            groups[label].count_out++;
            if (trafficOut > groups[label].max_out) groups[label].max_out = trafficOut;
        }
    });

    return Object.values(groups).map(g => ({
        label: g.label,
        avg_in: g.count_in > 0 ? Math.round(g.sum_in / g.count_in) : 0,
        avg_out: g.count_out > 0 ? Math.round(g.sum_out / g.count_out) : 0,
        max_in: Math.round(g.max_in),
        max_out: Math.round(g.max_out)
    }));
};

module.exports = { aggregateData };
