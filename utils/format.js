/**
 * Robust price formatter that handles regional currency symbols and USD conversions.
 * @param {number|string} value - The numeric price value.
 * @param {string} region - The region string (e.g., 'UK Stores', 'Canada Stores').
 * @returns {string} - Formatted price string.
 */
export const formatPriceDisplay = (value, region) => {
    if (!value || isNaN(value) || value === 0) {
        return null;
    }

    const num = parseFloat(value);

    // Special handling for Canada
    if (region?.includes('Canada')) {
        const usd = (num * 0.73).toFixed(0);
        return `CAD ${num.toFixed(2)} (USD ${usd})`;
    }

    // Use Intl for standard currency formatting
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: region?.includes('UK') ? 'GBP' : 'USD',
        minimumFractionDigits: 2
    }).format(num);

    // Special handling for UK (Add USD conversion estimate)
    if (region?.includes('UK')) {
        const usd = (num * 1.25).toFixed(0);
        return `${formatted} (USD ${usd})`;
    }

    return formatted;
};

/**
 * Returns only the currency symbol for a given region.
 * @param {string} region 
 * @returns {string}
 */
export const getCurrencySymbol = (region) => {
    if (region?.includes('UK')) return '£';
    if (region?.includes('Canada')) return 'CAD ';
    return '$';
};
