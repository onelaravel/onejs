import logger from "./LoggerService";

/**
 * StateService - Service quản lý state toàn cục với khả năng theo dõi thay đổi
 * Hỗ trợ chia sẻ dữ liệu giữa các view và component
 */
export class StateService {
    static instance = null;
    static privateProperties = [
        '__state', '__listeners', '__middlewares', '__isUpdating', 'instance',
        'get', 'set', 'delete', 'has', 'clear', 'subscribe', 'unsubscribe',
        'addMiddleware', 'removeMiddleware'
    ];
    dynamicProperties = [];

    constructor(initialState = {}) {
        this.__state = { ...initialState };
        this.__listeners = new Map(); // key -> Set of callbacks
        this.__middlewares = []; // Middleware functions
        this.__isUpdating = false;
        
        logger.log('🏪 StateService: Initialized with state:', this.__state);
        this.__init();
    }

    // ==========================================
    // PUBLIC STATIC METHODS
    // ==========================================

    /**
     * Get the singleton instance of StateService
     * @param {object} initialState - Initial state (only used on first call)
     * @returns {StateService} - The singleton instance
     */
    static getInstance(initialState = {}) {
        if (!StateService.instance) {
            StateService.instance = new StateService(initialState);
        }
        return StateService.instance;
    }

    __init() {
        Object.keys(this.__state).forEach(key => {
            this.__addDynamicProperty(key);
        });
        
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Core Operations
    // ==========================================

    /**
     * Get state value by key
     * @param {string} key - The key to get
     * @param {any} defaultValue - Default value if key not found
     * @returns {any} - The state value
     */
    get(key, defaultValue = undefined) {
        if (typeof key !== 'string') {
            throw new Error('State key must be a string');
        }
        
        const value = this.__getNestedValue(this.__state, key);
        logger.log(`📖 StateService: Get ${key}:`, value);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set state value by key
     * @param {string|object} key - The key to set, or object with multiple key-value pairs
     * @param {any} value - The value to set (ignored if key is object)
     * @param {boolean} silent - If true, don't trigger listeners
     * @returns {StateService} - Chainable
     */
    set(key, value = null, silent = false) {
        // If key is object, set multiple values
        if (typeof key === 'object' && key !== null) {
            for (const k in key) {
                if (Object.prototype.hasOwnProperty.call(key, k)) {
                    this.set(k, key[k], silent);
                }
            }
            return this;
        }

        if (typeof key !== 'string') {
            throw new Error('State key must be a string');
        }

        const oldValue = this.__getNestedValue(this.__state, key);
        
        // Apply middlewares
        const processedValue = this.__applyMiddlewares(key, oldValue, value, 'set');
        
        // Set the value
        this.__setNestedValue(this.__state, key, processedValue);
        
        logger.log(`💾 StateService: Set ${key}:`, processedValue);
        
        if (!silent) {
            this.__notifyListeners(key, processedValue, oldValue);
        }
        if (!this.dynamicProperties.includes(key)) {
            this.__addDynamicProperty(key);
        }
        
        return this;
    }

    /**
     * Delete state value by key
     * @param {string} key - The key to delete
     * @param {boolean} silent - If true, don't trigger listeners
     * @returns {boolean} - True if key was deleted
     */
    delete(key, silent = false) {
        if (typeof key !== 'string') {
            throw new Error('State key must be a string');
        }

        const oldValue = this.__getNestedValue(this.__state, key);
        const deleted = this.__deleteNestedValue(this.__state, key);
        
        if (deleted) {
            logger.log(`🗑️ StateService: Delete ${key}`);
            
            if (!silent) {
                this.__notifyListeners(key, undefined, oldValue);
            }
        }
        if (this.dynamicProperties.includes(key)) {
            this.__removeDynamicProperty(key);
        }
        return deleted;
    }

    /**
     * Check if state key exists
     * @param {string} key - The key to check
     * @returns {boolean} - True if key exists
     */
    has(key) {
        if (typeof key !== 'string') {
            throw new Error('State key must be a string');
        }
        
        const value = this.__getNestedValue(this.__state, key);
        return value !== undefined;
    }

    /**
     * Get all state
     * @returns {object} - Copy of all state
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.__state));
    }

    /**
     * Clear all state
     * @param {boolean} silent - If true, don't trigger listeners
     * @returns {StateService} - Chainable
     */
    clear(silent = false) {
        const oldState = { ...this.__state };
        this.__state = {};
        
        logger.log('🧹 StateService: Cleared all state');
        
        if (!silent) {
            // Notify all listeners that their keys are deleted
            for (const key of this.__listeners.keys()) {
                const oldValue = this.__getNestedValue(oldState, key);
                if (oldValue !== undefined) {
                    this.__notifyListeners(key, undefined, oldValue);
                }
            }
        }
        
        return this;
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Event System
    // ==========================================

    /**
     * Subscribe to state changes
     * @param {string} key - The key to watch
     * @param {function} callback - Callback function
     * @param {object} options - Options for subscription
     * @returns {function} - Unsubscribe function
     */
    subscribe(key, callback, options = {}) {
        if (typeof key !== 'string') {
            throw new Error('State key must be a string');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        const {
            immediate = false, // Call immediately with current value
            once = false       // Call only once
        } = options;

        if (!this.__listeners.has(key)) {
            this.__listeners.set(key, new Set());
        }

        const listener = {
            callback,
            once,
            id: Date.now() + Math.random()
        };

        this.__listeners.get(key).add(listener);
        
        logger.log(`🎧 StateService: Subscribed to ${key}`);
        
        // Call immediately if requested
        if (immediate) {
            const currentValue = this.get(key);
            if (currentValue !== undefined) {
                callback(currentValue, undefined, key);
            }
        }
        
        // Return unsubscribe function
        return () => this.unsubscribe(key, listener.id);
    }

    /**
     * Unsubscribe from state changes
     * @param {string} key - The key to stop watching
     * @param {string|function} listenerId - Listener ID or callback function
     * @returns {boolean} - True if unsubscribed
     */
    unsubscribe(key, listenerId) {
        if (!this.__listeners.has(key)) {
            return false;
        }

        const listeners = this.__listeners.get(key);
        
        if (typeof listenerId === 'string') {
            // Remove by ID
            for (const listener of listeners) {
                if (listener.id === listenerId) {
                    listeners.delete(listener);
                    logger.log(`🎧 StateService: Unsubscribed from ${key}`);
                    return true;
                }
            }
        } else if (typeof listenerId === 'function') {
            // Remove by callback
            for (const listener of listeners) {
                if (listener.callback === listenerId) {
                    listeners.delete(listener);
                    logger.log(`🎧 StateService: Unsubscribed from ${key}`);
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Unsubscribe all listeners for a key
     * @param {string} key - The key to clear listeners for
     */
    unsubscribeAll(key) {
        if (key) {
            this.__listeners.delete(key);
            logger.log(`🎧 StateService: Unsubscribed all from ${key}`);
        } else {
            this.__listeners.clear();
            logger.log('🎧 StateService: Unsubscribed all listeners');
        }
    }


    // ==========================================
    // PUBLIC INSTANCE METHODS - Middleware
    // ==========================================

    /**
     * Add middleware function
     * @param {function} middleware - Middleware function
     * @returns {StateService} - Chainable
     */
    addMiddleware(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.__middlewares.push(middleware);
        logger.log('🔧 StateService: Added middleware');
        
        return this;
    }

    /**
     * Remove middleware function
     * @param {function} middleware - Middleware function to remove
     * @returns {boolean} - True if removed
     */
    removeMiddleware(middleware) {
        const index = this.__middlewares.indexOf(middleware);
        if (index > -1) {
            this.__middlewares.splice(index, 1);
            logger.log('🔧 StateService: Removed middleware');
            return true;
        }
        return false;
    }


    // ==========================================
    // PUBLIC INSTANCE METHODS - Utilities
    // ==========================================

    /**
     * Debug state service
     */
    debug() {
        // Get listeners info manually for debug
        const listeners = {};
        for (const [key, listenerSet] of this.__listeners) {
            listeners[key] = listenerSet.size;
        }
        
        logger.log('🔍 StateService Debug:', {
            state: this.__state,
            listeners: listeners,
            middlewares: this.__middlewares.length,
            isUpdating: this.__isUpdating
        });
    }

    /**
     * Export state to JSON
     * @returns {string} - JSON string
     */
    export() {
        return JSON.stringify(this.__state, null, 2);
    }

    /**
     * Import state from JSON
     * @param {string} jsonString - JSON string
     * @returns {boolean} - True if successful
     */
    import(jsonString) {
        try {
            const importedState = JSON.parse(jsonString);
            this.set(importedState); // Use set method for multiple keys
            logger.log('📥 StateService: Imported state successfully');
            return true;
        } catch (error) {
            logger.error('❌ StateService: Failed to import state:', error);
            return false;
        }
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    /**
     * Get nested value from object using dot notation
     * @param {object} obj - The object
     * @param {string} path - The path (e.g., 'user.profile.name')
     * @returns {any} - The value
     */
    __getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Set nested value in object using dot notation
     * @param {object} obj - The object
     * @param {string} path - The path (e.g., 'user.profile.name')
     * @param {any} value - The value to set
     */
    __setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Delete nested value from object using dot notation
     * @param {object} obj - The object
     * @param {string} path - The path (e.g., 'user.profile.name')
     * @returns {boolean} - True if deleted
     */
    __deleteNestedValue(obj, path) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            return current && current[key] ? current[key] : undefined;
        }, obj);
        
        if (target && target.hasOwnProperty(lastKey)) {
            delete target[lastKey];
            return true;
        }
        return false;
    }

    /**
     * Check if value is an object
     * @param {any} value - The value to check
     * @returns {boolean} - True if object
     */
    __isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Apply middlewares to value change
     * @param {string} key - The key
     * @param {any} oldValue - Old value
     * @param {any} newValue - New value
     * @param {string} action - Action type
     * @returns {any} - Processed value
     */
    __applyMiddlewares(key, oldValue, newValue, action) {
        let processedValue = newValue;
        
        for (const middleware of this.__middlewares) {
            try {
                processedValue = middleware(key, oldValue, processedValue, action);
            } catch (error) {
                logger.error(`❌ StateService: Middleware error for ${key}:`, error);
            }
        }
        
        return processedValue;
    }

    /**
     * Notify all listeners for a key
     * @param {string} key - The key
     * @param {any} newValue - New value
     * @param {any} oldValue - Old value
     */
    __notifyListeners(key, newValue, oldValue) {
        if (this.__isUpdating) return;
        
        const listeners = this.__listeners.get(key);
        if (!listeners) return;
        
        const listenersToRemove = [];
        
        for (const listener of listeners) {
            try {
                listener.callback(newValue, oldValue, key);
                
                if (listener.once) {
                    listenersToRemove.push(listener);
                }
            } catch (error) {
                logger.error(`❌ StateService: Listener error for ${key}:`, error);
            }
        }
        
        // Remove once listeners
        for (const listener of listenersToRemove) {
            listeners.delete(listener);
        }
        
        // Remove empty listener sets
        if (listeners.size === 0) {
            this.__listeners.delete(key);
        }
    }

    __addDynamicProperty(key) {
        if (StateService.privateProperties.includes(key) || this.dynamicProperties.includes(key)) {
            return;
        }
        this.dynamicProperties.push(key);
        Object.defineProperty(this, key, {
            get: () => this.get(key),
            set: (value) => this.set(key, value)
        });
    }

    __removeDynamicProperty(key) {
        if (this.dynamicProperties.includes(key)) {
            delete this[key];
            this.dynamicProperties = this.dynamicProperties.filter(k => k !== key);
        }
    }
}

// Export singleton instance
const state = StateService.getInstance();
export default state;