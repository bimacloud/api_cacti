/**
 * Helper to resolve range string (1d, 1w, 1m) into start and end timestamps (seconds)
 */
const resolveTimeRange = (range = '1m') => {
    const end = Math.floor(Date.now() / 1000);
    let start;

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
