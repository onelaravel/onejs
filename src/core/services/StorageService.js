import logger from "./LoggerService.js";

// StorageService - Service thuần túy quản lý localStorage với Event System, TTL và Encrypt
export class StorageService {
    static instance = null;
    static privateProperties = [
        '__key', 
        '__isSupport', 
        '__data', 
        '__listeners', '__eventQueue', '__isUpdating', 'instance', 
        'set', 'get', 'remove', 'clear', 'getAll', 'has', 'getAllKeys', 'size', 'isEmpty', 'getInfo', 'debug', 
        'export', 'import', 'backup', 'restore', 'getStorageUsage', 
        'isStorageFull',
        'setKey', 'getKey', 'support', '__loadData', '__updateData', 'emit', 'on', 'off', 'removeAllListeners', 'getEvents', 'getListenerCount',
        'getTTLInfo', 'cleanExpired', 'enableEncryption', '__generateEncryptionKey',
        '__encrypt', '__decrypt', '__isExpired', '__cleanExpiredData', '__createDynamicProperty', '__removeDynamicProperty'
    ];
    

    constructor(key = 'onejs_storage') {
        this.__key = key || "onejs_storage";
        this.__isSupport = typeof (Storage) !== "undefined";
        this.__data = {};
        this.__listeners = new Map(); // Event listeners
        this.__eventQueue = []; // Event queue for batching
        this.__isUpdating = false;
        
        // Encryption system
        this.encryptionKey = null;
        this.useEncryption = false;
        this.dynamicProperties = [];
        if (this.__isSupport) {
            this.__loadData();
        }
    }

    // ==========================================
    // PUBLIC STATIC METHODS
    // ==========================================

    /**
     * Get the instance of the StorageService
     * @param {string} key - The key to use for the storage
     * @returns {StorageService} - The instance of the StorageService
     */
    static getInstance(key) {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService(key);
        }
        return StorageService.instance;
    }

    static make(key) {
        return new StorageService(key);
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Configuration
    // ==========================================

    /**
     * Set the key for the storage
     * @param {string} key - The key to use for the storage
     * @returns {StorageService} - The instance of the StorageService
     */
    setKey(key) {
        if (typeof key !== 'string' || !key.trim()) {
            throw new Error('Storage key must be a non-empty string');
        }
        
        this.__key = key;
        this.__loadData();
        return this;
    }

    /**
     * Get the current storage key
     * @returns {string} - The current storage key
     */
    getKey() {
        return this.__key;
    }

    /**
     * Check if the storage is supported
     * @returns {boolean} - True if the storage is supported, false otherwise
     */
    support() {
        return this.__isSupport;
    }

    /**
     * Enable/disable encryption
     * @param {boolean} enable - Enable encryption
     * @param {string} key - Encryption key (optional, will generate if not provided)
     */
    enableEncryption(enable = true, key = null) {
        this.useEncryption = enable;
        
        if (enable && !key) {
            // Generate a random encryption key
            this.encryptionKey = this.__generateEncryptionKey();
        } else if (enable && key) {
            this.encryptionKey = key;
        } else {
            this.encryptionKey = null;
        }
        
        logger.log(`🔧 StorageService: Encryption ${enable ? 'enabled' : 'disabled'}`);
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Core Storage Operations
    // ==========================================

    /**
     * Set the data in the storage with optional TTL
     * @param {string|object} key - The key to use for the storage
     * @param {any} value - The value to use for the storage
     * @param {number|null} ttl - Time to live in seconds (null = no expiration)
     * @returns {boolean} - True if the data is set, false otherwise
     */
    set(key, value, ttl = null) {
        if (!this.__isSupport) return false;
        
        if (key === null || key === undefined) {
            throw new Error('Key cannot be null or undefined');
        }
        
        if (typeof key === 'object' && key !== null) {
            // Nếu key là object, set nhiều key-value
            let success = true;
            Object.keys(key).forEach(k => {
                const v = key[k];
                if (!this.set(k, v, ttl)) { success = false; }
            })
            return success;
        }
        
        if (!(typeof key === 'string' || typeof key === 'number')) {
            throw new Error('Key must be a string when setting single value');
        }
        
        // Validate TTL
        if (ttl && (typeof ttl !== 'number' || ttl <= 0)) {
            throw new Error('TTL must be a positive number or null');
        }
        
        const oldValue = this.__data[key];
        
        // Create data structure with TTL
        const dataItem = {
            value: value,
            timestamp: Date.now()
        };
        
        if (ttl !== null) {
            dataItem.ttl = ttl * 1000;
        }
        
        this.__data[key] = dataItem;
        
        try {
            this.__updateData();
            logger.log(`💾 StorageService: Set ${key}:`, value, ttl ? `(TTL: ${ttl}ms)` : '(no TTL)');
            
            this.__createDynamicProperty(key, ttl);
            // Emit events
            this.emit(`set:${key}`, { key, value, oldValue, ttl });
            this.emit('set', { key, value, oldValue, ttl });
            
            // Create dynamic property for direct access

            return true;
        } catch (error) {
            // Revert on error
            this.__data[key] = oldValue;
            throw error;
        }
    }

    /**
     * Get the data from the storage with TTL check
     * @param {string} key - The key to use for the storage
     * @param {any} defaultValue - Default value if key not found or expired
     * @returns {any} - The value of the data or null if expired
     */
    get(key, defaultValue = null) {
        if (!this.__isSupport) return defaultValue;
        
        if (typeof key !== 'string') {
            throw new Error('Key must be a string');
        }
        
        if (typeof this.__data[key] === 'undefined') return defaultValue;
        
        const dataItem = this.__data[key];
        
        // Check if data has TTL structure
        if (dataItem && typeof dataItem === 'object' && 'value' in dataItem) {
            // Check if expired
            if (this.__isExpired(dataItem)) {
                logger.log(`⏰ StorageService: Key ${key} has expired, removing...`);
                this.remove(key);
                return defaultValue;
            }
            
            logger.log(`📖 StorageService: Retrieved ${key}:`, dataItem.value);
            return dataItem.value;
        } else {
            // Legacy data without TTL structure
            logger.log(`📖 StorageService: Retrieved ${key}:`, dataItem);
            return dataItem;
        }
    }

    /**
     * Remove the data from the storage
     * @param {string} key - The key to use for the storage
     * @returns {boolean} - True if the data is removed, false otherwise
     */
    remove(key) {
        if (!this.__isSupport) return false;
        
        if (typeof key !== 'string') {
            throw new Error('Key must be a string');
        }
        
        if (Object.keys(this.__data).length === 0 || typeof this.__data[key] === 'undefined') {
            return false;
        }
        
        const oldValue = this.__data[key];
        delete this.__data[key];
        
        try {
            this.__updateData();
            logger.log('🗑️ StorageService: Removed', key);
            
            // Emit events
            this.emit('remove', { key, oldValue });
            this.emit(`remove:${key}`, { key, oldValue });
            
            // Remove dynamic property
            this.__removeDynamicProperty(key);
            
            return true;
        } catch (error) {
            // Revert on error
            this.__data[key] = oldValue;
            throw error;
        }
    }

    /**
     * Clear the data from the storage
     */
    clear() {
        const oldData = { ...this.__data };
        this.__data = {};

        // Remove all dynamic properties
        if (this.dynamicProperties) {
            for (const key of this.dynamicProperties) {
                this.__removeDynamicProperty(key);
            }
            this.dynamicProperties = [];
        }
        
        try {
            this.__updateData();
            logger.log('🧹 StorageService: Cleared all data');
            
            // Emit events
            this.emit('clear', { oldData });
        } catch (error) {
            // Revert on error
            this.__data = oldData;
            throw error;
        }
    }

    /**
     * Get all data from the storage (excluding expired items)
     * @returns {object} - All valid data in storage
     */
    getAll() {
        // Clean expired data first
        this.__cleanExpiredData();
        
        const result = {};
        for (const [key, dataItem] of Object.entries(this.__data)) {
            if (dataItem && typeof dataItem === 'object' && 'value' in dataItem) {
                result[key] = dataItem.value;
            } else {
                result[key] = dataItem; // Legacy data
            }
        }
        return result;
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key - The key to check
     * @returns {boolean} - True if key exists and not expired, false otherwise
     */
    has(key) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string');
        }
        
        if (typeof this.__data[key] === 'undefined') return false;
        
        const dataItem = this.__data[key];
        
        // Check if data has TTL structure
        if (dataItem && typeof dataItem === 'object' && 'value' in dataItem) {
            return !this.__isExpired(dataItem);
        }
        
        return true; // Legacy data without TTL
    }

    /**
     * Get all keys (excluding expired items)
     * @returns {string[]} - Array of all valid keys
     */
    getAllKeys() {
        // Clean expired data first
        this.__cleanExpiredData();
        
        return Object.keys(this.__data);
    }

    /**
     * Get storage size (number of valid keys)
     * @returns {number} - Number of valid keys in storage
     */
    size() {
        // Clean expired data first
        this.__cleanExpiredData();
        
        return Object.keys(this.__data).length;
    }

    /**
     * Check if storage is empty
     * @returns {boolean} - True if storage is empty, false otherwise
     */
    isEmpty() {
        return this.size() === 0;
    }

    /**
     * Get storage info
     * @returns {object} - Storage information
     */
    getInfo() {
        // Clean expired data first
        const expiredRemoved = this.__cleanExpiredData();
        
        return {
            key: this.__key,
            isSupport: this.__isSupport,
            size: this.size(),
            keys: this.getAllKeys(),
            isEmpty: this.isEmpty(),
            events: this.getEvents(),
            totalListeners: Array.from(this.__listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
            isUpdating: this.__isUpdating,
            useEncryption: this.useEncryption,
            hasEncryptionKey: !!this.encryptionKey,
            expiredRemoved: expiredRemoved,
            dynamicProperties: this.dynamicProperties ? this.dynamicProperties.length : 0
        };
    }

    /**
     * Debug storage
     */
    debug() {
        logger.log('🔍 StorageService Debug:', this.getInfo());
        
        // Show TTL info for each key
        logger.log('📋 TTL Information:');
        for (const [key, dataItem] of Object.entries(this.__data)) {
            if (dataItem && typeof dataItem === 'object' && 'value' in dataItem) {
                const isExpired = this.__isExpired(dataItem);
                const ttl = dataItem.ttl;
                const remaining = dataItem.ttl ? Math.max(0, (dataItem.timestamp + dataItem.ttl) - Date.now()) : null;
                logger.log(`  ${key}: ${isExpired ? 'EXPIRED' : 'VALID'}${dataItem.ttl ? ` (TTL: ${dataItem.ttl}ms, Remaining: ${remaining}ms)` : ' (no TTL)'}`);
            } else {
                logger.log(`  ${key}: LEGACY (no TTL)`);
            }
        }
        
        // Show dynamic properties
        logger.log('🔧 Dynamic Properties:', this.dynamicProperties || []);
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - TTL Operations
    // ==========================================

    /**
     * Get TTL information for a key
     * @param {string} key - The key to check
     * @returns {object|null} - TTL information or null if not found
     */
    getTTLInfo(key) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string');
        }
        
        if (typeof this.__data[key] === 'undefined') return null;
        
        const dataItem = this.__data[key];
        
        if (dataItem && typeof dataItem === 'object' && 'value' in dataItem) {
            const isExpired = this.__isExpired(dataItem);
            const remaining = dataItem.ttl ? Math.max(0, (dataItem.timestamp + dataItem.ttl) - Date.now()) : null;
            
            return {
                hasTTL: !!dataItem.ttl,
                ttl: dataItem.ttl,
                timestamp: dataItem.timestamp,
                isExpired,
                remaining,
                expiryTime: dataItem.ttl ? dataItem.timestamp + dataItem.ttl : null
            };
        }
        
        return null; // Legacy data without TTL
    }

    /**
     * Clean all expired data
     * @returns {number} - Number of expired items removed
     */
    cleanExpired() {
        return this.__cleanExpiredData();
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Import/Export
    // ==========================================

    /**
     * Export data to JSON string
     * @returns {string} - JSON string of all data
     */
    export() {
        return JSON.stringify(this.getAll(), null, 2);
    }

    /**
     * Import data from JSON string
     * @param {string} jsonString - JSON string to import
     * @returns {boolean} - True if import successful, false otherwise
     */
    import(jsonString) {
        if (typeof jsonString !== 'string') {
            throw new Error('JSON string must be a string');
        }
        
        try {
            const data = JSON.parse(jsonString);
            const oldData = { ...this.__data };
            
            // Convert imported data to TTL structure
            this.__data = {};
            for (const [key, value] of Object.entries(data)) {
                this.__data[key] = {
                    value: value,
                    timestamp: Date.now()
                };
            }
            
            this.__updateData();
            
            logger.log('📥 StorageService: Imported data successfully');
            
            // Emit events
            this.emit('import', { oldData, newData: data });
            
            return true;
        } catch (error) {
            logger.error('❌ StorageService: Failed to import data:', error);
            return false;
        }
    }

    /**
     * Backup current data
     * @returns {object} - Backup data with timestamp
     */
    backup() {
        return {
            timestamp: Date.now(),
            key: this.__key,
            data: { ...this.__data } // Return copy
        };
    }

    /**
     * Restore from backup
     * @param {object} backup - Backup data
     * @returns {boolean} - True if restore successful, false otherwise
     */
    restore(backup) {
        if (!backup || typeof backup !== 'object') {
            throw new Error('Backup must be a valid object');
        }
        
        if (!backup.data) {
            logger.error('❌ StorageService: Invalid backup data');
            return false;
        }

        const oldData = { ...this.__data };
        this.__data = { ...backup.data }; // Use copy
        
        try {
            this.__updateData();
            logger.log('📤 StorageService: Restored from backup:', backup.timestamp);
            
            // Emit events
            this.emit('restore', { oldData, newData: backup.data, backup });
            
            return true;
        } catch (error) {
            // Revert on error
            this.__data = oldData;
            throw error;
        }
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Storage Utilities
    // ==========================================

    /**
     * Get storage usage in bytes
     * @returns {number} - Storage usage in bytes
     */
    getStorageUsage() {
        if (!this.__isSupport) return 0;
        
        try {
            const data = localStorage.getItem(this.__key);
            return data ? new Blob([data]).size : 0;
        } catch (error) {
            logger.error('❌ StorageService: Failed to get storage usage:', error);
            return 0;
        }
    }

    /**
     * Check if storage is full
     * @returns {boolean} - True if storage is full, false otherwise
     */
    isStorageFull() {
        try {
            const testKey = '__storage_test__';
            const testValue = 'x'.repeat(1024); // 1KB test
            
            localStorage.setItem(testKey, testValue);
            localStorage.removeItem(testKey);
            return false;
        } catch (error) {
            return true; // Storage is full
        }
    }

    // ==========================================
    // PUBLIC INSTANCE METHODS - Event System
    // ==========================================

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     * @returns {function} - Unsubscribe function
     */
    on(event, callback) {
        if (typeof event !== 'string' || !event.trim()) {
            throw new Error('Event name must be a non-empty string');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        if (!this.__listeners.has(event)) {
            this.__listeners.set(event, []);
        }
        
        this.__listeners.get(event).push(callback);
        logger.log(`🎧 StorageService: Added listener for event: ${event}`);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    off(event, callback) {
        if (!this.__listeners.has(event)) return;
        
        const listeners = this.__listeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
            logger.log(`🎧 StorageService: Removed listener for event: ${event}`);
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
        if (event) {
            this.__listeners.delete(event);
            logger.log(`🎧 StorageService: Removed all listeners for event: ${event}`);
        } else {
            this.__listeners.clear();
            logger.log('🎧 StorageService: Removed all listeners');
        }
    }

    /**
     * Get all registered events
     * @returns {string[]} - Array of event names
     */
    getEvents() {
        return Array.from(this.__listeners.keys());
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} - Number of listeners
     */
    getListenerCount(event) {
        return this.__listeners.has(event) ? this.__listeners.get(event).length : 0;
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    /**
     * Generate encryption key
     * @returns {string} - Generated encryption key
     */
    __generateEncryptionKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Encrypt data
     * @param {string} data - Data to encrypt
     * @returns {string} - Encrypted data
     */
    __encrypt(data) {
        if (!this.useEncryption || !this.encryptionKey) {
            return data;
        }
        
        try {
            // Simple XOR encryption (for development purposes)
            // In production, use proper encryption like AES
            let encrypted = '';
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                encrypted += String.fromCharCode(charCode);
            }
            return btoa(encrypted); // Base64 encode
        } catch (error) {
            console.error('❌ StorageService: Encryption failed:', error);
            return data;
        }
    }

    /**
     * Decrypt data
     * @param {string} data - Data to decrypt
     * @returns {string} - Decrypted data
     */
    __decrypt(data) {
        if (!this.useEncryption || !this.encryptionKey) {
            return data;
        }
        
        try {
            // Simple XOR decryption (for development purposes)
            const decoded = atob(data); // Base64 decode
            let decrypted = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
                decrypted += String.fromCharCode(charCode);
            }
            return decrypted;
        } catch (error) {
            console.error('❌ StorageService: Decryption failed:', error);
            return data;
        }
    }

    /**
     * Check if data is expired
     * @param {object} dataItem - Data item with timestamp and ttl
     * @returns {boolean} - True if expired, false otherwise
     */
    __isExpired(dataItem) {
        if (!dataItem || !dataItem.timestamp || !dataItem.ttl) {
            return false; // No TTL, not expired
        }
        
        const now = Date.now();
        const expiryTime = dataItem.timestamp + dataItem.ttl;
        return now > expiryTime;
    }

    /**
     * Clean expired data
     * @returns {number} - Number of expired items removed
     */
    __cleanExpiredData() {
        let removed = 0;
        const keysToRemove = [];
        
        for (const [key, dataItem] of Object.entries(this.__data)) {
            if (this.__isExpired(dataItem)) {
                keysToRemove.push(key);
            }
        }
        
        for (const key of keysToRemove) {
            delete this.__data[key];
            removed++;
            logger.log(`🗑️ StorageService: Removed expired key: ${key}`);
        }
        
        if (removed > 0) {
            this.__updateData();
        }
        
        return removed;
    }

    /**
     * Load the data from the storage (private method)
     */
    __loadData() {
        if (!this.__isSupport) return;
        
        try {
            const data = localStorage.getItem(this.__key);
            if (data) {
                const decryptedData = this.__decrypt(data);
                this.__data = JSON.parse(decryptedData);
                
                // Clean expired data on load
                this.__cleanExpiredData();
            }
        } catch (error) {
            console.error('❌ StorageService: Failed to load data:', error);
            this.__data = {};
        }
    }

    /**
     * Update the data in the storage (private method)
     */
    __updateData() {
        if (!this.__isSupport || this.__isUpdating) return;
        
        this.__isUpdating = true;
        
        try {
            const jsonData = JSON.stringify(this.__data);
            const encryptedData = this.__encrypt(jsonData);
            localStorage.setItem(this.__key, encryptedData);
            logger.log('💾 StorageService: Updated data for key:', this.__key);
        } catch (error) {
            logger.error('❌ StorageService: Failed to update data:', error);
            throw error;
        } finally {
            this.__isUpdating = false;
        }
    }

    /**
     * Emit event to all listeners (private method)
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (!this.__listeners.has(event)) return;
        
        const listeners = this.__listeners.get(event);
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ StorageService: Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Create dynamic property for direct access
     * @param {string} key - The key
     * @param {number|null} ttl - TTL value
     */
    __createDynamicProperty(key, ttl) {
        try {
            if (!StorageService.privateProperties.includes(key) && !this.dynamicProperties.includes(key)) {
                this.dynamicProperties.push(key);
                Object.defineProperty(this, key, {
                    set: (value) => this.set(key, value, ttl),
                    get: () => this.get(key),
                    configurable: true
                });
            }
        } catch (error) {
            logger.error('❌ StorageService: Failed to create dynamic property:', error);
        }
    }

    /**
     * Remove dynamic property
     * @param {string} key - The key to remove
     */
    __removeDynamicProperty(key) {
        try {
            if (this.dynamicProperties && this.dynamicProperties.includes(key)) {
                delete this[key];
                this.dynamicProperties = this.dynamicProperties.filter(k => k !== key);
            }
        } catch (error) {
            logger.error('❌ StorageService: Failed to remove dynamic property:', error);
        }
    }
}

// Export singleton instance
const storage = StorageService.getInstance('onejs_storage');
export default storage;