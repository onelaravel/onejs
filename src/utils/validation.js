/**
 * Validation Utility Module
 * ES6 Module for Blade Compiler
 */

export class Validation {
    static isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isPhone(phone) {
        const phoneRegex = /^[0-9]{10,11}$/;
        return phoneRegex.test(phone);
    }

    static isRequired(value) {
        return value !== null && value !== undefined && value !== '';
    }

    static minLength(value, min) {
        return value && value.length >= min;
    }

    static maxLength(value, max) {
        return value && value.length <= max;
    }
}


// Export for ES6 modules
export default Validation;
