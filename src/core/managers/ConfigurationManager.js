/**
 * ConfigurationManager - Manages view configuration, data, and property definitions
 * 
 * Responsibilities:
 * - Process defined properties and methods from config
 * - Commit constructor data
 * - Update view data and variables
 * - Handle userDefined properties
 * 
 * Extracted from ViewController.js (Phase 9) to reduce complexity
 * @author GitHub Copilot
 * @date 2025-12-29
 */

import { __defineProps, __defineMethods, hasData } from '../../helpers/utils.js';
import { FORBIDDEN_KEYS } from '../ViewConfig.js';

export class ConfigurationManager {
    /**
     * @param {ViewController} controller - Parent controller instance
     */
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Process defined properties and methods from config
     * Extracts properties and methods from config.__props__ and userDefined
     * Binds methods to controller context
     * 
     * @param {Object} config - View configuration
     */
    processDefinedProperties(config) {
        let definedProps = {};
        let definedMethods = {};

        // Process config.__props__
        if (config.__props__ && config.__props__.length > 0) {
            config.__props__.forEach(prop => {
                if (typeof config[prop] === 'function') {
                    definedMethods[prop] = config[prop].bind(this.controller);
                }
                else if (typeof config[prop] !== 'undefined') {
                    definedProps[prop] = config[prop];
                }
            });
        }

        // Define properties and methods on controller
        __defineProps(this.controller, definedProps, {
            writable: true,
            configurable: true,
            enumerable: true,
        });

        __defineMethods(this.controller, definedMethods);
    }

    /**
     * Commit constructor data to view
     * Updates variable data and calls commitConstructorData callback
     */
    commitConstructorData() {
        if (this.controller.isCommitedConstructorData) {
            return;
        }

        if (hasData(this.controller.data) && typeof this.controller.config.updateVariableData === 'function') {
            this.controller.config.updateVariableData.apply(this.controller, [
                { ...this.controller.App.View.data, ...this.controller.data }
            ]);
            this.controller.isCommitedConstructorData = true;
        }

        if (typeof this.controller.config.commitConstructorData === 'function') {
            this.controller.config.commitConstructorData.apply(this.controller, []);
        }
    }

    /**
     * Update view data
     * Merges new data into existing data
     * 
     * @param {Object} __data - New data to merge
     * @returns {ViewController} Controller instance for chaining
     */
    updateData(__data = {}) {
        this.controller.data = { ...this.controller.data, ...__data };
        return this.controller;
    }

    /**
     * Update variable data via config callback
     * 
     * @param {Object} data - Variable data to update
     * @returns {ViewController} Controller instance for chaining
     */
    updateVariableData(data = {}) {
        if (typeof this.controller.config.updateVariableData === 'function') {
            this.controller.config.updateVariableData.call(this.controller, data);
            this.controller.isCommitedConstructorData = true;
        }
        return this.controller;
    }

    /**
     * Update single variable item via config callback
     * 
     * @param {string} key - Variable key
     * @param {*} value - Variable value
     * @returns {ViewController} Controller instance for chaining
     */
    updateVariableItem(key, value) {
        if (typeof this.controller.config.updateVariableItemData === 'function') {
            this.controller.config.updateVariableItemData.call(this.controller, key, value);
        }
        return this.controller;
    }

    /**
     * Set scope for the view
     * 
     * @param {Object} scope - Scope object containing name, id, index, etc.
     */
    setScope(scope) {
        this.controller.__scope = scope;
    }

    get App() {
        return this.controller.App;
    }

    set App(value) {
        devLog('ConfigurationManager.App is read-only.');
    }
}
