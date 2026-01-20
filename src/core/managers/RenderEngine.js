/**
 * RenderEngine - Manages view rendering and scanning
 * Handles render, virtual render, prerender, and DOM scanning
 * 
 * Extracted from ViewController.js to improve maintainability
 * @author GitHub Copilot
 * @date 2025-12-29
 */

import logger from '../services/LoggerService.js';
import OneMarkup from '../OneMarkup.js';
import { ATTR } from '../ViewConfig.js';

export class RenderEngine {
    /**
     * @param {ViewController} controller - Parent controller instance
     */
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Render the view
     * @returns {string|Object} Rendered content
     */
    render() {
        let renderFollowIDStart = this.controller._reactiveManager.followingIDs.length;
        this.controller.commitConstructorData();
        const result = this.controller.config.render.apply(this.controller, []);
        this.controller.renderedContent = result;
        let renderFollowIDEnd = this.controller._reactiveManager.followingIDs.length;
        if (renderFollowIDEnd >= renderFollowIDStart) {
            this.controller._reactiveManager.followingRenderIDs.push(...this.controller._reactiveManager.followingIDs.slice(renderFollowIDStart));
        }

        if (typeof result === 'string' && result.trim() !== '' && this.controller.isHtmlString(result)) {
            this.controller.renderedContent = this.controller.addXRefViewToRootElements(result);
        }
        if (this.controller.isFirstClientRendering) {
            this.controller.isFirstClientRendering = false;
            if (this.controller._templateManager.wrapperConfig.enable) {
                return this.controller.startWrapper(this.controller._templateManager.wrapperConfig.tag, this.controller._templateManager.wrapperConfig.attributes || {}) + this.controller.renderedContent + this.controller.endWrapper(this.controller._templateManager.wrapperConfig.tag);
            }
        }
        return this.controller.renderedContent;
    }

    /**
     * Virtual render the view with data (Scan version)
     * @returns {string|Object} Virtual rendered content
     */
    virtualRender() {
        this.controller.isScanning = true;
        this.controller.isVirtualRendering = true;
        let renderFollowIDStart = this.controller._reactiveManager.followingIDs.length;
        this.controller.commitConstructorData();
        let result = this.controller.config.render.apply(this.controller, []);
        if (typeof result === 'string' && this.controller.isFirstClientRendering && this.controller._templateManager.wrapperConfig) {
            result = this.controller.startWrapper(this.controller._templateManager.wrapperConfig.tag, this.controller._templateManager.wrapperConfig.attributes || {}) + result + this.controller.endWrapper(this.controller._templateManager.wrapperConfig.tag);
        }
        let renderFollowIDEnd = this.controller._reactiveManager.followingIDs.length;
        if (renderFollowIDEnd >= renderFollowIDStart) {
            this.controller._reactiveManager.followingRenderIDs.push(...this.controller._reactiveManager.followingIDs.slice(renderFollowIDStart));
        }
        this.controller.isVirtualRendering = false;
        this.controller.isFirstClientRendering = false;
        return result;
    }

    /**
     * Prerender the view with data
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Prerendered content
     */
    prerender(_data = {}) {
        let renderFollowIDStart = this.controller._reactiveManager.followingIDs.length;
        this.controller.commitConstructorData();
        const result = this.controller.config.prerender.apply(this.controller, []);
        let renderFollowIDEnd = this.controller._reactiveManager.followingIDs.length;
        if (renderFollowIDEnd >= renderFollowIDStart) {
            this.controller._reactiveManager.followingPrerenderIDs.push(...this.controller._reactiveManager.followingIDs.slice(renderFollowIDStart));
        }
        if (typeof result === 'string' && result.trim() !== '' && this.controller.isHtmlString(result)) {
            return this.controller.addXRefViewToRootElements(result);
        }
        return result;
    }

    /**
     * Virtual prerender the view with data (Scan version)
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Virtual prerendered content
     */
    virtualPrerender(_data = {}) {
        this.controller.isScanning = true;
        this.controller.isVirtualRendering = true;
        let renderFollowIDStart = this.controller._reactiveManager.followingIDs.length;
        this.controller.commitConstructorData();
        const result = this.controller.config.prerender.apply(this.controller, []);
        let renderFollowIDEnd = this.controller._reactiveManager.followingIDs.length;
        if (renderFollowIDEnd >= renderFollowIDStart) {
            this.controller._reactiveManager.followingPrerenderIDs.push(...this.controller._reactiveManager.followingIDs.slice(renderFollowIDStart));
        }
        this.controller.isVirtualRendering = false;
        this.controller.isScanning = false;
        return result;
    }

    refresh(variableData = null) {
        /**
         * @type {ViewController}
         */
        const ctrl = this.controller;
        /**
         * @type {ViewManager}
         */
        const manager = ctrl.App.View;
        if (ctrl.hasSuperView) {
            const superView = ctrl.superView;
            superView._lifecycleManager.unmounted();
            ctrl.updateVariableData(variableData);
            try {
                const result = ctrl.render();
                manager.emitChangedSections();
            } catch (error) {
                console.error(error);
            }
            superView._lifecycleManager.mounted();
        }
        else if (ctrl.wrapperConfig.enable) {
            ctrl._lifecycleManager.unmounted();
            ctrl.updateVariableData(variableData);
            try {
                const result = ctrl.render();
                if (ctrl.rootElement) {
                    OneDOM.replaceContent(ctrl.rootElement, result);
                    this.refElements = Array.from(ctrl.rootElement.children);
                }
                else if (ctrl.markup) {
                    ctrl.markup.replaceContent(result);
                    this.refElements = ctrl.markup.nodes;

                }
                else {
                    console.error('No root element or markup found');
                }
            } catch (error) {
                console.error(error);
            }
            ctrl._lifecycleManager.mounted();
        }
        else {
            console.error('No root element or markup found');
        }
    }

    /**
     * Scan view configuration and setup reactive components
     * @param {Object} config - Scan configuration
     */
    scan(config) {
        if (this.controller.isScanned) {
            return;
        }
        this.controller.__scanData = config;
        this.controller.isScanning = true;
        const { viewId, data, attributes = [], events, outputComponents, children, parent } = config;

        if (data && typeof data === 'object') {
            this.controller.updateVariableData(data);
        }

        if (typeof viewId !== 'string' || viewId === '') {
            logger.warn('⚠️ RenderEngine.scan: Invalid viewId', viewId);
            return null;
        }

        // Setup Output Components
        if (outputComponents && outputComponents.length > 0) {
            this._setupOutputComponents(outputComponents, viewId);
        }

        // Setup Attribute Bindings
        if (attributes && attributes.length > 0) {
            this._setupAttributeBindings(attributes);
        }

        // Store Children References
        if (children && children.length > 0) {
            this._storeChildrenReferences(children);
        }

        this.controller.isScanned = true;
    }

    /**
     * Find and store DOM elements for this view
     * @param {string} viewId - View instance ID
     */
    scanDOMElements(viewId) {
        if (this.controller.isMarkupScanned) {
            return;
        }
        this.controller.isMarkupScanned = true;

        if (this.controller.hasSuperView) {
            return;
        }
        const wrpCfg = this.controller._templateManager.wrapperConfig;

        if (wrpCfg.enable) {
            if (wrpCfg.tag) {
                // Custom wrapper tag
                const rootElement = document.querySelector(
                    `${wrpCfg.tag}[data-wrap-view="${this.controller.path}"][${ATTR.KEYS.VIEW_WRAPPER}="${viewId}"]`
                );
                if (rootElement) {
                    this.controller.rootElement = rootElement;
                    const children = Array.from(rootElement.children);
                    this.controller.refElements = children;
                }
            } else {
                // Use OneMarkup to find view boundary
                const markup = OneMarkup.first('view', { name: this.controller.path, id: viewId });
                if (markup) {
                    this.controller.markup = markup;
                    this.controller.refElements = markup.nodes && markup.nodes.length ? markup.nodes.filter(node => node.nodeType === Node.ELEMENT_NODE) : [];
                }
            }
        } else {
            // Standard view wrapper
            const rootElement = document.querySelector(`[data-view-wrapper="${viewId}"]`);
            if (rootElement) {
                this.controller.rootElement = rootElement;
                const children = Array.from(rootElement.children);
                this.controller.refElements = children;
            }
        }

        if (!this.controller.refElements || this.controller.refElements.length === 0) {
            // logger.warn(`⚠️ RenderEngine.scanDOMElements: No elements found for ${this.controller.path} (${viewId})`);
        }
    }

    /**
     * Setup output components for reactive state updates
     * @private
     * @param {Array} outputComponents - Output component configurations
     * @param {string} viewId - View instance ID
     */
    _setupOutputComponents(outputComponents, viewId) {
        outputComponents.forEach(outputComponentConfig => {
            const { id, stateKeys } = outputComponentConfig;
            this.controller._reactiveManager.reactiveComponentConfig.push({
                id,
                stateKeys,
            });
        });
    }

    /**
     * Setup attribute bindings
     * @private
     * @param {Array} attributeBindings - Attribute binding configurations
     */
    _setupAttributeBindings(attributeBindings) {
        attributeBindings.forEach(binding => {
            const { id, config } = binding;
            this.controller._bindingManager.attributeConfigs.push({
                id,
                config,
            });
        });
    }

    /**
     * Store children view references
     * @private
     * @param {Array} children - Children configurations
     */
    _storeChildrenReferences(children) {
        this.controller.__storeChildrenReferences(children);
    }

    get App() {
        return this.controller.App;
    }

    set App(value) {
        devLog('RenderEngine.App is read-only.');
    }
}
