/**
 * Helper to resolve range string (1d, 1w, 1m) into start and end timestamps (seconds)
 */
const resolveTimeRange = (range = '1m', customStart = null, customEnd = null) => {
    // Helper to parse date or timestamp
    const parseToTimestamp = (val) => {
        if (!val) return null;
        if (!isNaN(val)) return parseInt(val, 10); // Already a timestamp
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
    };

    let start = parseToTimestamp(customStart);
    let end = parseToTimestamp(customEnd) || Math.floor(Date.now() / 1000);

    if (start) {
        return { start, end };
    }

    // Default to range if no custom start
    switch (range) {
        case '1d':
            start = end - (24 * 60 * 60);
            break;
        case '1w':
            start = end - (7 * 24 * 60 * 60);
            break;
        case '1m':
        default:
            start = end - (30 * 24 * 60 * 60);
            break;
    }

    return { start, end };
};

module.exports = { resolveTimeRange };
