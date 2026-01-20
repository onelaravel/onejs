/**
 * ViewTemplateManager - Manages view templates, wrappers, blocks, and sections
 */

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
        
        // Child view configuration
        this.childrenConfig = [];
        this.childrenIndex = 0;
        this.refreshChildrenIndex = 0;
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
    
    addBlock(name, attributes = {}, content) {
        if (typeof name !== 'string' || name === '') {
            return;
        }
        
        const blockContent = `<!-- [one:block name="${this.controller.path}" ref="${this.controller.id}"] -->${content}<!-- [/one:block] -->`;
        return this.controller.App.View.section("block." + name, blockContent, 'html');
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
    
    section(name, content, type) {
        this.cachedSections[name] = content;
        return this.controller.App.View.section(name, content, type);
    }
    
    yieldSection(name, defaultValue = '') {
        return this.controller.App.View.yield(name, defaultValue);
    }
    
    yieldContent(name, defaultValue = '') {
        return this.controller.App.View.yieldContent(name, defaultValue);
    }
    
    storeChildrenReferences(children) {
        children.forEach(child => {
            const { name, id } = child;
            this.childrenConfig.push({ name, id });
        });
    }
}
