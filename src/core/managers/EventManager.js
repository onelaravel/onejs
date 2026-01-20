/**
 * EventManager - Quản lý tất cả chức năng liên quan đến events cho ViewController
 * 
 * Trách nhiệm:
 * - Khởi động/dừng event listeners
 * - Parse event handlers và parameters
 * - Dọn dẹp orphaned event data
 * - Phân giải event handler (view methods, controller methods, window functions, etc.)
 * 
 * Sử dụng EventDelegator để tối ưu hiệu suất:
 * - Giảm số lượng listeners từ O(n) xuống O(1) mỗi event type
 * - Tự động hỗ trợ dynamic content
 * - Giảm memory footprint
 * 
 * Extracted from ViewController.js to improve separation of concerns
 * @module core/managers/EventManager
 * @author OneLaravel Team
 * @since 2025-12-29
 * @updated 2025-01-06 - Integrated EventDelegator
 */

import logger from '../services/LoggerService.js';
import EventDelegator from '../EventDelegator.js';

export class EventManager {
    constructor(controller) {
        this.controller = controller;
        this.view = controller.view;
        this.path = controller.path;
        this.id = controller.id;
        
        /**
         * Track delegated event unsubscribers
         * @type {Map<string, Function>}
         */
        this.delegatedUnsubscribers = new Map();
    }

    updateController(newController) {
        this.controller = newController;
        this.view = newController.view;
        this.path = newController.path;
        this.id = newController.id;
    }

    /**
     * Khởi động event listeners cho tất cả registered events
     * Sử dụng event delegation thay vì attach listener riêng cho từng element
     * 
     * Cải tiến hiệu suất:
     * - Trước: O(n) listeners (mỗi element một listener)
     * - Sau: O(1) listeners (một listener cho mỗi event type)
     * - Tự động hỗ trợ dynamic content (ReactiveComponent updates)
     * - Giảm memory usage đáng kể
     */
    startEventListener() {
        const needDeleted = [];
        
        Object.entries(this.controller.events).forEach(([eventType, eventMap]) => {
            Object.entries(eventMap).forEach(([eventID, handlers]) => {
                const selector = `[data-${eventType}-id="${eventID}"]`;
                const elements = document.querySelectorAll(selector);
                const parsedHandlers = this.parseEventHandlerFunctions(handlers);
                
                if (parsedHandlers.length !== 0 && elements.length > 0) {
                    // Tạo unique key cho delegated handler
                    const delegateKey = `${eventType}:${eventID}:${this.id}`;
                    
                    // Unsubscribe nếu đã tồn tại (prevent duplicates)
                    if (this.delegatedUnsubscribers.has(delegateKey)) {
                        this.delegatedUnsubscribers.get(delegateKey)();
                    }
                    
                    // Sử dụng EventDelegator để attach delegated listener
                    const unsubscribe = EventDelegator.on(eventType, selector, (event) => {
                        let returnValue = null;
                        for (let i = 0; i < parsedHandlers.length; i++) {
                            const handlerFn = parsedHandlers[i];
                            try {
                                returnValue = handlerFn(event);
                            } catch (error) {
                                console.error('[EventManager] Handler execution error:', error, {
                                    eventType,
                                    selector,
                                    handlerIndex: i,
                                    event: event.type
                                });
                                throw error; // Re-throw để EventDelegator catch
                            }
                            if (returnValue === false || event.defaultPrevented) {
                                event.preventDefault();
                                event.stopPropagation();
                                break;
                            }
                        }
                        if (returnValue === false || returnValue === true) {
                            return returnValue;
                        }
                    });
                    
                    // Lưu unsubscriber để cleanup sau này
                    this.delegatedUnsubscribers.set(delegateKey, unsubscribe);
                } else {
                    needDeleted.push({ eventType, eventID });
                }
            });
        });
        needDeleted.forEach(({ eventType, eventID }) => {
            delete this.controller.events[eventType][eventID];
            // If no more event handlers for this eventType, remove the entire eventType
            if (Object.keys(this.controller.events[eventType]).length === 0) {
                delete this.controller.events[eventType];
            }
        });
        this.controller.eventListenerStatus = true;
    }

    /**
     * Dừng tất cả event listeners
     * Gỡ bỏ tất cả delegated event listeners và clear tracking structures
     * 
     * Với event delegation:
     * - Không cần loop qua từng element
     * - Chỉ cần unsubscribe delegated handlers
     * - Nhanh hơn và đơn giản hơn
     */
    stopEventListener() {
        // Unsubscribe tất cả delegated handlers
        this.delegatedUnsubscribers.forEach(unsubscribe => {
            unsubscribe();
        });
        this.delegatedUnsubscribers.clear();
        
        // Keep backward compatibility: clean up old individual listeners (nếu có)
        if (this.controller.eventListeners && this.controller.eventListeners.length > 0) {
            this.controller.eventListeners.forEach(({ element, eventType, handler }) => {
                element.removeEventListener(eventType, handler);
            });
            this.controller.eventListeners = [];
        }
        
        this.controller.eventListenerStatus = false;
    }

    /**
     * Clear all event data when elements are not found
     * This helps prevent memory leaks from orphaned event handlers
     */
    clearOrphanedEventData() {
        const needDeleted = [];
        Object.entries(this.controller.events).forEach(([eventType, eventMap]) => {
            Object.entries(eventMap).forEach(([eventID, handlers]) => {
                const selector = `[data-${eventType}-id="${eventID}"]`;
                const elements = document.querySelectorAll(selector);
                if (elements.length === 0) {
                    needDeleted.push({ eventType, eventID });
                }
            });
        });

        needDeleted.forEach(({ eventType, eventID }) => {
            delete this.controller.events[eventType][eventID];
            // If no more event handlers for this eventType, remove the entire eventType
            if (Object.keys(this.controller.events[eventType]).length === 0) {
                delete this.controller.events[eventType];
            }
        });

        if (needDeleted.length > 0) {
            logger.log(`🗑️ ViewEngine.clearOrphanedEventData: Cleaned up ${needDeleted.length} orphaned event handlers`);
        }
    }

    /**
     * Parse event handler functions from handler objects
     * @param {Array} handlers - Array of handler objects or functions
     * @returns {Array} Array of parsed handler functions
     */
    parseEventHandlerFunctions(handlers) {
        let parsedHandlers = [];
        handlers.forEach(handlerObj => {
            const handlerName = typeof handlerObj == "function" ? handlerObj : handlerObj.handler;
            const params = typeof handlerObj == "function" ? [] : handlerObj.params || [];
            const func = this.parseHandlerFunction(handlerName);
            const fn = (event) => func(...this.parseEventHandlerParams(event, params));
            parsedHandlers.push(fn);
        });
        return parsedHandlers;
    }

    /**
     * Parse handler function
     * @param {string|Function} funcName - Function name or function
     * @returns {Function} Parsed function bound to correct context
     */
    parseHandlerFunction(funcName) {
        if (!(typeof funcName === 'string' || typeof funcName === 'function')) {
            return null;
        }
        
        // Handle function directly passed
        if (typeof funcName === 'function') {
            // Always bind to view to maintain context
            return funcName.bind(this.view);
        }
        
        // Handle function name as string - check in order: view, controller, setters, data, window
        
        // Check in view
        if (typeof this.view[funcName] === 'function') {
            return this.view[funcName].bind(this.view);
        }
        
        // Check in controller
        if (typeof this.controller[funcName] === 'function') {
            return this.controller[funcName].bind(this.controller);
        }
        
        // Check in states setters
        if (typeof this.controller.states.__.setters[funcName] === 'function') {
            return this.controller.states.__.setters[funcName].bind(this.view);
        }
        
        // Check in data
        if (typeof this.controller.data[funcName] === 'function') {
            return this.controller.data[funcName].bind(this.controller.data);
        }
        
        // Check in window (global functions)
        if (window && typeof window[funcName] === 'function') {
            return window[funcName].bind(window);
        }
        
        // Function not found
        return (event) => logger.warn(`⚠️ Event handler ${funcName} is not defined`, event);
    }

    /**
     * Parse event handler parameters
     * @param {Event} event - DOM event object
     * @param {Array} params - Array of parameter definitions
     * @returns {Array} Parsed parameters
     */
    parseEventHandlerParams(event, params = []) {
        return params.map(param => {
            if (param === '@EVENT') {
                return event;
            }
            else if (typeof param === 'object' && param !== null) {
                if (typeof param.handler === 'string' && (Array.isArray(param.params) || (typeof param.params == 'object' && param.params !== null && param.params.constructor === Array))) {
                    const func = this.parseHandlerFunction(param.handler);
                    return func(...this.parseEventHandlerParams(event, param.params));
                }
                return this.parseEventHandlerObject(event, param);
            }
            else if (Array.isArray(param) || (typeof param === 'object' && param !== null && param.constructor === Array)) {
                return this.parseEventHandlerParams(event, param);
            }
            else if (typeof param === 'function') {
                // Bind function to view context before calling
                const boundFunc = param.bind(this.view);
                return boundFunc(event);
            }
            return param;
        });
    }

    /**
     * Parse event handler object parameters
     * @param {Event} event - DOM event object
     * @param {Object} object - Object with parameter definitions
     * @returns {Object} Parsed object with evaluated parameters
     */
    parseEventHandlerObject(event, object = {}) {
        let parsedObject = {};
        Object.entries(object).forEach(([key, value]) => {
            if (value === '@EVENT') {
                parsedObject[key] = event;
            }
            else if (typeof value === 'object' && value !== null) {
                if (typeof value.handler === 'string' && (Array.isArray(value.params) || (typeof value.params == 'object' && value.params !== null && value.params.constructor === Array))) {
                    const func = this.parseHandlerFunction(value.handler);
                    parsedObject[key] = func(...this.parseEventHandlerParams(event, value.params));
                }
                else {
                    parsedObject[key] = this.parseEventHandlerObject(event, value);
                }
            }
            else if (Array.isArray(value) || (typeof value === 'object' && value !== null && value.constructor === Array)) {
                parsedObject[key] = this.parseEventHandlerParams(event, value);
            }
            else if (typeof value === 'function') {
                parsedObject[key] = value(event);
            }
            else {
                parsedObject[key] = value;
            }
        });
        return parsedObject;
    }

    get App() {
        return this.controller.App;
    }

    set App(value) {
        devLog('EventManager.App is read-only.');
    }
}
