/**
 * EventDelegator
 * 
 * Tối ưu hóa event handling bằng cách delegate events lên root element
 * thay vì attach listener riêng cho từng element.
 * 
 * Lợi ích hiệu suất:
 * - Giảm số lượng event listeners từ O(n) xuống O(1) 
 * - Tự động hỗ trợ dynamic content (không cần re-attach)
 * - Giảm memory footprint
 * - Cải thiện performance khi có nhiều elements
 * 
 * Cách hoạt động:
 * - Một listener duy nhất trên root element (document hoặc container)
 * - Sử dụng event bubbling để bắt events từ children
 * - Match target element với selector để gọi đúng handler
 * 
 * @class EventDelegator
 * @version 1.0.0
 * @since 2025-01-06
 */
class EventDelegator {
    constructor() {
        /**
         * Map lưu delegated handlers theo event type
         * @type {Map<string, Map<string, Array<{selector: string, handler: Function, options: Object}>>>}
         */
        this.delegatedHandlers = new Map();

        /**
         * Map lưu root listeners đã attach
         * @type {Map<HTMLElement, Map<string, Function>>}
         */
        this.rootListeners = new Map();

        /**
         * Root element mặc định cho delegation
         * @type {HTMLElement}
         */
        this.defaultRoot = document;

        /**
         * Cache selector matches để improve performance
         * @type {WeakMap<HTMLElement, Map<string, boolean>>}
         */
        this.matchCache = new WeakMap();
    }

    /**
     * Đăng ký delegated event handler
     * 
     * @param {string} eventType - Loại event (click, input, etc.)
     * @param {string} selector - CSS selector để match elements
     * @param {Function} handler - Handler function
     * @param {Object} options - Tùy chọn
     * @param {HTMLElement} options.root - Root element để attach listener (default: document)
     * @param {boolean} options.capture - Sử dụng capture phase
     * @param {boolean} options.once - Chỉ chạy một lần
     * @returns {Function} Unsubscribe function
     * 
     * @example
     * const unsubscribe = EventDelegator.on('click', '.btn-submit', (e) => {
     *     console.log('Button clicked:', e.target);
     * });
     */
    on(eventType, selector, handler, options = {}) {
        const root = options.root || this.defaultRoot;
        const capture = options.capture || false;

        // Tạo structure nếu chưa tồn tại
        if (!this.delegatedHandlers.has(eventType)) {
            this.delegatedHandlers.set(eventType, new Map());
        }

        const eventMap = this.delegatedHandlers.get(eventType);
        const rootKey = this._getRootKey(root);

        if (!eventMap.has(rootKey)) {
            eventMap.set(rootKey, []);
        }

        const handlers = eventMap.get(rootKey);

        // Wrap handler nếu có option once
        const wrappedHandler = options.once
            ? (...args) => {
                handler(...args);
                this.off(eventType, selector, wrappedHandler, { root });
            }
            : handler;

        // Lưu handler info
        const handlerInfo = { selector, handler: wrappedHandler, options };
        handlers.push(handlerInfo);

        // Attach root listener nếu chưa có
        this._ensureRootListener(root, eventType, capture);

        // Return unsubscribe function
        return () => this.off(eventType, selector, wrappedHandler, { root });
    }

    /**
     * Gỡ bỏ delegated event handler
     * 
     * @param {string} eventType - Loại event
     * @param {string} selector - CSS selector
     * @param {Function} handler - Handler function (optional, nếu không có sẽ xóa tất cả)
     * @param {Object} options - Tùy chọn
     * @param {HTMLElement} options.root - Root element
     */
    off(eventType, selector, handler = null, options = {}) {
        const root = options.root || this.defaultRoot;
        const eventMap = this.delegatedHandlers.get(eventType);

        if (!eventMap) return;

        const rootKey = this._getRootKey(root);
        const handlers = eventMap.get(rootKey);

        if (!handlers) return;

        // Lọc handlers
        const filtered = handlers.filter(info => {
            if (info.selector !== selector) return true;
            if (handler && info.handler !== handler) return true;
            return false;
        });

        eventMap.set(rootKey, filtered);

        // Nếu không còn handlers cho root này, remove root listener
        if (filtered.length === 0) {
            this._removeRootListener(root, eventType);
            eventMap.delete(rootKey);
        }

        // Nếu không còn roots cho event type này, xóa event type
        if (eventMap.size === 0) {
            this.delegatedHandlers.delete(eventType);
        }
    }

    /**
     * Xóa tất cả delegated handlers cho một root
     * 
     * @param {HTMLElement} root - Root element
     */
    clearRoot(root = this.defaultRoot) {
        const rootKey = this._getRootKey(root);

        this.delegatedHandlers.forEach((eventMap, eventType) => {
            if (eventMap.has(rootKey)) {
                this._removeRootListener(root, eventType);
                eventMap.delete(rootKey);
            }

            if (eventMap.size === 0) {
                this.delegatedHandlers.delete(eventType);
            }
        });

        this.rootListeners.delete(root);
    }

    /**
     * Xóa tất cả delegated handlers
     */
    clearAll() {
        this.rootListeners.forEach((listenerMap, root) => {
            listenerMap.forEach((listener, eventType) => {
                root.removeEventListener(eventType, listener, true);
                root.removeEventListener(eventType, listener, false);
            });
        });

        this.delegatedHandlers.clear();
        this.rootListeners.clear();
        this.matchCache = new WeakMap();
    }

    /**
     * Kiểm tra element có match selector không (với cache)
     * 
     * @param {HTMLElement} element - Element cần kiểm tra
     * @param {string} selector - CSS selector
     * @returns {boolean}
     * @private
     */
    _matchesSelector(element, selector) {
        if (!element || !element.matches) return false;

        // Check cache
        let cache = this.matchCache.get(element);
        if (!cache) {
            cache = new Map();
            this.matchCache.set(element, cache);
        }

        if (cache.has(selector)) {
            return cache.get(selector);
        }

        // Compute and cache
        const matches = element.matches(selector);
        cache.set(selector, matches);

        return matches;
    }

    /**
     * Tìm matching element trong event path
     * 
     * @param {Event} event - DOM event
     * @param {string} selector - CSS selector
     * @param {HTMLElement} root - Root element
     * @returns {HTMLElement|null}
     * @private
     */
    _findMatchingElement(event, selector, root) {
        let element = event.target;

        // Traverse lên parent tree cho đến root
        while (element && element !== root) {
            if (this._matchesSelector(element, selector)) {
                return element;
            }
            element = element.parentElement;
        }

        // Check root itself
        if (element === root && this._matchesSelector(element, selector)) {
            return element;
        }

        return null;
    }

    /**
     * Tạo root listener cho event type
     * 
     * @param {HTMLElement} root - Root element
     * @param {string} eventType - Event type
     * @param {boolean} capture - Use capture phase
     * @private
     */
    _ensureRootListener(root, eventType, capture = false) {
        // Check đã có listener chưa
        let listenerMap = this.rootListeners.get(root);
        if (!listenerMap) {
            listenerMap = new Map();
            this.rootListeners.set(root, listenerMap);
        }

        const listenerKey = `${eventType}:${capture}`;
        if (listenerMap.has(listenerKey)) {
            return; // Đã có listener
        }

        // Tạo delegating listener
        const listener = (event) => {
            const eventMap = this.delegatedHandlers.get(eventType);
            if (!eventMap) return;

            const rootKey = this._getRootKey(root);
            const handlers = eventMap.get(rootKey);
            if (!handlers || handlers.length === 0) return;

            // 1. Collect all matches
            const matchedHandlers = [];
            for (const handlerInfo of handlers) {
                const matchedElement = this._findMatchingElement(event, handlerInfo.selector, root);
                if (matchedElement) {
                    matchedHandlers.push({
                        ...handlerInfo,
                        element: matchedElement
                    });
                }
            }

            // 2. Sort by depth (deepest first = child before parent)
            matchedHandlers.sort((a, b) => {
                if (a.element === b.element) return 0;
                // If a contains b, a is parent/ancestor of b. We want b (child) first.
                return a.element.contains(b.element) ? 1 : -1;
            });

            // 3. Shim stopPropagation to track status
            let isPropagationStopped = false;
            const originalStopPropagation = event.stopPropagation;
            event.stopPropagation = function () {
                isPropagationStopped = true;
                if (originalStopPropagation) {
                    originalStopPropagation.apply(this, arguments);
                }
            };

            // 4. Execute handlers
            for (const { selector, handler, options, element } of matchedHandlers) {
                if (isPropagationStopped) break;

                // Add delegateTarget property to original event
                // KHÔNG tạo Object.create(event) vì sẽ mất native Event methods
                Object.defineProperty(event, 'delegateTarget', {
                    value: element,
                    writable: false,
                    enumerable: true,
                    configurable: true
                });

                try {
                    // Gọi handler với event gốc, KHÔNG thay đổi context
                    // Handler giữ nguyên context của nó (controller/view)
                    const result = handler(event);

                    // Xử lý return value
                    if (result === false) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                } catch (error) {
                    console.error('[EventDelegator] Handler error:', error, {
                        eventType,
                        selector,
                        element
                    });
                } finally {
                    // Cleanup delegateTarget property
                    delete event.delegateTarget;
                }
            }
        };

        // Attach listener
        root.addEventListener(eventType, listener, capture);
        listenerMap.set(listenerKey, listener);
    }

    /**
     * Gỡ bỏ root listener
     * 
     * @param {HTMLElement} root - Root element
     * @param {string} eventType - Event type
     * @private
     */
    _removeRootListener(root, eventType) {
        const listenerMap = this.rootListeners.get(root);
        if (!listenerMap) return;

        // Remove both capture and non-capture listeners
        ['true', 'false'].forEach(captureStr => {
            const capture = captureStr === 'true';
            const listenerKey = `${eventType}:${capture}`;
            const listener = listenerMap.get(listenerKey);

            if (listener) {
                root.removeEventListener(eventType, listener, capture);
                listenerMap.delete(listenerKey);
            }
        });

        // Nếu không còn listeners, xóa map
        if (listenerMap.size === 0) {
            this.rootListeners.delete(root);
        }
    }

    /**
     * Tạo unique key cho root element
     * 
     * @param {HTMLElement} root - Root element
     * @returns {string}
     * @private
     */
    _getRootKey(root) {
        if (root === document) return 'document';
        if (root === window) return 'window';
        if (root.id) return `#${root.id}`;

        // Fallback: use WeakMap hoặc generate unique ID
        if (!root._delegatorKey) {
            root._delegatorKey = `root_${Math.random().toString(36).substr(2, 9)}`;
        }
        return root._delegatorKey;
    }

    /**
     * Lấy thống kê về delegated handlers
     * Hữu ích cho debugging và monitoring
     * 
     * @returns {Object}
     */
    getStats() {
        const stats = {
            eventTypes: this.delegatedHandlers.size,
            roots: this.rootListeners.size,
            totalHandlers: 0,
            byEventType: {}
        };

        this.delegatedHandlers.forEach((eventMap, eventType) => {
            let count = 0;
            eventMap.forEach(handlers => {
                count += handlers.length;
            });
            stats.totalHandlers += count;
            stats.byEventType[eventType] = count;
        });

        return stats;
    }
}

// Export singleton instance
const delegator = new EventDelegator();
export default delegator;
