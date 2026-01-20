/**
 * Auto Plugin Module
 * This file in a subdirectory will be automatically discovered
 */

export class AutoPlugin {
    constructor() {
        this.name = 'AutoPlugin';
        this.type = 'plugin';
        this.version = '1.0.0';
    }

    initialize() {
        console.log(`🚀 ${this.name} initialized!`);
        return true;
    }

    getInfo() {
        return {
            name: this.name,
            type: this.type,
            version: this.version,
            timestamp: new Date().toISOString()
        };
    }
}

// Register with global App object
if (typeof window !== 'undefined' && window.App) {
    window.App.AutoPlugin = AutoPlugin;
}

// Export for ES6 modules
export default AutoPlugin;
