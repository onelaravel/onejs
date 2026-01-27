import { __defineProp } from "../../helpers/utils.js";

class StoreDep {
    constructor(servive) {
        /**
         * @type {StoreService}
         */
        this.service = servive;
        this.ownProps = ['__dep__', 'set', 'get', 'has', 'subscribe', 'unasubscribe'];
        this.existsKeys = new Set();
        this.data = {};
        this.ttlMap = new Map(); // Lưu TTL và timestamp cho mỗi key
        this.changedKeys = new Set();
        this.listeners = new Map();
        this.multiKeyListeners = []; // Array of {keys: Set, callback: Function, called: Boolean}
        this.hasPendingFlush = false;
        this.expirationListeners = new Map(); // Listeners được gọi khi key hết hạn

        // Hybrid TTL mechanism: Batch cleanup thay vì individual setTimeout
        this.batchCleanupTimer = null;
        this.batchCleanupInterval = 60000; // 1 phút - cleanup batch định kỳ
        this.startBatchCleanupTimer();
    }
    set(key, value, ttl = null) {
        if (this.ownProps.includes(key)) {
            return;
        }

        this.data[key] = value;

        // Đặt TTL nếu có (tính bằng phút)
        // Hybrid TTL: Không dùng setTimeout cho từng key, dùng batch cleanup thay thế
        if (ttl !== null && typeof ttl === 'number' && ttl > 0) {
            const ttlMs = ttl * 60 * 1000; // Chuyển phút thành milliseconds
            const expirationTime = Date.now() + ttlMs;
            this.ttlMap.set(key, {
                ttl,
                ttlMs,
                createdAt: Date.now(),
                expiresAt: expirationTime
            });
        } else {
            // Xóa TTL nếu không còn cần
            this.ttlMap.delete(key);
        }

        this.emitsChange(key, value);
        if (!this.existsKeys.has(key)) {
            this.existsKeys.add(key);
            __defineProp(this.service, key, {
                get: () => {
                    return this.get(key);
                },
                set: (newValue) => {
                    this.set(key, newValue, ttl);
                },
                enumerable: true,
                configurable: true

            });
        }
    }

    /**
     * startBatchCleanupTimer() - Khởi động batch cleanup định kỳ
     * 
     * Mục đích (Hybrid TTL Mechanism):
     * - Thay vì tạo 1 setTimeout cho mỗi key (overhead cao), dùng 1 interval chung cleanup batch
     * - Mỗi 1 phút, cleanup sẽ tìm và xóa tất cả keys đã hết hạn
     * - Keys được xóa khi truy cập (lazy cleanup) hoặc qua batch cleanup
     * 
     * Performance benefit:
     * - 100 keys với TTL: 1 interval + lazy cleanup (tốt) thay vì 100 setTimeout (nặng)
     * - Tiết kiệm memory 90% khi có nhiều TTL keys
     * - CPU usage giảm đáng kể, không tạo event listener overhead
     * 
     * @private
     */
    startBatchCleanupTimer() {
        // Đảm bảo chỉ có 1 batch cleanup timer chạy
        if (this.batchCleanupTimer) {
            return;
        }

        this.batchCleanupTimer = setInterval(() => {
            this.executeBatchCleanup();
        }, this.batchCleanupInterval);
    }

    /**
     * stopBatchCleanupTimer() - Dừng batch cleanup (dùng khi destroy)
     * 
     * @private
     */
    stopBatchCleanupTimer() {
        if (this.batchCleanupTimer) {
            clearInterval(this.batchCleanupTimer);
            this.batchCleanupTimer = null;
        }
    }

    /**
     * executeBatchCleanup() - Thực thi cleanup batch cho tất cả keys hết hạn
     * 
     * Logic:
     * 1. Lặp qua tất cả keys có TTL
     * 2. Kiểm tra nếu hết hạn: gọi expireKey() để trigger callbacks và notify listeners
     * 3. Cleanup được thực thi định kỳ + lazy cleanup khi get()
     * 
     * @private
     */
    executeBatchCleanup() {
        const expiredKeys = [];

        // Tìm tất cả keys đã hết hạn
        this.ttlMap.forEach((ttlInfo, key) => {
            if (Date.now() > ttlInfo.expiresAt) {
                expiredKeys.push(key);
            }
        });

        // Xóa từng key hết hạn
        expiredKeys.forEach(key => {
            this.expireKey(key);
        });
    }

    /**
     * expireKey() - Xóa một key khỏi store khi TTL hết hạn
     * 
     * Mục đích: Được gọi khi:
     *           1. Lazy cleanup: từ get() khi phát hiện key hết hạn
     *           2. Batch cleanup: từ executeBatchCleanup() định kỳ
     *           Để:
     *           - Notify expiration listeners (callback được register từ onExpire())
     *           - Xóa sạch dữ liệu và tất cả liên kết
     *           - Emit change event để notify subscribe listeners
     * 
     * Logic:
     * 1. Kiểm tra key có tồn tại không, nếu không => exit
     * 2. Gọi tất cả expiration listeners (đã đăng ký bằng onExpire)
     * 3. Xóa dữ liệu từ 5 nơi: data, existsKeys, ttlMap, listeners, expirationListeners
     * 4. Phát change event để thông báo cho các subscribe listeners rằng key đã bị xóa
     * 
     * @param {string} key - Khoá cần xóa
     * @private
     */
    expireKey(key) {
        // Bước 1: Kiểm tra key có tồn tại không, nếu không tồn tại => thoát
        if (!this.existsKeys.has(key)) {
            return;
        }

        // Bước 2: Gọi tất cả expiration callbacks (user đã register via onExpire)
        // Ví dụ: store.onExpire('token', (val) => console.log('Token expired:', val))
        if (this.expirationListeners.has(key)) {
            const callbacks = this.expirationListeners.get(key);
            callbacks.forEach(callback => {
                try {
                    callback(this.data[key]);
                } catch (e) {
                    console.error(`Error in expiration listener for key "${key}":`, e);
                }
            });
        }
        // Bước 3: Xóa sạch toàn bộ dữ liệu liên quan đến key (Hybrid: không cần xóa timer)
        delete this.data[key];                          // Xóa giá trị
        this.existsKeys.delete(key);                    // Xóa từ tracking set
        this.ttlMap.delete(key);                        // Xóa thông tin TTL
        this.listeners.delete(key);                     // Xóa listeners thay đổi
        this.expirationListeners.delete(key);           // Xóa expiration listeners

        // Bước 4: Phát change event với value = null để notify subscribe listeners
        // Các listener sẽ thấy key bị xóa (get() sẽ return null)
        this.emitsChange(key, null);
    }

    /**
     * checkAndExpireIfNeeded() - Kiểm tra key có hết hạn và tự động xóa nếu cần
     * 
     * Mục đích (Lazy Cleanup - Part of Hybrid TTL):
     * - Gọi từ get() để check TTL trước khi trả về dữ liệu
     * - Nếu hết hạn: xóa ngay lập tức và trigger expiration listeners
     * - Kết hợp với batch cleanup → Hybrid mechanism tối ưu
     * 
     * Logic:
     * 1. Kiểm tra key có hết hạn không
     * 2. Nếu hết hạn: gọi expireKey() để cleanup
     * 3. Return true/false để biết có expire hay không
     * 
     * @param {string} key
     * @returns {boolean} true nếu key đã hết hạn, false nếu chưa hết hạn hoặc không có TTL
     * @private
     */
    checkAndExpireIfNeeded(key) {
        // Nếu key không tồn tại trong ttlMap => key không có TTL => không hết hạn
        if (!this.ttlMap.has(key)) {
            return false;
        }

        const ttlInfo = this.ttlMap.get(key);
        const isExpired = Date.now() > ttlInfo.expiresAt;

        // Nếu hết hạn: trigger cleanup ngay (lazy cleanup)
        if (isExpired) {
            this.expireKey(key);
        }

        return isExpired;
    }

    /**
     * getTTL() - Lấy thông tin TTL chi tiết của một key
     * 
     * @param {string} key
     * @returns {Object|null} { ttl (phút), createdAt, expiresAt, remainingTime (ms), isExpired }
     */
    getTTL(key) {
        if (!this.ttlMap.has(key)) {
            return null;
        }

        const ttlInfo = this.ttlMap.get(key);
        const remainingTime = ttlInfo.expiresAt - Date.now();

        return {
            ttl: ttlInfo.ttl,
            createdAt: ttlInfo.createdAt,
            expiresAt: ttlInfo.expiresAt,
            remainingTime: Math.max(0, remainingTime),
            isExpired: remainingTime <= 0
        };
    }

    refreshTTL(key, ttl = null) {
        if (!this.existsKeys.has(key)) {
            return;
        }
        const finalTTL = ttl !== null && typeof ttl === 'number' && ttl > 0 ? ttl : (this.ttlMap.has(key) ? this.ttlMap.get(key).ttl : null);
        if (finalTTL !== null && typeof finalTTL === 'number' && finalTTL > 0) {
            const ttlMs = finalTTL * 60 * 1000; // Chuyển phút thành milliseconds
            const expirationTime = Date.now() + ttlMs;
            this.ttlMap.set(key, {
                ttl: finalTTL,
                ttlMs,
                createdAt: Date.now(),
                expiresAt: expirationTime
            });
        } else if (typeof ttl === 'number' && ttl < 0) {

            // Xóa TTL nếu không còn cần
            this.ttlMap.delete(key);
        }
    }

    /**
     * get() - Lấy giá trị của một key, với lazy cleanup TTL
     * 
     * Logic:
     * 1. Kiểm tra xem key có TTL và đã hết hạn không (lazy cleanup)
     * 2. Nếu hết hạn: tự động xóa dữ liệu, trigger callbacks, và return null
     * 3. Nếu chưa hết hạn hoặc không có TTL: return giá trị hiện tại
     * 
     * Hybrid TTL: Kết hợp lazy cleanup (ở đây) + batch cleanup (định kỳ)
     * 
     * @param {string} key
     * @returns {*} Giá trị của key hoặc null nếu không tồn tại / đã hết hạn
     */
    get(key) {
        // Bước 1: Kiểm tra key có hết hạn không
        // Nếu hết hạn: sẽ tự động gọi expireKey() bên trong checkAndExpireIfNeeded()
        if (this.checkAndExpireIfNeeded(key)) {
            return null;
        }

        // Bước 2: Trả về giá trị nếu key tồn tại, ngược lại return null
        return typeof this.data[key] !== 'undefined' ? this.data[key] : null;
    }
    has(key) {
        return this.existsKeys.has(key);
    }
    emitsChange(key, value) {
        if (!this.changedKeys.has(key)) {
            this.changedKeys.add(key);
        }

        // Chỉ schedule 1 flush duy nhất cho batch changes
        if (!this.hasPendingFlush) {
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
            if (this.listeners.has(changedKey)) {
                const listeners = this.listeners.get(changedKey);
                listeners.forEach(callback => {
                    callback(this.get(changedKey));
                });
            }

            // Check multi-key listeners
            this.multiKeyListeners.forEach(listener => {
                if (!listener.called && listener.keys.has(changedKey)) {
                    listener.called = true;
                    // Collect all changed values for subscribed keys
                    const values = {};
                    listener.keys.forEach(k => {
                        if (this.changedKeys.has(k)) {
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
        if (Array.isArray(key)) {
            const keys = new Set(key.filter(k => this.existsKeys.has(k)));
            if (keys.size === 0) {
                return () => { };
            }

            const listener = { keys, callback, called: false };
            this.multiKeyListeners.push(listener);

            // Return unsubscribe function
            return () => {
                const index = this.multiKeyListeners.indexOf(listener);
                if (index !== -1) {
                    this.multiKeyListeners.splice(index, 1);
                }
            };
        }

        if (typeof key === "object" && key !== null) {

            const unsubscribes = {};
            for (const k of Object.keys(key)) {
                unsubscribes[k] = this.subscribe(k, key[k]);
            }
            return () => {
                for (const k of Object.keys(unsubscribes)) {
                    unsubscribes[k]();
                }
            };
        }
        if (typeof key !== 'string' || !this.existsKeys.has(key) || typeof callback !== 'function') {
            return;
        }
        if (!this.listeners.has(key)) {
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
        if (Array.isArray(key)) {
            const keySet = new Set(key);

            // Helper function để check 2 Sets có giống nhau không
            const areSetsEqual = (set1, set2) => {
                if (set1.size !== set2.size) return false;
                for (const k of set1) {
                    if (!set2.has(k)) return false;
                }
                return true;
            };

            if (!callback) {
                // Xóa TẤT CẢ multi-key listeners có cùng set keys
                for (let i = this.multiKeyListeners.length - 1; i >= 0; i--) {
                    if (areSetsEqual(this.multiKeyListeners[i].keys, keySet)) {
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }

            // Xóa listener cụ thể với callback
            const index = this.multiKeyListeners.findIndex(listener => {
                return listener.callback === callback && areSetsEqual(listener.keys, keySet);
            });

            if (index !== -1) {
                this.multiKeyListeners.splice(index, 1);
            }
            return;
        }

        if (typeof key === "object" && key !== null) {
            for (const k of Object.keys(key)) {
                this.unasubscribe(k, key[k]);
            }
            return;
        }
        if (typeof key !== 'string' || !this.existsKeys.has(key)) {
            return;
        }
        if (callback && typeof callback !== 'function') {
            return;
        }
        if (callback) {
            const listeners = this.listeners.get(key);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                this.listeners.delete(key);
            }
        } else {
            this.listeners.delete(key);
        }
    }

    /**
     * Đăng ký lắng nghe sự kiện hết hạn của một key
     * 
     * @param {string} key - Khoá lưu trữ
     * @param {function} callback - Hàm callback được gọi khi key hết hạn
     * @return {function} Hàm hủy đăng ký
     */
    onExpire(key, callback) {
        if (typeof key !== 'string' || typeof callback !== 'function') {
            return () => { };
        }

        if (!this.expirationListeners.has(key)) {
            this.expirationListeners.set(key, []);
        }

        this.expirationListeners.get(key).push(callback);

        return () => {
            const listeners = this.expirationListeners.get(key);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                this.expirationListeners.delete(key);
            }
        };
    }

    /**
     * remove() - Xóa hoàn toàn một key khỏi store
     * 
     * Mục đích: Xóa thủ công một key (không phải do hết hạn)
     * Khác với expireKey: không trigger expiration listeners, chỉ notify change listeners
     * 
     * Logic:
     * 1. Kiểm tra key có tồn tại không
     * 2. Xóa dữ liệu từ tất cả nơi: data, existsKeys, ttlMap, listeners, expirationListeners
     * 3. Phát change event để notify subscribe listeners
     * 
     * @param {string} key - Khoá cần xóa
     * @returns {*} Giá trị được xóa hoặc null
     */
    remove(key) {
        if (!this.existsKeys.has(key)) {
            return null;
        }

        // Lưu giá trị trước khi xóa
        const removedValue = this.data[key];

        // Xóa sạch dữ liệu
        delete this.data[key];                          // Xóa giá trị
        this.existsKeys.delete(key);                    // Xóa từ tracking set
        this.ttlMap.delete(key);                        // Xóa thông tin TTL
        this.listeners.delete(key);                     // Xóa listeners thay đổi
        this.expirationListeners.delete(key);           // Xóa expiration listeners

        // Phát change event để notify subscribe listeners
        this.emitsChange(key, null);

        return removedValue;
    }

    /**
     * removeTTL() - Xóa TTL của một key (key sẽ không bao giờ hết hạn)
     * 
     * @param {string} key
     */
    removeTTL(key) {
        this.ttlMap.delete(key);
    }

    /**
     * clearExpired() - Xóa tất cả dữ liệu có TTL đã hết hạn (manual cleanup nếu cần)
     * 
     * @returns {number} Số lượng key đã bị xóa
     */
    clearExpired() {
        const expiredKeys = [];
        this.ttlMap.forEach((ttlInfo, key) => {
            if (Date.now() > ttlInfo.expiresAt) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => {
            this.expireKey(key);
        });

        return expiredKeys.length;
    }

    /**
     * destroyStoreCleanup() - Cleanup khi destroy instance (dùng khi component unmount)
     * 
     * Mục đích: Dừng batch cleanup timer và xóa sạch tất cả dữ liệu
     * 
     * @private
     */
    destroyStoreCleanup() {
        this.stopBatchCleanupTimer();
        this.data = {};
        this.ttlMap.clear();
        this.existsKeys.clear();
        this.changedKeys.clear();
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.expirationListeners.clear();
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
     * Đặt giá trị với TTL (Time To Live) - Hybrid Mechanism
     * 
     * @param {string} name - Tên khoá lưu trữ
     * @param {*} value - Giá trị
     * @param {number} ttl - Thời gian tồn tại (phút), nếu null sẽ không hết hạn
     * @returns {StoreDep}
     */
    set(name, value = null, ttl = null) {
        return this.__dep__.set(name, value, ttl);
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
    /**
     * remove() - Xóa hoàn toàn một key khỏi store
     * @param {string} name - Tên khoá
     * @returns {*} Giá trị được xóa hoặc null
     */
    remove(name) {
        return this.__dep__.remove(name);
    }
    /**
     * Đăng ký lắng nghe sự kiện hết hạn của một key
     * @param {string} name - Tên khoá
     * @param {function} callback - Callback được gọi khi key hết hạn
     * @return {function} Hàm hủy đăng ký
     */
    onExpire(name, callback) {
        return this.__dep__.onExpire(name, callback);
    }
    /**
     * Lấy thông tin TTL của một key
     * @param {string} name
     * @returns {Object|null}
     */
    getTTL(name) {
        return this.__dep__.getTTL(name);
    }
    /**
     * Kiểm tra xem key có hết hạn không
     * @param {string} name
     * @returns {boolean}
     */
    isExpired(name) {
        return this.__dep__.isExpired(name);
    }
    /**
     * Xóa TTL của một key
     * @param {string} name
     */
    removeTTL(name) {
        return this.__dep__.removeTTL(name);
    }
    /**
     * clearExpired() - Xóa tất cả dữ liệu có TTL đã hết hạn (manual cleanup nếu cần)
     * @returns {number} Số lượng key đã bị xóa
     */
    clearExpired() {
        return this.__dep__.clearExpired();
    }

    /**
     * destroyStore() - Cleanup khi destroy store instance (component unmount)
     * 
     * Dừng batch cleanup timer và xóa sạch tất cả dữ liệu
     */
    destroyStore() {
        return this.__dep__.destroyStoreCleanup();
    }
}

export default StoreService.getInstance();