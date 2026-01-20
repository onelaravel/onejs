import OneDOM from '../OneDOM.js';
import logger from '../services/LoggerService.js';
import DOMBatcher from '../DOMBatcher.js';

/**
 * BindingManager
 * Quản lý tất cả các loại binding trong view:
 * - Input bindings (two-way data binding)
 * - Attribute bindings (reactive HTML attributes)
 * - Class bindings (reactive CSS classes)
 * - Thông báo thay đổi state
 * 
 * Quản lý bộ nhớ:
 * - Sử dụng WeakMap cho element references (tự động garbage collection)
 * - Dọn dẹp đúng cách trong method destroy()
 * - Validate element.isConnected trước khi thao tác
 * 
 * @class BindingManager
 * @since 2.0.0 - Sửa memory leak và cải thiện hiệu suất
 */
export class BindingManager {
    constructor(controller) {
        this.controller = controller;
        
        // Input binding (two-way data binding)
        this.bindingEventListeners = [];
        this.isBindingEventListenerStarted = false;
        
        /**
         * WeakMap lưu các cờ cập nhật riêng cho từng element
         * Ngăn cập nhật vòng tròn trong two-way binding
         * Tự động garbage collected khi element bị xóa
         * @type {WeakMap<HTMLElement, {pushing: boolean, syncing: boolean}>}
         */
        this.elementUpdateFlags = new WeakMap();
        
        /**
         * WeakMap lưu mapping element-to-listener
         * Để dọn dẹp và tra cứu hiệu quả
         * @type {WeakMap<HTMLElement, {eventType: string, handler: Function, stateKey: string}>}
         */
        this.elementListenerMap = new WeakMap();
        
        // Attribute binding (reactive attributes)
        this.attributeConfigs = [];
        this.attributeListeners = [];
        this.attributeIndex = 0;
        
        // Class binding (reactive CSS classes)
        this.classBindingConfigs = [];
        this.classBindingListeners = [];
        this.isClassBindingReadyToListen = false;
    }
    
    /**
     * Reset trạng thái binding manager
     * Xóa listeners nhưng KHÔNG xóa event listeners khỏi DOM
     * Dùng destroy() để dọn dẹp hoàn toàn
     */
    reset() {
        this.bindingEventListeners = [];
        this.attributeListeners = [];
    }

    /**
     * Bắt đầu two-way data binding event listeners
     * 
     * Tính năng:
     * - Chỉ xử lý các DOM element đã kết nối
     * - Sử dụng WeakMap để quản lý bộ nhớ tự động
     * - Ngăn listener trùng lặp trên cùng element
     * - Đồng bộ state ban đầu vào element
     * - Có thể gọi nhiều lần an toàn (idempotent)
     * 
     * @returns {void}
     * 
     * @example
     * // Trong mounted lifecycle
     * this._bindingManager.startBindingEventListener();
     */
    startBindingEventListener() {
        const selector = `[data-binding][data-view-id="${this.controller.id}"]`;
        const inputs = document.querySelectorAll(selector);
        
        if (inputs.length === 0) {
            logger.log(`[BindingManager] No binding inputs found for view: ${this.controller.id}`);
            return;
        }

        let attachedCount = 0;
        let skippedCount = 0;
        
        inputs.forEach(input => {
            // Validate element vẫn kết nối với DOM
            if (!input.isConnected) {
                logger.warn('[BindingManager] Skipping disconnected element', input);
                skippedCount++;
                return;
            }
            
            // Kiểm tra listener đã tồn tại cho element này chưa
            if (this.elementListenerMap.has(input)) {
                // Đã bind, bỏ qua
                skippedCount++;
                return;
            }
            
            const stateKey = input.getAttribute('data-binding');
            if (!stateKey) {
                logger.warn('[BindingManager] Missing data-binding attribute', input);
                skippedCount++;
                return;
            }
            
            // Trích xuất root key cho state change subscription
            // ví dụ: 'formData.name' -> 'formData'
            const rootStateKey = stateKey.split('.')[0];
            const tag = input.tagName.toLowerCase();
            const eventType = tag === 'select' ? 'change' : 'input';
            
            // Đồng bộ ban đầu: state → element
            this.syncStateToElement(input, stateKey);
            
            // Tạo event handler
            const handler = (event) => this.pushElementToState(input, stateKey);
            
            // Gắn listener
            input.addEventListener(eventType, handler);
            
            // Lưu trong WeakMap để tra cứu hiệu quả và tự động dọn dẹp
            this.elementListenerMap.set(input, {
                eventType,
                handler,
                stateKey
            });
            
            // Lưu trong array để tương thích (sẽ được dọn dẹp trong destroy)
            // Lưu ý: Lưu đầy đủ stateKey (ví dụ: 'formData.name') không chỉ rootKey
            this.bindingEventListeners.push({
                element: input,
                key: rootStateKey,        // Cho subscription cấp root
                stateKey: stateKey,       // Đường dẫn đầy đủ cho nested sync
                eventType,
                handler
            });
            
            attachedCount++;
        });
        
        this.isBindingEventListenerStarted = true;
        
        if (attachedCount > 0) {
            logger.log(`[BindingManager] Attached ${attachedCount} new binding listeners for view: ${this.controller.id}`);
        }
        if (skippedCount > 0) {
            logger.log(`[BindingManager] Skipped ${skippedCount} already-bound elements for view: ${this.controller.id}`);
        }
    }

    /**
     * Dừng two-way data binding event listeners
     * Xóa tất cả event listeners và xóa cấu trúc theo dõi
     * 
     * @returns {void}
     * 
     * @example
     * // Trong beforeDestroy lifecycle
     * this._bindingManager.stopBindingEventListener();
     */
    stopBindingEventListener() {
        if (!this.isBindingEventListenerStarted) {
            return;
        }
        
        let removedCount = 0;
        this.bindingEventListeners.forEach(({ element, eventType, handler }) => {
            try {
                // Xóa listener an toàn ngay cả khi element đã ngắt kết nối
                element.removeEventListener(eventType, handler);
                
                // Xóa khỏi WeakMap tracking
                if (this.elementListenerMap.has(element)) {
                    this.elementListenerMap.delete(element);
                }
                
                removedCount++;
            } catch (error) {
                logger.error('[BindingManager] Error removing event listener', error);
            }
        });
        
        // Xóa mảng
        this.bindingEventListeners = [];
        
        // Lưu ý: Các entry trong WeakMap sẽ được garbage collected tự động
        // khi elements bị xóa khỏi DOM
        
        this.isBindingEventListenerStarted = false;
        logger.log(`[BindingManager] Removed ${removedCount} binding listeners`);
    }

    /**
     * Đẩy giá trị element vào state (element → state)
     * Sử dụng trong two-way binding khi giá trị element thay đổi
     * 
     * Tính năng:
     * - Ngăn cập nhật vòng tròn dùng cờ WeakMap
     * - Validate element đang kết nối
     * - Xóa cờ async để hiệu suất tốt hơn
     * 
     * @param {HTMLElement} element - Input element
     * @param {string} stateKey - State key (hỗ trợ nested keys như 'user.name')
     * @returns {void}
     * 
     * @example
     * // Tự động gọi bởi event listener
     * input.addEventListener('input', (e) => {
     *   this.pushElementToState(e.target, 'username');
     * });
     */
    pushElementToState(element, stateKey) {
        // Validate element đang kết nối
        if (!element || !element.isConnected) {
            logger.warn('[BindingManager] Cannot push from disconnected element');
            return;
        }
        
        // Lấy hoặc khởi tạo cờ cho element này
        let flags = this.elementUpdateFlags.get(element);
        if (!flags) {
            flags = { pushing: false, syncing: false };
            this.elementUpdateFlags.set(element, flags);
        }
        
        // Ngăn cập nhật vòng tròn: nếu đang syncing state→element, bỏ qua
        if (flags.syncing) {
            return;
        }
        
        // Ngăn thao tác push trùng lặp
        if (flags.pushing) {
            return;
        }
        
        // Đặt cờ pushing
        flags.pushing = true;
        
        try {
            // Lấy giá trị từ element
            const value = OneDOM.getInputValue(element);
            
            // Cập nhật state (sẽ kích hoạt state change notifications)
            this.controller.states.__.updateStateAddressKey(stateKey, value);
        } catch (error) {
            logger.error('[BindingManager] Error pushing element to state', error);
        } finally {
            // Xóa cờ async để cho phép hoàn tất cập nhật state
            Promise.resolve().then(() => {
                const currentFlags = this.elementUpdateFlags.get(element);
                if (currentFlags) {
                    currentFlags.pushing = false;
                }
            });
        }
    }

    /**
     * Đồng bộ giá trị state vào element (state → element)
     * Sử dụng trong two-way binding khi state thay đổi
     * 
     * Tính năng:
     * - Ngăn cập nhật vòng tròn dùng cờ WeakMap
     * - Chỉ cập nhật nếu giá trị thực sự thay đổi
     * - Validate element đang kết nối
     * 
     * @param {HTMLElement} element - Input element
     * @param {string} stateKey - State key (hỗ trợ nested keys như 'user.name')
     * @returns {void}
     * 
     * @example
     * // Tự động gọi khi subscribed state thay đổi
     * this.states.subscribe('username', () => {
     *   this.syncStateToElement(inputElement, 'username');
     * });
     */
    syncStateToElement(element, stateKey) {
        // Validate element đang kết nối
        if (!element || !element.isConnected) {
            logger.warn('[BindingManager] Cannot sync to disconnected element');
            return;
        }
        
        // Lấy hoặc khởi tạo cờ cho element này
        let flags = this.elementUpdateFlags.get(element);
        if (!flags) {
            flags = { pushing: false, syncing: false };
            this.elementUpdateFlags.set(element, flags);
        }
        
        // Ngăn cập nhật vòng tròn: nếu đang pushing element→state, bỏ qua
        if (flags.pushing) {
            return;
        }
        
        // Ngăn thao tác sync trùng lặp
        if (flags.syncing) {
            return;
        }
        
        // Lấy giá trị state
        const stateValue = this.controller.states.__.getStateByAddressKey(stateKey);
        const currentValue = OneDOM.getInputValue(element);
        
        // Bỏ qua nếu giá trị không thay đổi (so sánh lỏng để tương thích number/string)
        if (currentValue == stateValue) {
            return;
        }
        
        // Đặt cờ syncing
        flags.syncing = true;
        
        try {
            // Cập nhật giá trị element
            OneDOM.setInputValue(element, stateValue);
        } catch (error) {
            logger.error('[BindingManager] Error syncing state to element', error);
        } finally {
            // Xóa cờ ngay lập tức (thao tác sync là đồng bộ)
            flags.syncing = false;
        }
    }

    startClassBindingEventListener() {
        if (this.isClassBindingReadyToListen || !this.classBindingConfigs || this.classBindingConfigs.length === 0) {
            return;
        }

        const removeClassBindingIDs = [];
        this.classBindingConfigs.forEach(binding => {
            const { id, config, states, initialiClass = '' } = binding;
            let element = null;
            if ((element && !element.isConnected) || element == null || typeof element === 'undefined') {
                const selector = `[data-one-class-id="${id}"]`;
                element = document.querySelector(selector);
                if (element == null) {
                    removeClassBindingIDs.push(id);
                    logger.warn(`⚠️ BindingManager.startClassBindingListener: No elements found for selector ${selector}`);
                    return;
                }
                binding.element = element;
            }

            this.classBindingListeners.push({ id, states, config, element, initialiClass });
            
            // Batch class operations using DOMBatcher
            const classOperations = [];
            
            String(initialiClass).split(' ').forEach(cls => {
                if (cls.trim() !== '') {
                    classOperations.push({ element, action: 'add', className: cls });
                }
            });

            Object.entries(config).forEach(([className, classConfig]) => {
                const { states: classStates, checker } = classConfig;
                if (typeof checker !== 'function') {
                    return;
                }
                const shouldAdd = checker();
                classOperations.push({ 
                    element, 
                    action: shouldAdd ? 'add' : 'remove', 
                    className 
                });
            });
            
            // Apply all class operations in one batch
            if (classOperations.length > 0) {
                DOMBatcher.write(() => {
                    classOperations.forEach(({ element, action, className }) => {
                        element.classList[action](className);
                    });
                });
            }
        });
        
        if (removeClassBindingIDs.length > 0) {
            this.classBindingConfigs = this.classBindingConfigs.filter(binding => !removeClassBindingIDs.includes(binding.id));
        }

        this.isClassBindingReadyToListen = true;
    }

    stopClassBindingEventListener() {
        this.isClassBindingReadyToListen = false;
        if (!this.classBindingConfigs || this.classBindingConfigs.length === 0) {
            return;
        }
    }

    notifyStateChanges(changedKeys) {
        if (this.controller.isRefreshing || !this.controller.isReadyToStateChangeListen) {
            return;
        }

        if (this.controller.subscribeStates) {
            if (this.controller.subscribeStates === true) {
                this.controller.refresh();
                return;
            }
            if (Array.isArray(this.controller.subscribeStates)) {
                const shouldRefresh = changedKeys.filter(key => this.controller.subscribeStates.includes(key)).length > 0;
                if (shouldRefresh) {
                    return this.controller.refresh();
                }
            }
            if (typeof this.controller.subscribeStates === 'function') {
                this.controller.subscribeStates(changedKeys);
            }
        }

        this.notifyAttributeBindings(changedKeys);
        this.notifyInputBindings(changedKeys);
        this.notifyClassBindings(changedKeys);

        if (this.controller.children && this.controller.children.length > 0) {
            this.controller.children.forEach(childScope => {
                if (childScope.subscribe && Array.isArray(childScope.subscribe)) {
                    const shouldRefresh = changedKeys.some(key => childScope.subscribe.includes(key));
                    if (shouldRefresh && childScope.view && childScope.view.__._bindingManager) {
                        childScope.view.__._bindingManager.notifyStateChanges(changedKeys);
                    }
                }
            });
        }
    }

    notifyAttributeBindings(changedKeys) {
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
            return;
        }
        if (!this.attributeListeners || this.attributeListeners.length === 0) {
            return;
        }
        
        const listenersToRemove = [];
        
        this.attributeListeners.forEach((listener, index) => {
            const { id, stateKeys, attrs } = listener;
            let element = listener.element;
            if (!element) {
                element = document.querySelector(`[data-one-attribute-id="${id}"]`);
                if (!element) {
                    listenersToRemove.push(id);
                    return;
                }
                listener.element = element;
            }
            
            const shouldUpdate = stateKeys.filter(key => changedKeys.includes(key)).length > 0;
            if (!attrs || !shouldUpdate) {
                return;
            }

            Object.entries(attrs).forEach(([attrKey, config]) => {
                const { states: stateKeys, render } = config;
                const shouldRender = stateKeys.filter(key => changedKeys.includes(key)).length > 0;
                if (!shouldRender) {
                    return;
                }
                if (element && typeof render === 'function') {
                    const newValue = render.call(this.controller.view, this.controller.states);
                    if(['disabled', 'checked', 'selected'].includes(attrKey)) {
                        if (newValue && !['', 'false', '0'].includes(String(newValue).toLowerCase())) {
                            element.setAttribute(attrKey, attrKey);
                        } else {
                            element.removeAttribute(attrKey);
                        }
                    }
                    else if (newValue === null || typeof newValue === 'undefined' || newValue === false) {
                        element.removeAttribute(attrKey);
                    } else {
                        element.setAttribute(attrKey, newValue);
                    }
                }
            });
        });
        
        this.attributeListeners = this.attributeListeners.filter(listener => !listenersToRemove.includes(listener.id));
    }

    notifyInputBindings(changedKeys) {
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
            return;
        }
        if (this.bindingEventListeners.length === 0) {
            return;
        }
        
        // For each binding, check if root key changed
        // and sync using full stateKey (supports nested like 'formData.name')
        this.bindingEventListeners.forEach(({ element, key, stateKey }) => {
            if (changedKeys.includes(key)) {
                this.syncStateToElement(element, stateKey || key);
            }
        });
    }

    notifyClassBindings(changedKeys) {
        if (!this.isClassBindingReadyToListen) {
            return;
        }
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
            return;
        }
        if (!this.classBindingListeners || this.classBindingListeners.length === 0) {
            return;
        }
        
        const removeClassBindingIDs = [];
        const classOperations = []; // Batch all class changes
        
        this.classBindingListeners.forEach(listener => {
            const { id, states: stateKeys, config, element } = listener;
            if (!element || !(element instanceof Element) || !element.isConnected) {
                removeClassBindingIDs.push(id);
                return;
            }
            
            const shouldUpdate = stateKeys.filter(key => changedKeys.includes(key)).length > 0;
            if (!shouldUpdate) {
                return;
            }
            
            Object.entries(config).forEach(([className, classConfig]) => {
                const { states: classStates, checker } = classConfig;
                if (classStates.filter(key => changedKeys.includes(key)).length === 0) {
                    return;
                }
                if (!(element instanceof Element)) {
                    return;
                }
                const shouldAdd = checker();
                classOperations.push({
                    element,
                    action: shouldAdd ? 'add' : 'remove',
                    className
                });
            });
        });
        
        // Apply all class operations in one batch to prevent layout thrashing
        if (classOperations.length > 0) {
            DOMBatcher.write(() => {
                classOperations.forEach(({ element, action, className }) => {
                    element.classList[action](className);
                });
            });
        }
        
        if (removeClassBindingIDs.length > 0) {
            this.classBindingListeners = this.classBindingListeners.filter(listener => !removeClassBindingIDs.includes(listener.id));
        }
    }

    /**
     * Handle state change event from ViewState
     * Batches changes using microtask queue for optimal performance
     * 
     * @param {string} key - State key that changed
     * @param {*} value - New value
     * @param {*} oldValue - Old value
     */
    onStateChange(key, value, oldValue) {
        // Use Set to automatically handle duplicates
        this.controller.changedStateKeys.add(key);

        // Increment queue count (for tracking/statistics if needed)
        this.controller.changeStateQueueCount++;

        // Schedule batch processing using Promise for async execution
        // Promise.resolve().then() runs in microtask queue, faster than setTimeout
        // and works even when tab is hidden (unlike requestAnimationFrame)
        // The _stateChangePending flag ensures only one Promise is scheduled at a time
        // All subsequent changes will be batched into the Set
        if (!this.controller._stateChangePending) {
            this.controller._stateChangePending = true;

            // Use Promise.resolve().then() for microtask queue (fastest, works in background)
            Promise.resolve().then(() => {
                // Clear pending flag before processing
                this.controller._stateChangePending = false;
                this.processStateChanges();
            });
        }
    }

    /**
     * Process batched state changes efficiently
     * Called from microtask queue after batching period
     * @private
     */
    processStateChanges() {
        // Skip if view is destroyed
        if (this.controller.isDestroyed) {
            return;
        }

        // Get all changed keys as array for processing
        const changedKeys = Array.from(this.controller.changedStateKeys);
        // Reset collections
        this.controller.changedStateKeys.clear();
        this.controller.changeStateQueueCount = 0;

        // If no keys changed, skip processing
        if (changedKeys.length === 0) {
            return;
        }

        // Notify all binding listeners
        this.notifyStateChanges(changedKeys);
    }

    /**
     * Destroy binding manager and cleanup all resources
     * Prevents memory leaks by removing all event listeners and clearing references
     * 
     * Call this in view's beforeDestroy lifecycle
     * 
     * @returns {void}
     * 
     * @example
     * // In ViewController destroy method
     * beforeDestroy() {
     *   this._bindingManager.destroy();
     * }
     */
    destroy() {
        // Stop all event listeners
        this.stopBindingEventListener();
        this.stopClassBindingEventListener();
        
        // Clear all arrays and configs
        this.bindingEventListeners = [];
        this.attributeConfigs = [];
        this.attributeListeners = [];
        this.classBindingConfigs = [];
        this.classBindingListeners = [];
        
        // WeakMaps will be garbage collected automatically
        // No need to explicitly clear them
        
        // Reset flags
        this.isBindingEventListenerStarted = false;
        this.isClassBindingReadyToListen = false;
        this.attributeIndex = 0;
        
        // Nullify controller reference to break circular reference
        this.controller = null;
        
        logger.log('[BindingManager] Destroyed successfully');
    }

    get App() {
        return this.controller?.App;
    }

    set App(value) {
        devLog('BindingManager.App is read-only.');
    }
}
