import { __defineProp, __hasOwnProp } from "../helpers/utils.js";
import logger from "./services/LoggerService.js";

/**
 * StateManager - Quản lý state reactive với batched updates
 * 
 * Tính năng:
 * - Cập nhật state theo batch dùng requestAnimationFrame
 * - Multi-key subscriptions (kích hoạt một lần khi bất kỳ key nào thay đổi)
 * - Truy cập thuộc tính lồng nhàu (ví dụ: 'user.name')
 * - Phát hiện thay đổi tự động với so sánh sâu
 * - Ngăn memory leak với dọn dẹp đúng cách
 * 
 * Sửa Race Condition v2.0.0:
 * - Chiến lược async thống nhất (chỉ RAF, không trộn Promise + RAF)
 * - Hủy RAF đúng cách trong các trường hợp biên
 * - Bảo vệ chống flush đồng thời
 * - Xử lý lỗi tốt hơn với try-catch-finally
 * 
 * @class StateManager
 * @since 2.0.0 - Sửa race condition
 */
export class StateManager {
    constructor(controller, owner) {
        // Thuộc tính private dùng quy ước đặt tên để tương thích trình duyệt
        this.controller = controller;
        this.vs = owner;
        
        /**
         * @type {Object<string, {value: any, setValue: function}>}
         */
        this.states = {};
        this.stateIndex = 0;
        this.canUpdateStateByKey = true;

        this.readyToCommit = false;
        
        /**
         * @type {Map<string, Array<Function>>}
         */
        this.listeners = new Map();
        
        /**
         * @type {Array<{keys: Set, callback: Function, called: Boolean}>}
         */
        this.multiKeyListeners = [];
        
        /**
         * @type {Set<string>}
         */
        this.pendingChanges = new Set();
        
        /**
         * @type {boolean}
         * Cờ để ngăn các thao tác flush đồng thời
         */
        this.hasPendingFlush = false;
        
        /**
         * @type {boolean}
         * Cờ để ngăn các lời gọi flush tái nhập
         */
        this.isFlushing = false;
        
        /**
         * @type {number|null} 
         * RAF ID để hủy và dọn dẹp
         */
        this.flushRAF = null;

        /**
         * @type {Array<string>}
         */
        this.ownProperties = ['__'];
        
        /**
         * @type {Array<string>}
         */
        this.ownMethods = ['on', 'off'];

        this.setters = {};
        
        /**
         * @type {WeakMap} 
         * Cho dữ liệu cục bộ component (tự động garbage collected)
         */
        this._scopedData = new WeakMap();
        
        /**
         * @type {number}
         * Theo dõi số lượng thao tác flush để debug
         */
        this._flushCount = 0;
        
        /**
         * @type {boolean}
         * Cờ chỉ StateManager đã bị hủy
         */
        this._isDestroyed = false;
    }
    
    // Define public methods using Object.defineProperties for backward compatibility

    /**
     * Commit thay đổi state vào batch queue
     * 
     * Sửa Race Condition:
     * - Chỉ dùng RAF (không trộn Promise + RAF)
     * - Quản lý cờ đúng cách
     * - An toàn khi hủy
     * 
     * @param {string} key - State key đã thay đổi
     * @param {*} oldValue - Giá trị trước đó
     * @returns {boolean} False nếu giá trị không thay đổi, undefined nếu không
     * 
     * @private
     */
    commitStateChange(key, oldValue) {
        // Kiểm tra đã bị hủy chưa
        if (this._isDestroyed) {
            logger.warn('[StateManager] Cannot commit state change - manager is destroyed');
            return false;
        }
        
        // Kiểm tra sẵn sàng commit
        if (!this.readyToCommit) {
            return;
        }
        
        // So sánh nhanh cho primitives
        const newValue = this.getStateByAddressKey(key);
        
        // So sánh sâu cho objects/arrays
        if (typeof oldValue === 'object' || typeof newValue === 'object') {
            if (this.parseCompareValue(oldValue) === this.parseCompareValue(newValue)) {
                return false;
            }
        }
        else if (oldValue === newValue) {
            return false;
        }
        
        // Thêm vào pending changes
        this.pendingChanges.add(key);
        
        // Lên lịch flush nếu chưa được lên lịch
        // Chỉ dùng requestAnimationFrame để nhất quán
        // Điều này ngăn race conditions giữa Promise microtasks và RAF macrotasks
        if (!this.hasPendingFlush) {
            this.hasPendingFlush = true;
            
            try {
                this.flushRAF = requestAnimationFrame(() => {
                    this._executeFlush();
                });
            } catch (error) {
                logger.error('[StateManager] Error scheduling flush:', error);
                this.hasPendingFlush = false;
                this.flushRAF = null;
            }
        }
    }
    
    /**
     * Thực thi thao tác flush với xử lý lỗi đúng cách
     * Bao bọc flushChanges() với các kiểm tra an toàn
     * 
     * @private
     */
    _executeFlush() {
        // Kiểm tra đã bị hủy chưa
        if (this._isDestroyed) {
            return;
        }
        
        // Ngăn các lời gọi tái nhập
        if (this.isFlushing) {
            logger.warn('[StateManager] Flush already in progress, skipping');
            return;
        }
        
        try {
            this.isFlushing = true;
            this.flushChanges();
        } catch (error) {
            logger.error('[StateManager] Error during flush:', error);
        } finally {
            // Luôn xóa cờ ngay cả khi có lỗi xảy ra
            this.isFlushing = false;
            this.hasPendingFlush = false;
            this.flushRAF = null;
        }
    }
    
    /**
     * Flush tất cả các thay đổi state đang chờ vào listeners
     * Xử lý batch tất cả thay đổi đã tích lũy trong một thao tác
     * 
     * @private
     */
    flushChanges() {
        // Kiểm tra điều kiện lần nữa
        if (this.pendingChanges.size === 0) {
            return;
        }
        
        // Tăng bộ đếm flush để debug
        this._flushCount++;
        
        // Batch tất cả thay đổi cho chu kỳ flush này
        const changesToProcess = Array.from(this.pendingChanges);
        this.pendingChanges.clear();
        
        if (changesToProcess.length === 0) {
            return;
        }
        
        // Log để debug (có thể tắt trong production)
        if (this.controller?.App?.env?.debug) {
            logger.log(`[StateManager] Flushing ${changesToProcess.length} changes (flush #${this._flushCount}):`, changesToProcess);
        }
        
        // Reset cờ called của multi-key listeners
        for (const listener of this.multiKeyListeners) {
            listener.called = false;
        }
        
        // Kích hoạt single-key listeners
        for (const changedKey of changesToProcess) {
            const listeners = this.listeners.get(changedKey);
            if (listeners && listeners.length > 0) {
                const currentValue = this.states[changedKey]?.value;
                // Dùng for loop để hiệu suất tốt hơn
                for (let i = 0; i < listeners.length; i++) {
                    try {
                        listeners[i](currentValue);
                    } catch (error) {
                        logger.error('[StateManager] Listener error:', error, { 
                            key: changedKey,
                            listenerIndex: i
                        });
                    }
                }
            }
            
            // Kiểm tra multi-key listeners
            for (const listener of this.multiKeyListeners) {
                if (!listener.called && listener.keys.has(changedKey)) {
                    listener.called = true;
                    
                    // Thu thập tất cả giá trị đã thay đổi cho các keys đăng ký
                    const values = {};
                    for (const k of listener.keys) {
                        if (changesToProcess.includes(k)) {
                            values[k] = this.states[k]?.value;
                        }
                    }
                    
                    // Validate callback trước khi gọi
                    if (typeof listener.callback === 'function') {
                        try {
                            listener.callback(values);
                        } catch (error) {
                            logger.error('[StateManager] Multi-key listener error:', error, { 
                                keys: Array.from(listener.keys) 
                            });
                        }
                    } else {
                        logger.error('[StateManager] listener.callback is not a function', {
                            keys: Array.from(listener.keys),
                            callbackType: typeof listener.callback
                        });
                    }
                }
            }
            
            // Kích hoạt onStateChange của view
            if (this.controller && typeof this.controller._bindingManager?.onStateChange === 'function') {
                try {
                    this.controller._bindingManager.onStateChange(changedKey, this.states[changedKey]?.value);
                } catch (error) {
                    logger.error('[StateManager] onStateChange error:', error, { key: changedKey });
                }
            }
        }
    }

    /**
     * set state nội bộ
     * @param {number} index index
     * @param {*} value giá trị 
     * @param {function} setValue hàm set giá trị
     * @param {string} key key của state
     * @returns {[*, function, string]}
     */
    setState(key, value, setValue = () => { }) {
        if (this.states[key]) {
            return [value, setValue, key];
        }
        this.states[key] = {
            value: value,
            setValue: setValue,
            key: key,
        };
        return [value, setValue, key];
    }

    /**
     * tương tự useState
     * @param {*} value giá trị của state
     * @param {string} key key của state (không bắt buộc)
     * @returns {Array<[*, function, string]>}
     */
    useState(value, key = null) {
        if (key && __hasOwnProp(this.states, key)) {
            return [this.states[key].value, this.states[key].setValue, key];
        }
        const index = this.stateIndex++;
        const stateKey = key ?? index;
        const setValue = (value) => {
            const oldValue = this.states[stateKey].value;
            this.states[stateKey].value = value;
            this.commitStateChange(stateKey, oldValue);
        };
        this.setState(stateKey, value, setValue);

        if (!this.ownProperties.includes(stateKey) && !this.ownMethods.includes(stateKey)) {
            const $self = this;
            Object.defineProperty(this.vs, stateKey, {
                get: () => {
                    return $self.states[stateKey].value;
                },
                set: (value) => {
                    if (typeof $self.setters[stateKey] === 'function') {
                        return $self.setters[stateKey](value);
                    }
                    else {
                        logger.log("Bạn không thể thiết lập giá trị cho " + stateKey + " theo cách này");
                    }
                },
                configurable: false,
                enumerable: true,
            });

        }
        return [value, setValue, stateKey];
    }

    /**
     * cập nhật state value theo key
     * @param {string} key key của state
     * @param {*} value giá trị
     * @returns {*}
     */
    updateStateByKey(key, value) {
        if (!this.states[key]) {
            return;
        }
        if (!this.canUpdateStateByKey) {
            return this.states[key].value;
        }
        const oldValue = this.states[key].value;
        this.states[key].value = value;
        this.commitStateChange(key, oldValue);
        return value;
    }

    updateStateAddressKey(key, value) {
        const keyPaths = key.split('.');
        const _key = keyPaths.shift();
        if (!this.states[_key]) {
            return;
        }
        let stateValue = this.states[_key].value;
        if (keyPaths.length === 0 || typeof stateValue !== 'object' || stateValue === null) {
            return this.setters[_key](value);
        }
        
        // Clone object/array to create new reference for reactivity
        // This ensures oldValue !== newValue in commitStateChange
        let clonedValue;
        if (Array.isArray(stateValue)) {
            clonedValue = [...stateValue];
        } else {
            clonedValue = { ...stateValue };
        }
        
        let current = clonedValue;
        for (let i = 0; i < keyPaths.length - 1; i++) {
            const path = keyPaths[i];
            if (typeof current[path] !== 'object' || current[path] === null) {
                current[path] = {};
            } else {
                // Clone nested objects/arrays
                current[path] = Array.isArray(current[path]) ? [...current[path]] : { ...current[path] };
            }
            current = current[path];
        }
        const lastPath = keyPaths[keyPaths.length - 1];
        current[lastPath] = value;
        return this.setters[_key](clonedValue);
    }

    getStateByAddressKey(key) {
        // Convert key to string if it's a number
        const keyString = String(key);
        
        // Fast path for simple keys (no dots)
        if(!keyString.includes('.')) {
            return this.states[keyString]?.value ?? null;
        }
        
        const keyPaths = keyString.split('.');
        const rootKey = keyPaths[0];
        
        if (!this.states[rootKey]) {
            return null;
        }
        
        let current = this.states[rootKey].value;
        
        // Early return for root level
        if (keyPaths.length === 1) {
            return current;
        }
        
        // Traverse nested path
        for (let i = 1; i < keyPaths.length; i++) {
            if (typeof current !== 'object' || current === null) {
                return null;
            }
            current = current[keyPaths[i]];
            if (current === undefined) {
                return null;
            }
        }
        
        return current;
    }

    /**
     * đăng ký key - value cho state - trả về hàm setValue cho key tương ứng
     * @param {string} key key của state
     * @param {*} value giá trị
     * @returns {function}
     */
    register(key, value) {
        return this.useState(value, key)[1];
    }

    lockUpdateRealState() {
        this.canUpdateStateByKey = false;
    }

    subscribe(key, callback) {
        // Support array keys: subscribe(['key1', 'key2'], callback)
        // Callback will be called once when any key changes
        if(Array.isArray(key)){
            // Validate callback
            if(key.length === 0) {
                return () => {};
            }
            if(key.length === 1){
                // Single key in array, redirect to single key subscription
                return this.subscribe(key[0], callback);
            }
            if(typeof callback !== 'function'){
                logger.error('ViewState.subscribe: callback must be a function for array keys', {
                    keys: key,
                    callbackType: typeof callback
                });
                return () => {};
            }
            
            const keys = new Set();
            for(const k of key) {
                if(typeof k === 'string' && 
                   this.states[k] && 
                   !this.ownProperties.includes(k) && 
                   !this.ownMethods.includes(k)) {
                    keys.add(k);
                }
            }
            
            if(keys.size === 0){
                return () => {};
            }
            
            const listener = { keys, callback, called: false };
            this.multiKeyListeners.push(listener);
            
            // Return unsubscribe function
            return () => {
                const index = this.multiKeyListeners.indexOf(listener);
                if(index !== -1){
                    this.multiKeyListeners.splice(index, 1);
                }
            };
        }
        
        // Support object keys: subscribe({key1: cb1, key2: cb2})
        if(typeof key === "object" && key !== null){
            const unsubscribes = {};
            for(const k of Object.keys(key)){
                unsubscribes[k] = this.subscribe(k, key[k]);
            }
            return () => {
                for(const k of Object.keys(unsubscribes)){
                    unsubscribes[k]();
                }
            };
        }
        
        // Support space-separated string keys: subscribe("key1 key2", callback)
        if(typeof key === 'string' && key.includes(' ')){
            const keyArray = key.split(/\s+/).filter(k => k.length > 0);
            return this.subscribe(keyArray, callback);
        }
        
        // Single key subscription
        if (typeof key !== 'string' || this.ownProperties.includes(key) || this.ownMethods.includes(key)) {
            return () => {};
        }

        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);

        let index = this.listeners.get(key).length - 1;
        return () => {
            this.listeners.get(key).splice(index, 1);
            if (this.listeners.get(key).length === 0) {
                this.listeners.delete(key);
            }
        };
    }

    unsubscribe(key, callback = null) {
        // Support array keys (order-independent)
        if(Array.isArray(key)){
            if(key.length == 0){
                return;
            }

            if(key.length == 1){
                // Single key in array, redirect to single key unsubscription
                this.unsubscribe(key[0], callback);
                return;
            }
            
            const keySet = new Set(key);
            
            // Helper function to check if two Sets are equal
            const areSetsEqual = (set1, set2) => {
                if(set1.size !== set2.size) return false;
                for(const k of set1){
                    if(!set2.has(k)) return false;
                }
                return true;
            };
            
            if(!callback){
                // Remove ALL multi-key listeners with same key set
                for(let i = this.multiKeyListeners.length - 1; i >= 0; i--){
                    if(areSetsEqual(this.multiKeyListeners[i].keys, keySet)){
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }
            
            // Remove specific listener with callback
            const index = this.multiKeyListeners.findIndex(listener => {
                return listener.callback === callback && areSetsEqual(listener.keys, keySet);
            });
            
            if(index !== -1){
                this.multiKeyListeners.splice(index, 1);
            }
            return;
        }
        
        // Support object keys
        if(typeof key === "object" && key !== null){
            for(const k of Object.keys(key)){
                this.unsubscribe(k, key[k]);
            }
            return;
        }
        
        // Single key unsubscription
        if (typeof key !== 'string' || this.ownProperties.includes(key) || this.ownMethods.includes(key)) {
            return;
        }
        if (callback && typeof callback !== 'function') {
            return;
        }
        if (callback) {
            const listeners = this.listeners.get(key);
            if(listeners){
                let index = listeners.indexOf(callback);
                if (index !== -1) {
                    listeners.splice(index, 1);
                    if (listeners.length === 0) {
                        this.listeners.delete(key);
                    }
                }
            }
        } else {
            this.listeners.delete(key);
        }
    }

    on(key, callback) {
        return this.subscribe(key, callback);
    }

    off(key, callback = null) {
        this.unsubscribe(key, callback);
    }

    parseCompareValue(value) {
        if (value === null || typeof value === 'undefined') {
            return value;
        }
        if (typeof value === 'object') {
            let isArray = Array.isArray(value);
            let data = isArray ? [] : {};
            let d = isArray ? value.forEach(v => data.push(this.parseCompareValue(v))) : Object.entries(value).forEach(([k, v]) => data[k] = this.parseCompareValue(v));
            return JSON.stringify(data);
        }
        return value;
    }

    /**
     * Clean up all listeners and pending operations
     * Prevents memory leaks by properly cancelling RAF and clearing references
     * 
     * Call this when destroying a view
     * 
     * @example
     * // In ViewController beforeDestroy
     * beforeDestroy() {
     *   this.states.__?.destroy();
     * }
     */
    destroy() {
        // Mark as destroyed to prevent new operations
        this._isDestroyed = true;
        
        // Cancel pending flush operation
        if (this.flushRAF !== null) {
            try {
                cancelAnimationFrame(this.flushRAF);
            } catch (error) {
                logger.error('[StateManager] Error cancelling RAF:', error);
            }
            this.flushRAF = null;
        }
        
        // Clear all listeners
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.pendingChanges.clear();
        
        // Reset all flags
        this.hasPendingFlush = false;
        this.isFlushing = false;
        this.readyToCommit = false;
        
        // Clear states
        this.states = {};
        this.setters = {};
        
        // WeakMap will be garbage collected automatically
        this._scopedData = new WeakMap();
        
        // Nullify controller reference to break circular reference
        this.controller = null;
        
        logger.log('[StateManager] Destroyed successfully');
    }
    
    /**
     * Reset state manager to initial state
     * Keeps structure but clears all data
     * 
     * Use when you want to reuse the manager with fresh state
     */
    reset() {
        // Cancel pending flush
        if (this.flushRAF !== null) {
            try {
                cancelAnimationFrame(this.flushRAF);
            } catch (error) {
                logger.error('[StateManager] Error cancelling RAF during reset:', error);
            }
            this.flushRAF = null;
        }
        
        // Reset state tracking
        this.stateIndex = 0;
        this.canUpdateStateByKey = true;
        
        // Clear listeners and pending changes
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.pendingChanges.clear();
        
        // Reset flags
        this.hasPendingFlush = false;
        this.isFlushing = false;
        
        // Reset counters
        this._flushCount = 0;
        
        logger.log('[StateManager] Reset successfully');
    }

    toJSON() {
        const data = {};
        Object.entries(this.states).forEach(([key, state]) => {
            data[key] = state.value;
        });
        return data;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }

}

export class ViewState {
    constructor(view) {
        const manager = new StateManager(view, this);
        __defineProp(this, '__', {
            value: manager,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    }

    /**
     * @returns {StateManager}
     */
    toJSON() {
        return this.__.toJSON();
    }

    toString() {
        return this.__.toString();
    }

}

