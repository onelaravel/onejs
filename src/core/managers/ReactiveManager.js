/**
 * ReactiveManager - Quản lý các reactive component
 * Xử lý ReactiveComponents và reactive bindings
 * Sử dụng ReactiveComponent thống nhất cho mọi reactive rendering
 */

import { ReactiveComponent } from '../reactive/ReactiveComponent.js';
import { escapeString, hasData, uniqId } from '../../helpers/utils.js';
import logger from '../services/LoggerService.js';

export class ReactiveManager {
    constructor(controller) {
        this.controller = controller;

        // Reactive components (thống nhất output & watch)
        this.reactiveComponents = new Map();
        this.reactiveComponentConfig = [];
        this.reactiveComponentIndex = 0;
        this.reactiveComponentScanIndex = 0;
        this.reactiveComponentIDs = [];
        this.reactiveComponentPrerenderIDs = [];
        this.reactiveComponentRenderIDs = [];

        // Following IDs - theo dõi reactive IDs trong các giai đoạn render
        this.followingIDs = [];
        this.followingRenderIDs = [];
        this.followingPrerenderIDs = [];

        // Hỗ trợ legacy - map tới reactive components
        this.outputComponents = this.reactiveComponents;
        this.outputComponentIDs = this.reactiveComponentIDs;
        this.watchComponents = this.reactiveComponents;
        this.watchComponentIDs = this.reactiveComponentIDs;

        this.parentWatchComponent = null;
    }

    destroy() {
        if (this.reactiveComponents && this.reactiveComponents.size > 0) {
            this.reactiveComponents.forEach(component => component.destroy());
            this.reactiveComponents.clear();
        }
    }

    resetScanIndex() {
        this.reactiveComponentScanIndex = 0;
    }

    clearForRefresh() {
        if (this.reactiveComponents && this.reactiveComponents.size > 0) {
            this.reactiveComponents.forEach(component => {
                component.destroy();
            });
        }
        this.reactiveComponentIDs = [];
        this.reactiveComponentScanIndex = 0;
        
        // Reset các mảng following
        this.followingIDs = [];
        this.followingRenderIDs = [];
        this.followingPrerenderIDs = [];
    }

    renderOutputComponent(stateKeys = [], renderBlock = () => '') {
        if (!Array.isArray(stateKeys) || stateKeys.length === 0) {
            return typeof renderBlock === 'function' ? renderBlock() : '';
        }

        if (typeof renderBlock !== 'function') {
            return '';
        }

        if (this.controller.isVirtualRendering) {
            this.controller.isVirtualRendering = false;
            let result = this.renderOutputComponentScan(stateKeys, renderBlock);
            this.controller.isVirtualRendering = true;
            if (result !== false) {
                return result;
            }
        }

        const rc = new ReactiveComponent({
            stateKeys,
            renderBlock,
            controller: this.controller,
            App: this.controller.App,
            type: 'output',
            escapeHTML: false
        });

        this.reactiveComponentIDs.push(rc.id);
        this.reactiveComponents.set(rc.id, rc);
        return rc.render();
    }

    renderOutputEscapedComponent(stateKeys = [], renderBlock = () => '') {
        if (!Array.isArray(stateKeys) || stateKeys.length === 0) {
            return escapeString(typeof renderBlock === 'function' ? renderBlock() : '');
        }

        if (typeof renderBlock !== 'function') {
            return '';
        }

        if (this.controller.isVirtualRendering) {
            this.controller.isVirtualRendering = false;
            let result = this.renderOutputComponentScan(stateKeys, renderBlock, true);
            this.controller.isVirtualRendering = true;
            if (result !== false) {
                return result;
            }
        }

        const rc = new ReactiveComponent({
            stateKeys,
            renderBlock,
            controller: this.controller,
            App: this.controller.App,
            type: 'output',
            escapeHTML: true
        });

        this.reactiveComponentIDs.push(rc.id);
        this.reactiveComponents.set(rc.id, rc);
        return rc.render();
    }

    renderOutputComponentScan(stateKeys = [], renderBlock = () => '', escapeHTML = false) {
        let reactiveComponentIndex = this.reactiveComponentScanIndex;
        let reactiveComponentConfig = this.reactiveComponentConfig[reactiveComponentIndex];

        if (!reactiveComponentConfig || !reactiveComponentConfig.stateKeys ||
            reactiveComponentConfig.stateKeys.length != stateKeys.length ||
            !reactiveComponentConfig.stateKeys.every(value => stateKeys.includes(value))) {
            return false;
        }

        const { id: renderID } = reactiveComponentConfig;
        const rc = new ReactiveComponent({
            renderID,
            stateKeys,
            renderBlock,
            controller: this.controller,
            App: this.controller.App,
            type: 'output',
            escapeHTML
        });

        this.reactiveComponentIDs.push(rc.id);
        this.reactiveComponents.set(rc.id, rc);
        this.reactiveComponentScanIndex++;
        return rc.render();
    }

    renderWatchComponent(watchID, stateKeys = [], renderBlock = () => '') {
        if (!Array.isArray(stateKeys) || stateKeys.length === 0) {
            return typeof renderBlock === 'function' ? renderBlock() : '';
        }

        if (typeof renderBlock !== 'function') {
            return '';
        }

        if (this.reactiveComponents.has(watchID)) {
            this.reactiveComponents.get(watchID).renderBlock = renderBlock;
            return this.reactiveComponents.get(watchID).render();
        }
        
        const parentWatchComponent = this.parentWatchComponent;
        const originChildrenIDs = this.controller._hierarchyManager.scanChildrenIDs;
        this.controller._hierarchyManager.scanChildrenIDs = [];
        
        const rc = new ReactiveComponent({
            stateKeys,
            renderBlock,
            controller: this.controller,
            App: this.controller.App,
            parentWatchComponent,
            renderID: watchID,
            type: 'watch',
            escapeHTML: false
        });
        
        this.parentWatchComponent = rc;
        
        if (!this.reactiveComponentIDs.includes(rc.id)) {
            this.reactiveComponentIDs.push(rc.id);
        }
        this.reactiveComponents.set(rc.id, rc);
        
        let result = rc.render();
        const newChildrenIDs = this.controller._hierarchyManager.scanChildrenIDs;
        this.controller._hierarchyManager.scanChildrenIDs = originChildrenIDs;
        rc.childrenIDs = newChildrenIDs;
        this.parentWatchComponent = parentWatchComponent;
        
        return result;
    }

    renderBindingAttribute(attrs = {}) {
        if (typeof attrs !== 'object' || attrs === null) {
            return '';
        }

        let bindingID = null;
        const bindingManager = this.controller._bindingManager;

        if (this.controller.isVirtualRendering) {
            const attributeIndex = bindingManager.attributeIndex++;
            const attributeConfig = bindingManager.attributeConfigs[attributeIndex];
            if (!attributeConfig) {
                return '';
            }
            const { id, config } = attributeConfig;
            bindingID = id;
        } else {
            bindingID = uniqId();
        }

        const id = bindingID;
        const stateKeys = [];
        const element = null;
        const newAttrs = {};
        let attrStrValues = '';
        const specialKeys = ['#text', '#html', '#children', '#content'];

        Object.entries(attrs).forEach(([attrKey, attrConfig]) => {
            const { states: attrStateKeys, render } = attrConfig;
            if (!Array.isArray(attrStateKeys) || attrStateKeys.length === 0 || typeof render !== 'function') {
                return;
            }

            attrStateKeys.forEach(stateKey => {
                if (!stateKeys.includes(stateKey)) {
                    stateKeys.push(stateKey);
                }
            });

            newAttrs[attrKey] = { states: attrStateKeys, render };

            if (specialKeys.includes(attrKey)) {
                return;
            }

            try {
                const renderResult = render();
                if (renderResult === null || renderResult === undefined) {
                    return;
                }
                if(['checked', 'selected', 'disabled', 'readonly', 'multiple'].includes(attrKey)) {
                    if (renderResult && !['false', '0', 'undefined'].includes(String(renderResult).toLowerCase())) {
                        attrStrValues += ` ${attrKey}="${attrKey}"`;
                    }
                    return;
                }
                attrStrValues += ` ${attrKey}="${escapeString(renderResult)}"`;
            } catch (err) {
                logger.error(`❌ ReactiveManager.renderBindingAttribute: Error rendering attribute ${attrKey}`, err);
            }
        });

        if (!hasData(newAttrs)) {
            return '';
        }

        bindingManager.attributeListeners.push({ id, stateKeys, attrs: newAttrs, element });
        return ` data-one-attribute-id="${id}"` + attrStrValues;
    }

    renderClassBinding(classes = {}) {
        if (typeof classes !== 'object' || classes === null) {
            return '';
        }

        const id = uniqId();
        const stateKeys = [];
        const element = null;
        const config = {};
        let classStrValues = '';

        classes.forEach((classConfig) => {
            const { type = 'static', value, states: classStateKeys = [], checker } = classConfig;

            if (type === 'static') {
                classStrValues += ` ${value}`;
                return;
            }

            if (!Array.isArray(classStateKeys) || classStateKeys.length === 0 || typeof checker !== 'function') {
                return;
            }

            if (checker()) {
                classStrValues += ` ${value}`;
            }

            classStateKeys.forEach(stateKey => {
                if (!stateKeys.includes(stateKey)) {
                    stateKeys.push(stateKey);
                }
            });

            config[value] = { states: classStateKeys, checker };
        });

        let initialiClass = classStrValues.trim();
        if (initialiClass === '') {
            initialiClass = null;
        }

        this.controller._bindingManager.classBindingConfigs.push({ id, states: stateKeys, config, initialiClass, element });
        return ` data-one-class-id="${id}" class="${classStrValues.trim()}"`;
    }

    onWatchComponentUpdating() {
        this.controller._eventManager.stopEventListener();
        this.controller._bindingManager.stopBindingEventListener();
        setTimeout(() => {
            if (!this.controller.eventListenerStatus) {
                this.controller._eventManager.startEventListener();
            }
            // Khởi động lại binding cho các DOM element mới
            this.controller._bindingManager.startBindingEventListener();
        }, 10);
    }

    onWatchComponentUpdated() {
        if (!this.controller.eventListenerStatus) {
            this.controller._eventManager.startEventListener();
        }
        // Đảm bảo binding listeners được gắn vào các element mới
        this.controller._bindingManager.startBindingEventListener();
    }
}
