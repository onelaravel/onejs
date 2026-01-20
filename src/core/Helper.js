/**
 * ViewHelper - Utility functions for view operations
 * Contains helper methods that are not directly related to view management
 */

import { uniqId } from '../helpers/utils.js';
import DOMBatcher from './DOMBatcher.js';

export class Helper {
    constructor(App = null) {
        this.App = App;
        this.config = {};
    }

    setApp(App) {
        this.App = App;
    }
    setConfig(config) {
        let { base_url } = config;
        if (base_url && base_url.endsWith('/')) {
            base_url = base_url.slice(0, -1);
        }
        this.config = {
            ...this.config,
            base_url
        };
    }

    /**
     * Get URL
     * @param {string} path - Path to append to base URL
     * @returns {string} Full URL
     */
    url(path = '') {
        const baseUrl = typeof this.config?.base_url === 'string' ? this.config.base_url : '';
        return `${baseUrl}${path ? (path.startsWith('/') ? path : `/${path}`) : ''}`;
    }

    /**
     * Trim string
     * @param {string} str - String to trim
     * @param {string} char - Character to trim
     * @returns {string} Trimmed string
     */
    trim(str, char = ' ') {
        if (typeof str !== 'string') return str;
        const regex = new RegExp(`^${char}+|${char}+$`, 'g');
        return str.replace(regex, '');
    }

    /**
     * Check if string is HTML
     * @param {string} str - String to check
     * @returns {boolean} True if HTML
     */
    isHtmlString(str) {
        if (typeof str !== 'string') return false;
        return /<[a-z][\s\S]*>/i.test(str);
    }

    substr(str, start, length) {
        if (typeof str !== 'string') return str;
        return str.substring(start, length);
    }

    strtolower(str) {
        if (typeof str !== 'string') return str;
        return str.toLowerCase();
    }

    strtoupper(str) {
        if (typeof str !== 'string') return str;
        return str.toUpperCase();
    }


    /**
     * Format date
     * @param {Date|string} date - Date to format
     * @param {string} format - Format string
     * @returns {string} Formatted date
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * Format number
     * @param {number} num - Number to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted number
     */
    formatNumber(num, options = {}) {
        if (typeof num !== 'number' || isNaN(num)) return '0';

        const {
            decimals = 2,
            thousandsSeparator = ',',
            decimalSeparator = '.',
            prefix = '',
            suffix = ''
        } = options;

        const parts = num.toFixed(decimals).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

        return prefix + parts.join(decimalSeparator) + suffix;
    }

    /**
     * PHP-like number_format function
     * @param {number} number - Number to format
     * @param {number} decimals - Number of decimal points (default: 0)
     * @param {string} decimalSeparator - Decimal separator (default: '.')
     * @param {string} thousandsSeparator - Thousands separator (default: ',')
     * @returns {string} Formatted number
     */
    number_format(number, decimals = 0, decimalSeparator = '.', thousandsSeparator = ',') {
        // Convert to number if string
        const num = typeof number === 'string' ? parseFloat(number) : number;
        
        if (typeof num !== 'number' || isNaN(num)) return '0';

        // Use toFixed for decimal precision
        const parts = num.toFixed(decimals).split('.');
        
        // Add thousands separator
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

        // Join integer and decimal parts
        return decimals > 0 ? parts.join(decimalSeparator) : parts[0];
    }

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @returns {string} Formatted currency
     */
    formatCurrency(amount, currency = 'USD') {
        const currencySymbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'VND': '₫'
        };

        const symbol = currencySymbols[currency] || currency;
        return symbol + this.formatNumber(amount, { decimals: 2 });
    }

    /**
     * Truncate text
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @param {string} suffix - Suffix to add
     * @returns {string} Truncated text
     */
    truncate(text, length = 100, suffix = '...') {
        if (typeof text !== 'string' || text.length <= length) {
            return text;
        }
        return text.substring(0, length).trim() + suffix;
    }

    /**
     * Generate random string
     * @param {number} length - Length of string
     * @returns {string} Random string
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Deep clone object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
        return obj;
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit time in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }


    /**
     * Get URL parameters
     * @param {string} url - URL to parse
     * @returns {Object} URL parameters
     */
    getUrlParams(url = window.location.href) {
        const params = {};
        const urlObj = new URL(url);
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }

    /**
     * Build URL with parameters
     * @param {string} baseUrl - Base URL
     * @param {Object} params - Parameters to add
     * @returns {string} Built URL
     */
    buildUrl(baseUrl, params = {}) {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });
        return url.toString();
    }

    /**
     * Check if element is in viewport
     * Uses DOMBatcher for optimized read operations
     * 
     * @param {Element} element - Element to check
     * @param {boolean} useBatcher - Use DOMBatcher for batched reads (default: false)
     * @returns {boolean|Promise<boolean>} True if in viewport (or Promise if batched)
     */
    isInViewport(element, useBatcher = false) {
        if (useBatcher) {
            return DOMBatcher.read(() => {
                const rect = element.getBoundingClientRect();
                return (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
            });
        }
        
        // Legacy synchronous behavior
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Scroll to element
     * @param {Element|string} element - Element or selector
     * @param {Object} options - Scroll options
     */
    scrollTo(element, options = {}) {
        const target = typeof element === 'string' ? document.querySelector(element) : element;
        if (!target) return;

        const {
            behavior = 'smooth',
            block = 'start',
            inline = 'nearest',
            offset = 0
        } = options;

        const targetPosition = target.offsetTop - offset;
        window.scrollTo({
            top: targetPosition,
            behavior
        });
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Get device type
     * @returns {string} Device type
     */
    getDeviceType() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }

    // ============================================================================
    // ADDITIONAL UTILITY FUNCTIONS (moved from View)
    // ============================================================================

    /**
     * Count items
     * @param {Array|Object} items - Items to count
     * @returns {number} Count
     */
    count(items) {
        if (Array.isArray(items)) {
            return items.length;
        } else if (typeof items === 'object' && items !== null) {
            return Object.keys(items).length;
        }
        return 0;
    }

    /**
     * Check if value is null
     * @param {*} value - Value to check
     * @returns {boolean} True if null
     */
    isNull(value) {
        return value === null;
    }

    /**
     * Check if value is array
     * @param {*} value - Value to check
     * @returns {boolean} True if array
     */
    isArray(value) {
        return Array.isArray(value);
    }

    /**
     * Check if value is string
     * @param {*} value - Value to check
     * @returns {boolean} True if string
     */
    isString(value) {
        return typeof value === 'string';
    }

    /**
     * Check if value is numeric
     * @param {*} value - Value to check
     * @returns {boolean} True if numeric
     */
    isNumeric(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    /**
     * Get current timestamp with format method
     * @returns {Object} Current timestamp with format method
     */
    now() {
        const now = new Date();
        return {
            format: function (format) {
                if (!format) return now.toISOString();

                // Simple format implementation
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');

                return format
                    .replace('Y', year)
                    .replace('m', month)
                    .replace('d', day)
                    .replace('H', hours)
                    .replace('i', minutes)
                    .replace('s', seconds);
            },
            getTime: function () {
                return now.getTime();
            },
            toString: function () {
                return now.toString();
            }
        };
    }

    /**
     * Get current date
     * @returns {Date} Current date
     */
    today() {
        return new Date();
    }

    /**
     * Format date theo PHP date format
     * @param {string} format - Format string (PHP style: Y-m-d H:i:s)
     * @param {Date|string|number} dateValue - Date value (optional, mặc định: current date)
     * @returns {string} Formatted date
     * 
     * @example
     * date('Y-m-d') // '2025-01-21'
     * date('Y-m-d H:i:s') // '2025-01-21 10:30:45'
     * date('d/m/Y', new Date('2025-01-21')) // '21/01/2025'
     * date('l, F j, Y') // 'Tuesday, January 21, 2025'
     */
    date(format = 'Y-m-d H:i:s', dateValue = null) {
        try {
            const d = dateValue ? new Date(dateValue) : new Date();
            
            // Validate date
            if (isNaN(d.getTime())) {
                console.warn('App.Helper.date: Invalid date value', dateValue);
                return '';
            }
            
            // Map PHP date format to JavaScript
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
            const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
            
            // Day names
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            // Build replacement map (order matters - longer tokens first)
            const replacements = [
                // Year (4-digit first, then 2-digit)
                { pattern: /YYYY/g, value: year },
                { pattern: /YY/g, value: String(year).slice(-2) },
                { pattern: /Y/g, value: year },
                { pattern: /y/g, value: String(year).slice(-2) },
                
                // Month (full names first, then short, then numeric)
                { pattern: /MMMM/g, value: monthNamesFull[d.getMonth()] },
                { pattern: /MMM/g, value: monthNames[d.getMonth()] },
                { pattern: /MM/g, value: month },
                { pattern: /M/g, value: monthNames[d.getMonth()] },
                { pattern: /F/g, value: monthNamesFull[d.getMonth()] },
                { pattern: /m/g, value: month },
                { pattern: /n/g, value: String(d.getMonth() + 1) },
                { pattern: /t/g, value: String(new Date(year, d.getMonth() + 1, 0).getDate()) },
                
                // Day (full names first, then short, then numeric)
                { pattern: /DDDD/g, value: dayNamesFull[dayOfWeek] },
                { pattern: /DDD/g, value: dayNames[dayOfWeek] },
                { pattern: /DD/g, value: day },
                { pattern: /D/g, value: dayNames[dayOfWeek] },
                { pattern: /l/g, value: dayNamesFull[dayOfWeek] },
                { pattern: /d/g, value: day },
                { pattern: /j/g, value: String(d.getDate()) },
                { pattern: /N/g, value: dayOfWeek === 0 ? '7' : String(dayOfWeek) },
                { pattern: /w/g, value: String(dayOfWeek) },
                { pattern: /z/g, value: String(dayOfYear) },
                
                // Time (24-hour first, then 12-hour)
                { pattern: /HH/g, value: hours },
                { pattern: /H/g, value: hours },
                { pattern: /G/g, value: String(d.getHours()) },
                { pattern: /hh/g, value: String(d.getHours() % 12 || 12).padStart(2, '0') },
                { pattern: /h/g, value: String(d.getHours() % 12 || 12).padStart(2, '0') },
                { pattern: /g/g, value: String(d.getHours() % 12 || 12) },
                { pattern: /ii/g, value: minutes },
                { pattern: /i/g, value: minutes },
                { pattern: /mm/g, value: minutes },
                { pattern: /ss/g, value: seconds },
                { pattern: /s/g, value: seconds },
                { pattern: /a/g, value: d.getHours() < 12 ? 'am' : 'pm' },
                { pattern: /A/g, value: d.getHours() < 12 ? 'AM' : 'PM' },
                
                // Timezone
                { pattern: /P/g, value: this._getTimezoneOffset(d, true) },
                { pattern: /O/g, value: this._getTimezoneOffset(d) },
                { pattern: /T/g, value: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
                
                // Timestamp
                { pattern: /U/g, value: String(Math.floor(d.getTime() / 1000)) },
            ];
            
            // Apply replacements in order
            let result = format;
            for (const { pattern, value } of replacements) {
                result = result.replace(pattern, value);
            }
            
            // Handle escape characters (remove backslashes before next char)
            result = result.replace(/\\(.)/g, '$1');
            
            return result;
        }
        catch (error) {
            console.error('App.Helper.date error:', error);
            return '';
        }
    }

    /**
     * Get timezone offset
     * @private
     * @param {Date} date - Date object
     * @param {boolean} withColon - Include colon in offset
     * @returns {string} Timezone offset
     */
    _getTimezoneOffset(date, withColon = false) {
        const offset = -date.getTimezoneOffset();
        const sign = offset >= 0 ? '+' : '-';
        const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
        const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
        return withColon ? `${sign}${hours}:${minutes}` : `${sign}${hours}${minutes}`;
    }


    /**
     * Get environment value
     * @param {string} key - Environment key
     * @param {*} defaultValue - Default value
     * @returns {*} Environment value
     */
    env(key, defaultValue = null) {
        // This should be implemented based on your environment system
        // For now, return default value as placeholder
        return defaultValue;
    }

    // ============================================================================
    // PHP-LIKE FUNCTIONS (for Blade compatibility)
    // ============================================================================

    /**
     * Hàm tương tự như PHP: ucfirst
     * Viết hoa ký tự đầu tiên của chuỗi
     * @param {string} str
     * @returns {string}
     */
    ucfirst(str) {
        if (typeof str !== 'string' || str.length === 0) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Hàm tương tự như PHP: lcfirst
     * Viết thường ký tự đầu tiên của chuỗi
     * @param {string} str
     * @returns {string}
     */
    lcfirst(str) {
        if (typeof str !== 'string' || str.length === 0) return str;
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    /**
     * Hàm tương tự như PHP: str_replace
     * Thay thế tất cả các chuỗi con trong chuỗi
     * @param {string|string[]} search
     * @param {string|string[]} replace
     * @param {string} subject
     * @returns {string}
     */
    str_replace(search, replace, subject) {
        if (Array.isArray(search)) {
            let result = subject;
            search.forEach((s, i) => {
                const r = Array.isArray(replace) ? (replace[i] !== undefined ? replace[i] : '') : replace;
                result = result.split(s).join(r);
            });
            return result;
        } else {
            return subject.split(search).join(replace);
        }
    }

    /**
     * Hàm tương tự như PHP: explode
     * Cắt chuỗi thành mảng theo ký tự phân tách
     * @param {string} delimiter
     * @param {string} str
     * @returns {Array}
     */
    explode(delimiter, str) {
        if (typeof str !== 'string' || typeof delimiter !== 'string') return [];
        return str.split(delimiter);
    }

    /**
     * Hàm tương tự như PHP: implode
     * Nối các phần tử của mảng thành chuỗi với ký tự phân tách
     * @param {string} glue
     * @param {Array} pieces
     * @returns {string}
     */
    implode(glue, pieces) {
        if (!Array.isArray(pieces)) return '';
        return pieces.join(glue);
    }

    /**
     * Hàm tương tự như PHP: in_array
     * Kiểm tra giá trị có trong mảng không
     * @param {any} needle
     * @param {Array} haystack
     * @returns {boolean}
     */
    in_array(needle, haystack) {
        if (!Array.isArray(haystack)) return false;
        return haystack.includes(needle);
    }

    /**
     * Hàm tương tự như PHP: array_unique
     * Loại bỏ các phần tử trùng lặp trong mảng
     * @param {Array} arr
     * @returns {Array}
     */
    array_unique(arr) {
        if (!Array.isArray(arr)) return [];
        return Array.from(new Set(arr));
    }

    /**
     * Hàm tương tự như PHP: array_merge
     * Gộp nhiều mảng thành một mảng
     * @param  {...Array} arrays
     * @returns {Array}
     */
    array_merge(...arrays) {
        return [].concat(...arrays);
    }

    /**
     * Hàm tương tự như PHP: is_array
     * Kiểm tra biến có phải là mảng không
     * @param {any} value
     * @returns {boolean}
     */
    is_array(value) {
        return Array.isArray(value);
    }

    /**
     * Hàm tương tự như PHP: is_string
     * Kiểm tra biến có phải là chuỗi không
     * @param {any} value
     * @returns {boolean}
     */
    is_string(value) {
        return typeof value === 'string';
    }

    /**
     * Hàm tương tự như PHP: is_numeric
     * Kiểm tra biến có phải là số hoặc chuỗi số không
     * @param {any} value
     * @returns {boolean}
     */
    is_numeric(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    /**
     * Hàm tương tự như PHP: empty
     * Kiểm tra biến có "rỗng" không (null, undefined, '', 0, false, [], {})
     * @param {any} value
     * @returns {boolean}
     */
    empty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (Array.isArray(value) && value.length === 0) return true;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return true;
        if (value === false) return true;
        if (value === 0) return true;
        return false;
    }

    /**
     * Hàm tương tự như PHP: isset
     * Kiểm tra biến có được định nghĩa và khác null không
     * @param {any} value
     * @returns {boolean}
     */
    isset(value) {
        return value !== undefined && value !== null;
    }

    /**
     * Hàm tương tự như PHP: json_encode
     * Chuyển đổi giá trị thành chuỗi JSON
     * @param {any} value
     * @returns {string}
     */
    json_encode(value) {
        return JSON.stringify(value);
    }

    /**
     * Hàm tương tự như PHP: json_decode
     * Chuyển đổi chuỗi JSON thành giá trị
     * @param {string} value
     * @returns {any}
     */
    json_decode(value) {
        return JSON.parse(value);
    }

    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile
     */
    isMobile() {
        return this.getDeviceType() === 'mobile';
    }

    /**
     * Check if device is tablet
     * @returns {boolean} True if tablet
     */
    isTablet() {
        return this.getDeviceType() === 'tablet';
    }

    /**
     * Check if device is desktop
     * @returns {boolean} True if desktop
     */
    isDesktop() {
        return this.getDeviceType() === 'desktop';
    }
}
