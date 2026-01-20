/**
 * Register parser
 */

class RegisterParser {
    constructor() {
        this.parseRegisterContent = {};
    }

    parseRegisterContent(registerContent) {
        /** Parse register content */
        if (!registerContent || !registerContent.trim()) {
            return {};
        }
        
        try {
            // Try to parse as JSON
            return JSON.parse(registerContent);
        } catch (e) {
            // If not valid JSON, return empty object
            return {};
        }
    }

    reset() {
        /** Reset parser state */
        this.parseRegisterContent = {};
    }
}

module.exports = RegisterParser;

