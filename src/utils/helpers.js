/**
 * Helpers Utility Module
 * ES6 Module for Blade Compiler
 */

import { App } from '../app.js';

export class Helpers {
    static formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    static formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    static debounce(func, wait) {
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
}

// Register with global App object
if (typeof window !== 'undefined') {
    window.App.Helpers = Helpers;
}

// Export for ES6 modules
export default Helpers;
