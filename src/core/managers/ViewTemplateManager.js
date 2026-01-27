/**
 * ViewTemplateManager - Manages view templates, wrappers, blocks, and sections
 */

import OneMarkup, { OneMarkupModel } from '../OneMarkup.js';
import { ATTR } from '../ViewConfig.js';

export class ViewTemplateManager {
    constructor(controller) {
        this.controller = controller;
        
        // Wrapper configuration
        this.wrapTag = null;
        this.wrapperConfig = { 
            enable: false, 
            tag: null, 
            subscribe: true, 
            attributes: {} 
        };
        
        // Section management
        this.sections = {};
        this.cachedSections = {};
        this.renderedSections = {};
        this.renderedHtml = '';

        this.blockNameList = [];
        this.hasSections = false;
        this.hasBlocks = false;
        
        // Child view configuration
        this.childrenConfig = [];
        this.childrenIndex = 0;
        this.refreshChildrenIndex = 0;
        

        /**
         * @type {Map<string, OneMarkupModel>}
         */
        this.blocks = new Map();

        this.isCached = false;

    }
    
    initializeWrapperConfig(config) {
        this.wrapperConfig = { 
            ...this.wrapperConfig, 
            ...(typeof config === 'object' ? config : {}) 
        };
    }
    
    resetChildrenIndex() {
        this.childrenIndex = 0;
    }
    
    wrapperAttribute() {
        return ` ${ATTR.KEYS.VIEW_WRAPPER}="${this.controller.id}"`;
    }
    
    startWrapper(tag = null, attributes = {}) {
        this.wrapTag = null;
        
        if (typeof tag === 'string') {
            this.wrapTag = tag;
        } else if (typeof tag === 'object' && tag !== null) {
            this.wrapTag = tag.tag || 'div';
            delete tag.tag;
            attributes = { ...attributes, ...tag.attributes };
        }
        
        if (typeof attributes === 'string' || !attributes) {
            attributes = {};
        }
        
        if (this.wrapTag) {
            const attrString = Object.entries(attributes)
                .map(([key, value]) => `${key}="${value}"`)
                .join(' ');
            return `<${this.wrapTag} data-wrap-view="${this.controller.path}" data-wrap-id="${this.controller.id}" ${attrString}>`;
        }
        
        return `<!-- [one:view name="${this.controller.path}" id="${this.controller.id}"] -->`;
    }
    
    endWrapper() {
        if (this.wrapTag) {
            const closeTag = `</${this.wrapTag}>`;
            this.wrapTag = null;
            return closeTag;
        }
        
        this.wrapTag = null;
        return `<!-- [/one:view] -->`;
    }
    
    section(name, content, type) {
        const finalContent = String(content || '').trim();
        this.cachedSections[name] = finalContent;
        return this.controller.App.View.section(name, finalContent, type);
    }
    
    yieldSection(name, defaultValue = '') {
        return this.controller.App.View.yield(name, defaultValue);
    }
    
    yieldContent(name, defaultValue = '') {
        return this.controller.App.View.yieldContent(name, defaultValue);
    }
    
    addBlock(name, attributes = {}, content) {
        if (typeof name !== 'string' || name === '') {
            return;
        }
        if(!this.blockNameList.includes(name)) {
            this.blockNameList.push(name);
        }
        const trimContent = String(content || '').trim();
        const blockContent = `<!-- [one:block name="${name}" view="${this.controller.path}" ref="${this.controller.id}"] -->${trimContent}<!-- [/one:block] -->`;
        let key = "block." + name;
        this.cachedSections[key] = blockContent;
        return this.controller.App.View.section(key, blockContent, 'html');
    }
    
    useBlock(name, defaultValue = '') {
        if (typeof name !== 'string' || name === '') {
            return;
        }
        
        const content = this.controller.App.View.yield("block." + name, defaultValue);
        return `<!-- [one:subscribe type="block" key="${name}"] -->${content}<!-- [/one:subscribe] -->`;
    }
    
    mountBlock(name, defaultValue = '') {
        return this.useBlock(name, defaultValue);
    }
    
    subscribeBlock(name, defaultValue = '') {
        return ` data-subscribe-block="${name}"`;
    }
    
    storeChildrenReferences(children) {
        children.forEach(child => {
            const { name, id } = child;
            this.childrenConfig.push({ name, id });
        });
    }

    pushCachedSections() {
        Object.entries(this.cachedSections).forEach(([key, content]) => {
            this.controller.App.View.section(key, content, 'html');
        });
    }

    scanBlocks() {
        if( this.blockNameList.length === 0) {
            return;
        }
        this.blockNameList.forEach(name => {
            const block = OneMarkup.first('block', { name, view: this.controller.path });
            if (block) {
                this.blocks.set(name, block);
            }
        });
    }

    updateBlockListContent() {
        if( this.blockNameList.length === 0) {
            return;
        }
        this.blockNameList.forEach(name => {
            const block = this.blocks.get(name);
            if (block) {
                const content = block.outerHTML;
                let key = "block." + name;
                this.cachedSections[key] = content;
            }
        });
    }

    updateHtmlCache() {
        this.isCached = true;
        if(this.controller.superView && this.controller.superView instanceof this.controller.App.View.Controller) {
            this.updateBlockListContent();
        }
        else{
            if(this.controller.rootElement && this.controller.rootElement instanceof HTMLElement) {
                this.renderedHtml = this.controller.rootElement.outerHTML;
            }
        }
    }
    


}
