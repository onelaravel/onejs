import EventDelegator from '../EventDelegator.js';
import logger from '../services/LoggerService.js';
import { devLog } from '../../helpers/devWarnings.js';

export default class EventHelper {

    /**
     * Start event listeners using delegation
     * @param {Object} controller - The ViewController instance
     */
    static startEventListener(controller) {
        if (controller.eventListenerStatus) {
            return;
        }

        const state = controller._internal.events;
        const needDeleted = [];
        let attachedCount = 0;

        if (!controller.events) {
            return;
        }

        Object.entries(controller.events).forEach(([eventType, eventMap]) => {
            Object.entries(eventMap).forEach(([eventID, handlers]) => {
                const selector = `[data-${eventType}-id="${eventID}"]`;
                const delegateKey = `${eventType}:${eventID}:${controller.id}`;

                // Parse Handlers
                const parsedHandlers = EventHelper.parseEventHandlerFunctions(controller, handlers);

                if (parsedHandlers.length > 0) {
                    // Cleanup old if exists
                    if (state.unsubscribers.has(delegateKey)) {
                        state.unsubscribers.get(delegateKey)();
                    }

                    // Attach via Delegator
                    const unsubscribe = EventDelegator.on(eventType, selector, (event) => {
                        // Iterate through handlers
                        parsedHandlers.forEach(({ handler, params, preventDefault, stopPropagation }) => {
                            if (preventDefault) event.preventDefault();
                            if (stopPropagation) event.stopPropagation();

                            try {
                                // Add delegateTarget to event for handler access
                                if (!event.delegateTarget) {
                                    Object.defineProperty(event, 'delegateTarget', {
                                        value: event.target.closest(selector) || event.target,
                                        writable: false,
                                        enumerable: true,
                                        configurable: true
                                    });
                                }

                                handler.apply(controller.view, [event, ...params]);
                            } catch (error) {
                                logger.error(`Error executing event handler for ${selector} in ${controller.path}:`, error);
                            }
                        });
                    }, { root: document }); // Use document as root for now, could be app container

                    state.unsubscribers.set(delegateKey, unsubscribe);
                    attachedCount++;
                } else {
                    needDeleted.push({ eventType, eventID });
                }
            });
        });

        // Cleanup orphaned events logic (optional, based on original EventManager)
        if (needDeleted.length > 0) {
            needDeleted.forEach(({ eventType, eventID }) => {
                delete controller.events[eventType][eventID];
            });
        }

        controller.eventListenerStatus = true;

        if (attachedCount > 0) {
            devLog(`[EventHelper] Attached ${attachedCount} delegated listeners for ${controller.path}`);
        }
    }

    /**
     * Stop all listeners
     * @param {Object} controller - The ViewController instance
     */
    static stopEventListener(controller) {
        if (!controller.eventListenerStatus) {
            return;
        }

        const state = controller._internal.events;

        // Clear delegated listeners
        state.unsubscribers.forEach(unsubscribe => unsubscribe());
        state.unsubscribers.clear();

        // Clear legacy listeners if any (from old ViewControllers)
        if (controller.eventListeners && controller.eventListeners.length > 0) {
            controller.eventListeners.forEach(({ element, eventType, handler }) => {
                try {
                    element.removeEventListener(eventType, handler);
                } catch (e) { /* ignore */ }
            });
            controller.eventListeners = [];
        }

        controller.eventListenerStatus = false;
        devLog(`[EventHelper] Stopped listeners for ${controller.path}`);
    }

    /**
     * Parse array of handler definitions
     * @param {Object} controller 
     * @param {Array} handlers 
     * @returns {Array} Parsed handlers
     */
    static parseEventHandlerFunctions(controller, handlers) {
        if (!handlers || !Array.isArray(handlers)) return [];

        return handlers.map(handlerDef => {
            return EventHelper.parseHandlerFunction(controller, handlerDef);
        }).filter(h => h !== null);
    }

    /**
     * Parse single handler definition
     * @param {Object} controller 
     * @param {Object} handlerDef 
     * @returns {Object|null}
     */
    static parseHandlerFunction(controller, handlerDef) {
        if (!handlerDef || typeof handlerDef !== 'object') return null;

        const { method, params, preventDefault, stopPropagation } = handlerDef;
        let handlerFunc = null;

        // 1. Check in View Methods
        if (typeof controller.view[method] === 'function') {
            handlerFunc = controller.view[method];
        }
        // 2. Check in Controller Properties
        else if (typeof controller[method] === 'function') {
            handlerFunc = controller[method];
        }
        // 3. Check globally (window)
        else if (typeof window[method] === 'function') {
            handlerFunc = window[method];
        }

        if (!handlerFunc) {
            logger.warn(`Event handler method '${method}' not found in view ${controller.path}`);
            return null;
        }

        // Resolve params
        const resolvedParams = Array.isArray(params) ? params.map(p => {
            // Basic param resolution (strings, numbers, booleans)
            // Complex resolution (like referencing other state) can be added here
            return p;
        }) : [];

        return {
            handler: handlerFunc,
            params: resolvedParams,
            preventDefault: !!preventDefault,
            stopPropagation: !!stopPropagation
        };
    }
}
