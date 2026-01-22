export class EventService {
    static instances = new Map();
    static getInstance(name = null) {
        if (!name || name === '' || name === undefined) {
            name = 'default';
        }
        if (!EventService.instances.has(name)) {
            EventService.instances.set(name, new EventService());
        }
        return EventService.instances.get(name);
    }

    static removeInstance(name) {
        if (EventService.instances.has(name)) {
            EventService.instances.delete(name);
        }
    }

    static instance(name = null) {
        return EventService.getInstance(name);
    }

    static clearInstances() {
        EventService.instances.clear();
    }
    
    constructor() {
        /**
         * @type {Map<string, Array<{callback: Function, once: boolean}>>}
         * @private
         */
        this.listeners = new Map();
        
        /**
         * Multi-event listeners: Khi subscribe nhiều events với 1 callback
         * @type {Array<{events: Set<string>, callback: Function, once: boolean, called: boolean}>}
         * @private
         */
        this.multiEventListeners = [];
        
        /**
         * Track xem có pending flush không (để batch calls)
         * @private
         */
        this.hasPendingFlush = false;
        
        /**
         * Set callbacks đã được gọi trong batch hiện tại
         * @private
         */
        this.calledInBatch = new Set();
    }

    /**
     * Đăng ký lắng nghe một event
     * 
     * @param {string|array|object} eventName - Tên event hoặc array các tên event hoặc object {event: callback}
     * @param {function} callback - Hàm callback khi event được trigger
     * @param {boolean} once - Chỉ chạy 1 lần rồi tự động unsubscribe
     * @return {function} Hàm hủy đăng ký
     */
    on(eventName, callback, once = false) {
        // Hỗ trợ object syntax: on({event1: fn1, event2: fn2})
        if(typeof eventName === 'object' && !Array.isArray(eventName)){
            const unsubscribers = [];
            for(const [event, fn] of Object.entries(eventName)){
                if(typeof fn === 'function'){
                    unsubscribers.push(this.on(event, fn, callback === true));
                }
            }
            // Return combined unsubscribe function
            return () => {
                unsubscribers.forEach(unsub => unsub());
            };
        }
        
        // Hỗ trợ string với spaces: "event1 event2 event3"
        if(typeof eventName === 'string' && eventName.includes(' ')){
            eventName = eventName.split(/\s+/).filter(e => e);
        }
        
        // Hỗ trợ subscribe nhiều events cùng lúc với 1 callback
        // Callback chỉ được gọi 1 lần trong cùng batch dù nhiều events được emit
        if(Array.isArray(eventName)){
            const events = new Set(eventName.filter(e => typeof e === 'string'));
            if(events.size === 0){
                return () => {};
            }
            
            const listener = { events, callback, once, called: false };
            this.multiEventListeners.push(listener);
            
            // Return unsubscribe function
            return () => {
                const index = this.multiEventListeners.indexOf(listener);
                if(index !== -1){
                    this.multiEventListeners.splice(index, 1);
                }
            };
        }

        if(typeof eventName !== 'string' || typeof callback !== 'function'){
            return () => {};
        }

        if(!this.listeners.has(eventName)){
            this.listeners.set(eventName, []);
        }

        const listener = { callback, once };
        this.listeners.get(eventName).push(listener);

        // Return unsubscribe function
        return () => this.off(eventName, callback);
    }

    /**
     * Đăng ký lắng nghe event chỉ chạy 1 lần
     * 
     * @param {string|array} eventName - Tên event hoặc array các tên event
     * @param {function} callback - Hàm callback
     * @return {function} Hàm hủy đăng ký
     */
    once(eventName, callback) {
        return this.on(eventName, callback, true);
    }

    /**
     * Hủy đăng ký lắng nghe event
     * 
     * @param {string|array|object} eventName - Tên event hoặc array các tên event hoặc "event1 event2..." hoặc object {event: callback}
     * @param {function|null} callback - Callback cụ thể (null = xóa tất cả)
     */
    off(eventName, callback = null) {
        // Hỗ trợ object syntax: off({event1: fn1, event2: fn2})
        if(typeof eventName === 'object' && !Array.isArray(eventName)){
            for(const [event, fn] of Object.entries(eventName)){
                this.off(event, fn);
            }
            return;
        }
        
        // Hỗ trợ string với spaces: "event1 event2 event3"
        if(typeof eventName === 'string' && eventName.includes(' ')){
            eventName = eventName.split(/\s+/).filter(e => e);
        }
        
        // Hỗ trợ unsubscribe nhiều events
        if(Array.isArray(eventName)){
            const eventSet = new Set(eventName);
            
            const areSetsEqual = (set1, set2) => {
                if(set1.size !== set2.size) return false;
                for(const e of set1){
                    if(!set2.has(e)) return false;
                }
                return true;
            };
            
            if(!callback){
                // Xóa TẤT CẢ multi-event listeners có cùng set events
                for(let i = this.multiEventListeners.length - 1; i >= 0; i--){
                    if(areSetsEqual(this.multiEventListeners[i].events, eventSet)){
                        this.multiEventListeners.splice(i, 1);
                    }
                }
                
                // Xóa tất cả single-event listeners của các events này
                eventName.forEach(name => {
                    if(this.listeners.has(name)){
                        this.listeners.delete(name);
                    }
                });
                return;
            }
            
            // Xóa listener cụ thể từ multi-event listeners
            const index = this.multiEventListeners.findIndex(listener => {
                return listener.callback === callback && areSetsEqual(listener.events, eventSet);
            });
            
            if(index !== -1){
                this.multiEventListeners.splice(index, 1);
            }
            
            // Xóa callback từ tất cả single-event listeners của các events này
            eventName.forEach(name => {
                if(this.listeners.has(name)){
                    const listeners = this.listeners.get(name);
                    const idx = listeners.findIndex(listener => listener.callback === callback);
                    
                    if(idx !== -1){
                        listeners.splice(idx, 1);
                    }
                    
                    if(listeners.length === 0){
                        this.listeners.delete(name);
                    }
                }
            });
            return;
        }

        if(typeof eventName !== 'string'){
            return;
        }

        if(!this.listeners.has(eventName)){
            return;
        }

        // Xóa tất cả listeners của event
        if(!callback){
            this.listeners.delete(eventName);
            return;
        }

        // Xóa listener cụ thể
        const listeners = this.listeners.get(eventName);
        const index = listeners.findIndex(listener => listener.callback === callback);
        
        if(index !== -1){
            listeners.splice(index, 1);
        }

        // Cleanup nếu không còn listener nào
        if(listeners.length === 0){
            this.listeners.delete(eventName);
        }
    }

    /**
     * Trigger một event
     * 
     * @param {string} eventName - Tên event
     * @param {...any} args - Arguments truyền cho callback
     */
    emit(eventName, ...args) {
        if(typeof eventName !== 'string'){
            return;
        }

        // Schedule flush nếu chưa có
        if(!this.hasPendingFlush){
            this.hasPendingFlush = true;
            Promise.resolve().then(() => {
                this.flushBatch();
            });
        }

        // Single-event listeners
        if(this.listeners.has(eventName)){
            const listeners = this.listeners.get(eventName);
            const toRemove = [];

            listeners.forEach((listener, index) => {
                // Batch deduplication: Chỉ gọi callback 1 lần trong batch
                if(!this.calledInBatch.has(listener.callback)){
                    this.calledInBatch.add(listener.callback);
                    
                    try {
                        listener.callback(...args);
                    } catch(error) {
                        console.error(`Error in event listener for "${eventName}":`, error);
                    }
                }

                if(listener.once){
                    toRemove.push(index);
                }
            });

            // Remove once listeners
            for(let i = toRemove.length - 1; i >= 0; i--){
                listeners.splice(toRemove[i], 1);
            }

            if(listeners.length === 0){
                this.listeners.delete(eventName);
            }
        }

        // Multi-event listeners
        this.multiEventListeners.forEach(listener => {
            if(!listener.called && listener.events.has(eventName)){
                listener.called = true;
                
                try {
                    listener.callback(...args);
                } catch(error) {
                    console.error(`Error in multi-event listener for "${eventName}":`, error);
                }
            }
        });
    }

    /**
     * Flush batch và reset flags
     * @private
     */
    flushBatch() {
        // Reset multi-event listeners called flag
        this.multiEventListeners.forEach(listener => {
            listener.called = false;
        });
        
        // Remove once multi-event listeners
        for(let i = this.multiEventListeners.length - 1; i >= 0; i--){
            if(this.multiEventListeners[i].once && this.multiEventListeners[i].called){
                this.multiEventListeners.splice(i, 1);
            }
        }
        
        // Clear batch tracking
        this.calledInBatch.clear();
        this.hasPendingFlush = false;
    }

    /**
     * Trigger event bất đồng bộ (async)
     * 
     * @param {string} eventName - Tên event
     * @param {...any} args - Arguments truyền cho callback
     * @return {Promise<void>}
     */
    async emitAsync(eventName, ...args) {
        if(typeof eventName !== 'string'){
            return;
        }

        if(!this.listeners.has(eventName)){
            return;
        }

        const listeners = this.listeners.get(eventName);
        const toRemove = [];

        // Gọi tất cả listeners và chờ nếu là async
        for(let i = 0; i < listeners.length; i++){
            const listener = listeners[i];
            try {
                await listener.callback(...args);
            } catch(error) {
                console.error(`Error in async event listener for "${eventName}":`, error);
            }

            if(listener.once){
                toRemove.push(i);
            }
        }

        // Remove once listeners
        for(let i = toRemove.length - 1; i >= 0; i--){
            listeners.splice(toRemove[i], 1);
        }

        if(listeners.length === 0){
            this.listeners.delete(eventName);
        }
    }

    /**
     * Kiểm tra có listener nào cho event không
     * 
     * @param {string} eventName - Tên event
     * @return {boolean}
     */
    hasListeners(eventName) {
        return this.listeners.has(eventName) && this.listeners.get(eventName).length > 0;
    }

    /**
     * Lấy số lượng listeners của event
     * 
     * @param {string} eventName - Tên event
     * @return {number}
     */
    listenerCount(eventName) {
        if(!this.listeners.has(eventName)){
            return 0;
        }
        return this.listeners.get(eventName).length;
    }

    /**
     * Lấy danh sách tất cả event names
     * 
     * @return {Array<string>}
     */
    eventNames() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Xóa tất cả listeners của tất cả events
     */
    clear() {
        this.listeners.clear();
    }

    createManager(packetName) {
        return EventService.getInstance(packetName);
    }

    addEventListener(eventName, callback) {
        return this.on(eventName, callback);
    }

    removeEventListener(eventName, callback = null) {
        this.off(eventName, callback);
    }

    dispatchEvent(eventName, ...args) {
        this.emit(eventName, ...args);
    }
}

export default EventService.getInstance();
