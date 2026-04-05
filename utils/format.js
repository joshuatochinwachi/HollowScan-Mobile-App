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
 * Dynamically formats IAP prices from Apple/Google Store.
 * Extracts symbol and ensures 2 decimal places without hardcoding.
 * @param {string} rawPrice - The raw string from the store (e.g. "£4.99" or "$4.990001")
 * @returns {string} - Cleanly formatted price
 */
export const formatIAPPrice = (rawPrice) => {
    if (!rawPrice) return '';
    
    // 1. Extract the numeric part (handling both . and , as decimals potentially, 
    // but parseFloat usually wants .)
    const cleanNumericStr = rawPrice.replace(/[^0-9.]/g, '');
    const numericPart = parseFloat(cleanNumericStr);
    
    if (isNaN(numericPart)) return rawPrice;

    // 2. Identify the symbol (everything that isn't a digit, dot, comma, or space)
    const symbol = rawPrice.replace(/[0-9., ]/g, '').trim();
    
    // 3. Determine symbol position (is it at the start or end of the original string?)
    const trimmedRaw = rawPrice.trim();
    const isSymbolAtStart = trimmedRaw.startsWith(symbol);
    const isSymbolAtEnd = trimmedRaw.endsWith(symbol);

    // 4. Format the number to exactly 2 decimal places to fix floating point glitches
    const formattedNum = numericPart.toFixed(2);

    // 5. Reconstruct the string preserving position
    if (isSymbolAtEnd) {
        return `${formattedNum} ${symbol}`.trim();
    } else if (isSymbolAtStart) {
        return `${symbol}${formattedNum}`;
    }

    // Fallback: If we can't determine position, default to symbol-first
    return `${symbol}${formattedNum}`;
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
