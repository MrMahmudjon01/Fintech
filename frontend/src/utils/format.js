/**
 * Summani chiroyli formatda ko'rsatish: 1234567.89 -> "1 234 567.89"
 * @param {number|string} amount
 * @param {boolean} showDecimal - kasr qismini ko'rsatish (default: false)
 * @returns {string}
 */
export function formatMoney(amount, showDecimal = false) {
    const num = parseFloat(amount) || 0;
    const fixed = showDecimal ? num.toFixed(2) : Math.round(num).toString();
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
}
