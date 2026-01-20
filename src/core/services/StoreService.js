import { __defineProp } from "../../helpers/utils.js";

class StoreDep{
    constructor(servive) {
        /**
         * @type {StoreService}
         */
        this.service = servive;
        this.ownProps = ['__dep__', 'set', 'get', 'has', 'subscribe', 'unasubscribe'];
        this.existsKeys = new Set();
        this.data = {};
        this.changedKeys = new Set();
        this.listeners = new Map();
        this.multiKeyListeners = []; // Array of {keys: Set, callback: Function, called: Boolean}
        this.hasPendingFlush = false;
    }
    set(key, value) {
        if(this.ownProps.includes(key)){
            return;
        }
        this.data[key] = value;
        this.emitsChange(key, value);
        if(!this.existsKeys.has(key)){
            this.existsKeys.add(key);
            __defineProp(this.service, key, {
                get: () => {
                    return this.get(key);
                },
                set: (newValue) => {
                    this.set(key, newValue);
                },
                enumerable: true,
                configurable: true
                
            });
        }
    }
    get(key) {
        return typeof this.data[key] !== 'undefined' ? this.data[key] : null;
    }
    has(key) {
        return this.existsKeys.has(key);
    }
    emitsChange(key, value) {
        if(!this.changedKeys.has(key)){
            this.changedKeys.add(key);
        }
        
        // Chỉ schedule 1 flush duy nhất cho batch changes
        if(!this.hasPendingFlush){
            this.hasPendingFlush = true;
            Promise.resolve().then(() => {
                this.flushChanges();
            });
        }
    }
    
    flushChanges() {
        // Reset multi-key listeners called flag
        this.multiKeyListeners.forEach(listener => {
            listener.called = false;
        });
        
        // Gọi single-key listeners
        this.changedKeys.forEach(changedKey => {
            if(this.listeners.has(changedKey)){
                const listeners = this.listeners.get(changedKey);
                listeners.forEach(callback => {
                    callback(this.get(changedKey));
                });
            }
            
            // Check multi-key listeners
            this.multiKeyListeners.forEach(listener => {
                if(!listener.called && listener.keys.has(changedKey)){
                    listener.called = true;
                    // Collect all changed values for subscribed keys
                    const values = {};
                    listener.keys.forEach(k => {
                        if(this.changedKeys.has(k)){
                            values[k] = this.get(k);
                        }
                    });
                    listener.callback(values);
                }
            });
        });
        
        this.changedKeys.clear();
        this.hasPendingFlush = false;
    }
    /**
     * Đăng ký lắng nghe thay đổi của khoá lưu trữ
     * 
     * @param {string|array} key - Khoá lưu trữ hoặc array của các khoá
     * @param {function} callback - Hàm callback khi khoá thay đổi
     * @return {function} Hàm hủy đăng ký lắng nghe
     */
    subscribe(key, callback) {
        // Hỗ trợ subscribe với array keys: subscribe(['key1', 'key2'], callback)
        // Callback sẽ được gọi 1 lần duy nhất khi bất kỳ key nào thay đổi
        if(Array.isArray(key)){
            const keys = new Set(key.filter(k => this.existsKeys.has(k)));
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
        if(typeof key !== 'string' || !this.existsKeys.has(key) || typeof callback !== 'function'){
            return;
        }
        if(!this.listeners.has(key)){
            this.listeners.set(key, []);
        }
        const listeners = this.listeners.get(key);
        listeners.push(callback);
        
        return () => this.unasubscribe(key, callback);
    }

    /**
     * Hủy đăng ký lắng nghe thay đổi của khoá lưu trữ
     * 
     * @param {string|array} key - Khoá lưu trữ hoặc array của các khoá
     * @param {function|null} callback - Hàm callback đã đăng ký (nếu null sẽ hủy tất cả callback của khoá)
     */
    unasubscribe(key, callback = null) {
        // Hỗ trợ unsubscribe với array keys (không phân biệt thứ tự)
        if(Array.isArray(key)){
            const keySet = new Set(key);
            
            // Helper function để check 2 Sets có giống nhau không
            const areSetsEqual = (set1, set2) => {
                if(set1.size !== set2.size) return false;
                for(const k of set1){
                    if(!set2.has(k)) return false;
                }
                return true;
            };
            
            if(!callback){
                // Xóa TẤT CẢ multi-key listeners có cùng set keys
                for(let i = this.multiKeyListeners.length - 1; i >= 0; i--){
                    if(areSetsEqual(this.multiKeyListeners[i].keys, keySet)){
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }
            
            // Xóa listener cụ thể với callback
            const index = this.multiKeyListeners.findIndex(listener => {
                return listener.callback === callback && areSetsEqual(listener.keys, keySet);
            });
            
            if(index !== -1){
                this.multiKeyListeners.splice(index, 1);
            }
            return;
        }
        
        if(typeof key === "object" && key !== null){
            for(const k of Object.keys(key)){
                this.unasubscribe(k, key[k]);
            }
            return;
        }
        if(typeof key !== 'string' || !this.existsKeys.has(key)){
            return;
        }
        if(callback && typeof callback !== 'function'){
            return;
        }
        if(callback){
            const listeners = this.listeners.get(key);
            const index = listeners.indexOf(callback);
            if(index !== -1){
                listeners.splice(index, 1);
            }
            if(listeners.length === 0){
                this.listeners.delete(key);
            }
        } else {
            this.listeners.delete(key);
        }
    }
}

export class StoreService {
    static intances = new Map();
    static getInstance(name = null) {
        if (!name || name === '' || name === 'default' || name === undefined) {
            name = 'default';
        }
        if (!StoreService.intances.has(name)) {
            StoreService.intances.set(name, new StoreService());
        }
        return StoreService.intances.get(name);
    }
    constructor() {
        /**
         * @type {Map<string, StoreDep>}
         * @private
         */
        const dep = new StoreDep(this);
        Object.defineProperty(this, '__dep__', {
            value: dep,
            writable: false,
            enumerable: false,
            configurable: false
        });
    }
    /**
     * Lấy hoặc tạo một kho lưu trữ theo tên
     * @param {string} name - Tên kho lưu trữ
     * @returns {StoreDep}
     */
    set(name, value = null) {
        return this.__dep__.set(name, value);
    }
    get(name) {
        return this.__dep__.get(name);
    }
    has(name) {
        return this.__dep__.has(name);
    }
    subscribe(name, callback) {
        return this.__dep__.subscribe(name, callback);
    }
    unsubscribe(name, callback) {
        return this.__dep__.unasubscribe(name, callback);
    }
}

export default StoreService.getInstance();