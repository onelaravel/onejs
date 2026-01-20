import OneDOM from '../OneDOM.js';
import DOMBatcher from '../DOMBatcher.js';
import logger from '../services/LoggerService.js';

export default class BindingHelper {

    /**
     * Start Two-Way Binding Listeners
     */
    static startBindingEventListener(controller) {
        const state = controller._internal.binding;
        const selector = `[data-binding][data-view-id="${controller.id}"]`;
        const inputs = document.querySelectorAll(selector);

        if (inputs.length === 0) return;

        inputs.forEach(input => {
            if (!input.isConnected) return;

            // Check WeakMap to see if already attached
            if (state.elementMap.has(input)) return;

            const stateKey = input.getAttribute('data-binding');
            if (!stateKey) return;

            // Sync initial state (State -> Element)
            BindingHelper.syncStateToElement(controller, input, stateKey);

            // Create Handler (Element -> State)
            const handler = (event) => BindingHelper.pushElementToState(controller, input, stateKey);

            const tag = input.tagName.toLowerCase();
            const eventType = tag === 'select' ? 'change' : 'input';

            input.addEventListener(eventType, handler);

            // Store in WeakMap for efficient lookup/garbage collection prevention
            state.elementMap.set(input, { eventType, handler, stateKey });

            // Store in array for manual cleanup in destroy()
            state.listeners.push({ element: input, eventType, handler });
        });

        state.isStarted = true;
    }

    /**
     * Start Class Binding Listeners
     */
    static startClassBindingEventListener(controller) {
        const state = controller._internal.binding;

        if (state.isClassReady || !state.classConfigs || state.classConfigs.length === 0) {
            return;
        }

        const removeClassBindingIDs = [];

        state.classConfigs.forEach(binding => {
            const { id, config, states, initialiClass = '' } = binding;
            // logic to find element...
            const selector = `[data-one-class-id="${id}"]`;
            const element = document.querySelector(selector);

            if (!element) {
                removeClassBindingIDs.push(id);
                return;
            }
            binding.element = element;

            state.classListeners.push({ id, states, config, element, initialiClass });

            // Initial class application
            const classOperations = [];

            // Initial classes
            String(initialiClass).split(' ').forEach(cls => {
                if (cls.trim()) classOperations.push({ element, action: 'add', className: cls });
            });

            // Config classes
            Object.entries(config).forEach(([className, classConfig]) => {
                const { checker } = classConfig;
                if (typeof checker === 'function') {
                    const shouldAdd = checker.call(controller.view); // Bind to view
                    classOperations.push({ element, action: shouldAdd ? 'add' : 'remove', className });
                }
            });

            if (classOperations.length > 0) {
                DOMBatcher.write(() => {
                    classOperations.forEach(({ element, action, className }) => {
                        element.classList[action](className);
                    });
                });
            }
        });

        state.isClassReady = true;
    }

    /**
     * Push Element value to State (Input -> State)
     */
    static pushElementToState(controller, element, stateKey) {
        const state = controller._internal.binding;

        // Get or Create flags from WeakMap
        let flags = state.elementFlags.get(element);
        if (!flags) {
            flags = { pushing: false, syncing: false };
            state.elementFlags.set(element, flags);
        }

        if (flags.syncing || flags.pushing) return;
        flags.pushing = true;

        try {
            const value = OneDOM.getInputValue(element);
            // Update state on controller
            controller.states.__.updateStateAddressKey(stateKey, value);
        } catch (e) {
            logger.error(`Error pushing element state ${stateKey}`, e);
        } finally {
            // Clear flag asynchronously
            Promise.resolve().then(() => {
                const currentFlags = state.elementFlags.get(element);
                if (currentFlags) currentFlags.pushing = false;
            });
        }
    }

    /**
     * Sync State value to Element (State -> Element)
     */
    static syncStateToElement(controller, element, stateKey) {
        const state = controller._internal.binding;

        let flags = state.elementFlags.get(element);
        if (!flags) {
            flags = { pushing: false, syncing: false };
            state.elementFlags.set(element, flags);
        }

        if (flags.pushing || flags.syncing) return;

        const stateValue = controller.states.__.getStateByAddressKey(stateKey);
        const currentValue = OneDOM.getInputValue(element);

        if (currentValue == stateValue) return; // Loose equality check

        flags.syncing = true;
        try {
            OneDOM.setInputValue(element, stateValue);
        } finally {
            flags.syncing = false;
        }
    }

    /**
     * Notify state changes to all bindings
     * @param {Object} controller 
     * @param {Array} changedKeys 
     */
    static notifyStateChanges(controller, changedKeys) {
        if (!controller.isReadyToStateChangeListen) return;

        // Handle explicit subscribeStates method on controller if exists
        // ... (legacy logic support if needed) ...

        const state = controller._internal.binding;

        // 1. Notify Input Bindings
        if (state.listeners.length > 0) {
            state.listeners.forEach(({ element, stateKey }) => {
                // Check if stateKey or its parent is in changedKeys
                // Simplification: exact match or simple includes
                // In real impl, need robust key matching (e.g. 'user.name' matches 'user')
                const rootKey = stateKey.split('.')[0];
                if (changedKeys.includes(rootKey) || changedKeys.includes(stateKey)) {
                    BindingHelper.syncStateToElement(controller, element, stateKey);
                }
            });
        }

        // 2. Notify Class Bindings
        if (state.isClassReady && state.classListeners.length > 0) {
            const classOperations = [];
            state.classListeners.forEach(listener => {
                const { states, config, element } = listener;
                if (!element.isConnected) return;

                const shouldUpdate = states.some(key => changedKeys.includes(key));
                if (!shouldUpdate) return;

                Object.entries(config).forEach(([className, classConfig]) => {
                    const { states: classStates, checker } = classConfig;
                    if (classStates.some(k => changedKeys.includes(k))) {
                        const shouldAdd = checker.call(controller.view);
                        classOperations.push({ element, action: shouldAdd ? 'add' : 'remove', className });
                    }
                });
            });

            if (classOperations.length > 0) {
                DOMBatcher.write(() => {
                    classOperations.forEach(({ element, action, className }) => {
                        element.classList[action](className);
                    });
                });
            }
        }

        // 3. Notify Attribute Bindings (omitted for brevity, similar logic)
        // ...
    }

    /**
     * Destroy binding state
     */
    static destroy(controller) {
        const state = controller._internal.binding;

        // Remove listeners
        state.listeners.forEach(({ element, eventType, handler }) => {
            try {
                if (element.isConnected) element.removeEventListener(eventType, handler);
            } catch (e) { }
        });

        state.listeners = [];
        state.classListeners = [];
        state.attrListeners = [];
        state.isStarted = false;
        state.isClassReady = false;

        // WeakMaps (elementFlags, elementMap) will be GC'd automatically when controller._internal dies
    }
}
