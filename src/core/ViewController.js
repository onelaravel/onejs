/**
 * View Engine class for managing view instances
 * @param {Object} config - View configuration
 * 
 * Refactored 2025-12-29: Now uses manager pattern for better maintainability
 */
import { __defineGetters, __defineMethods, __defineProperties, __defineProps, deleteProp, escapeString, hasData, uniqId } from '../helpers/utils.js';
import { ViewState } from './ViewState.js';
import logger from './services/LoggerService.js';
import { ATTR, FORBIDDEN_KEYS } from './ViewConfig.js';
import { LoopContext } from './LoopContext.js';
import { ResourceManager } from './managers/ResourceManager.js';
import { EventManager } from './managers/EventManager.js';
import { RenderEngine } from './managers/RenderEngine.js';
import { LifecycleManager } from './managers/LifecycleManager.js';
import { ReactiveManager } from './managers/ReactiveManager.js';
import { BindingManager } from './managers/BindingManager.js';
import { ViewTemplateManager } from './managers/ViewTemplateManager.js';
import { ConfigurationManager } from './managers/ConfigurationManager.js';
import { ViewHierarchyManager } from './managers/ViewHierarchyManager.js';
import { ChildrenRegistry } from './ChildrenRegistry.js';
import { OneMarkupModel } from './OneMarkup.js';

export class ViewController {
    /**
     * 
     * @param {string} path 
     * @param {View} view 
     */
    constructor(path, view, app) {
        /**
         * @type {View}
         */
        this.view = view;
        this.states = new ViewState(this);
        // Private properties using naming convention for browser compatibility
        /**
         * @type {Application}
         */
        this.App = app;
        /**
         * @type {boolean}
         */
        this.isSuperView = false;
        /**
         * @type {function}
         */
        this._emptyFn = () => { };
        /**
         * @type {string}
         */
        this.id = null;
        /**
         * @type {function}
         */
        this.init = this._emptyFn;
        /**
         * @type {ViewController}
         */
        this.parent = null;
        /**
         * @type {Array<ViewController>}
         */
        this.children = [];
        /**
         * @type {ViewController}
         */
        this.superView = null;
        /**
         * @type {string}
         */
        this.superViewPath = null;
        /**
         * @type {string}
         */
        this.superViewId = null;
        /**
         * @type {boolean}
         */
        this.hasSuperView = false;
        /**
         * @type {string}
         */
        this.originalViewPath = null;
        /**
         * @type {string}
         */
        this.originalViewId = null;
        /**
         * @type {ViewController}
         */
        this.originalView = null;
        /**
         * @type {boolean}
         */
        this.hasAwaitData = false;
        /**
         * @type {boolean}
         */
        this.hasFetchData = false;
        /**
         * @type {Object}
         */
        this.fetch = {};
        /**
         * @type {boolean}
         */
        this.usesVars = false;
        /**
         * @type {boolean}
         */
        this.hasSections = false;
        /**
         * @type {Array<string>}
         */
        this.renderLongSections = [];
        /**
         * @type {Object}
         */
        this.sections = {};
        /**
         * @type {function}
         */
        this.addCSS = this._emptyFn;
        this.removeCSS = this._emptyFn;
        /**
         * @type {Array<string>}
         */
        this.resources = [];
        /**
         * @type {Array}
         */
        this.scripts = [];
        /**
         * @type {Array}
         */
        this.styles = [];
        /**
         * @type {Set<string>}
         */
        this.insertedResourceKeys = new Set();
        this.userDefined = {};
        /**
         * @type {Object}
         */
        this.events = {};
        this.eventIndex = 0;
        /**
         * @type {Object}
         */
        this.data = {};
        this.urlPath = '';
        /**
         * @type {boolean}
         */
        this.isInitlized = false;
        /**
         * @type {TemplateEngine}
         */
        this.templateEngine = null;

        // Initialize
        this.path = path;
        this.viewType = 'view';
        this.config = {};

        this.subscribeStates = true;

        this.isRendering = false;
        this.isRendered = false;

        this.isMounted = false;
        this.isDestroyed = false;
        this.isScanning = false;
        this.isScanned = false;

        this.isFirstClientRendering = true;

        this.isReady = false;

        this.isMarkupScanned = false;
        /**
         * @type {OneMarkupModel}
         */
        this.markup = null;

        /**
         * @type {HTMLElement}
         */
        this.rootElement = null;

        /**
         * @type {Array<HTMLElement>}
         */
        this.refElements = [];

        this.eventListenerStatus = false;

        this.eventListeners = [];

        this.isVirtualRendering = false;
        this.renderedContent = null;

        this.__scope = {};
        this.isRefreshing = false;

        this.changeStateQueueCount = 0;
        this.changedStateKeys = new Set();
        this._stateChangePending = false;

        this.loopContext = null;

        this.isCommitedConstructorData = false;

        this.isReadyToStateChangeListen = false;

        this.childrenNeedToRefreshID = null;

        // Memoization cache for expensive operations
        this._memoCache = {
            isHtmlString: new Map(),
            escapedStrings: new Map()
        };

        // Initialize managers for better code organization
        /**
         * @type {ResourceManager}
         */
        this._resourceManager = new ResourceManager(this);
        /**
         * @type {EventManager}
         */
        this._eventManager = new EventManager(this);
        /**
         * @type {RenderEngine}
         */
        this._renderEngine = new RenderEngine(this);
        /**
         * @type {LifecycleManager}
         */
        this._lifecycleManager = new LifecycleManager(this);
        /**
         * @type {ReactiveManager}
         */
        this._reactiveManager = new ReactiveManager(this);
        /**
         * @type {BindingManager}
         */
        this._bindingManager = new BindingManager(this);
        /**
         * @type {ViewTemplateManager}
         */
        this._templateManager = new ViewTemplateManager(this);
        /**
         * @type {ConfigurationManager}
         */
        this._configManager = new ConfigurationManager(this);
        /**
         * @type {ViewHierarchyManager}
         */
        this._hierarchyManager = new ViewHierarchyManager(this);
        /**
         * @type {ChildrenRegistry}
         */
        this._childrenRegistry = new ChildrenRegistry(this);

        this.renuewnChildrenIDs = [];

        // Performance tracking
        this._perfMarks = new Map();

    }

    /**
     * Mark performance checkpoint
     * @param {string} label - Performance marker label
     */
    _perfMark(label) {
        if (this.App?.env?.debug) {
            this._perfMarks.set(label, performance.now());
        }
    }

    /**
     * Measure performance between two marks
     * @param {string} startLabel - Start marker
     * @param {string} endLabel - End marker
     * @returns {number} Duration in ms
     */
    _perfMeasure(startLabel, endLabel) {
        if (!this.App?.env?.debug) {
            return 0;
        }
        const start = this._perfMarks.get(startLabel);
        const end = this._perfMarks.get(endLabel);
        if (start && end) {
            const duration = end - start;
            logger.info(`[Perf] ${this.path} ${startLabel}->${endLabel}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    }

    /**
     * Destroy view controller and cleanup all resources
     * Prevents memory leaks by properly cleaning up all references
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this._perfMark('destroy-start');

        // Call lifecycle beforeDestroy
        this._lifecycleManager?.beforeDestroy();

        // Destroy all managers
        this._reactiveManager?.destroy();
        this._eventManager?.destroy();
        this._resourceManager?.removeResources();
        this._bindingManager?.destroy();

        // Destroy state manager
        this.states?.__?.destroy();

        // Clear all references
        this.children = [];
        this.parent = null;
        this.superView = null;
        this.originalView = null;
        this.eventListeners = [];
        this.refElements = [];
        this.loopContext = null;

        // Clear data
        this.data = {};
        this.userDefined = {};
        this.events = {};
        this.sections = {};
        this.__scope = {};

        // Mark as destroyed
        this.isDestroyed = true;

        // Call lifecycle destroyed
        this._lifecycleManager?.destroyed();

        this._perfMark('destroy-end');
        this._perfMeasure('destroy-start', 'destroy-end');

        // Clear perf marks
        this._perfMarks.clear();

        logger.info(`[ViewController] Destroyed: ${this.path}`);
    }


    /**
     * Setup the view engine with configuration
     * @param {string} path - View path
     * @param {Object} config - View configuration
     */
    setup(path, config) {
        if (this.isInitlized) {
            return this;
        }

        this._perfMark('setup-start');

        // Set config and path
        this.path = path;
        this.config = config || {};

        // Call _initialize to do the actual setup
        this.initialize();

        this._perfMark('setup-end');
        this._perfMeasure('setup-start', 'setup-end');

        return this;
    }


    /**
     * Initialize the view engine with configuration
     * @private
     */
    initialize() {
        if (this.isInitlized) {
            if (typeof this.view.initialize === 'function') {
                return this.view.initialize.apply(this.view, arguments);
            }
            return;
        }

        this.isInitlized = true;
        const config = this.config;

        // Set basic properties (giữ nguyên tên từ code gốc)
        this.id = config.viewId || uniqId();
        deleteProp(config, 'viewId');
        this.init = config.init || this._emptyFn;
        deleteProp(config, 'init');
        this.addCSS = config.addCSS || this._emptyFn;
        deleteProp(config, 'addCSS');
        this.removeCSS = config.removeCSS || this._emptyFn;
        deleteProp(config, 'removeCSS');
        this.superViewPath = config.superViewPath || config.superView;
        deleteProp(config, 'superViewPath');
        deleteProp(config, 'superView');
        this.hasSuperView = config.hasSuperView;
        deleteProp(config, 'hasSuperView');
        this.hasAwaitData = config.hasAwaitData;
        deleteProp(config, 'hasAwaitData');
        this.hasFetchData = config.hasFetchData;
        deleteProp(config, 'hasFetchData');
        this.fetch = config.fetch;
        deleteProp(config, 'fetch');
        this.usesVars = config.usesVars;
        deleteProp(config, 'usesVars');
        this.hasSections = config.hasSections;
        deleteProp(config, 'hasSections');
        this.hasSectionPreload = config.hasSectionPreload;
        deleteProp(config, 'hasSectionPreload');
        this.renderLongSections = config.renderLongSections || [];
        deleteProp(config, 'renderLongSections');
        this.hasPrerender = config.hasPrerender;
        deleteProp(config, 'hasPrerender');
        this.sections = config.sections;
        deleteProp(config, 'sections');
        this._templateManager.initializeWrapperConfig(config.wrapperConfig);
        deleteProp(config, 'wrapperConfig');
        this.resources = config.resources || [];
        deleteProp(config, 'resources');
        this.scripts = config.scripts || [];
        deleteProp(config, 'scripts');
        this.styles = config.styles || [];
        deleteProp(config, 'styles');
        this.events = {};

        this.subscribeStates = false;
        this._lifecycleManager.beforeCreate();
        // Process defined properties and methods (giữ nguyên logic từ code gốc)
        this.processDefinedProperties(config);

        if (config && config.data && typeof config.data === 'object' && config.data.__SSR_VIEW_ID__) {
            config.data.__SSR_VIEW_ID__ = null;
            deleteProp(config.data, '__SSR_VIEW_ID__');
        }

        // Merge data
        this.data = { ...(this.data || {}), ...(config.data || {}) };

        this._eventManager.updateController(this);
        this._resourceManager.updateController(this);

        this.commitConstructorData();

        // Call lifecycle hooks
        this._lifecycleManager.created(); // ✅ Insert styles here

        this._lifecycleManager.beforeInit();
        this._lifecycleManager.init();
        this._lifecycleManager.afterInit();

    }



    /**
     * Insert styles into DOM
     * Styles should be inserted before render (in created hook)
     */
    /**
     * Insert styles into DOM with reference counting
     * Delegated to ResourceManager for better code organization
     */
    insertStyles() {
        return this._resourceManager.insertStyles();
    }

    /**
     * Insert scripts into DOM
     * Scripts should be inserted after DOM ready (in mounted hook)
     */
    /**
     * Insert scripts into DOM
     * Scripts should be inserted after DOM ready (in mounted hook)
     * Delegated to ResourceManager for better code organization
     */
    insertScripts() {
        return this._resourceManager.insertScripts();
    }

    /**
     * Remove styles from registry (but not from DOM if other views use them)
     */
    /**
     * Remove styles from registry (but not from DOM if other views use them)
     * Delegated to ResourceManager for better code organization
     */
    removeStyles() {
        return this._resourceManager.removeStyles();
    }


    /**
     * Remove all styles from DOM that belong to this view path
     * Used as fallback when registry-based removal fails
     * @param {string} viewPath - Optional view path, defaults to this.path
     */
    /**
     * Remove all styles from DOM that belong to this view path
     * Used as fallback when registry-based removal fails
     * @param {string} viewPath - Optional view path, defaults to this.path
     * Delegated to ResourceManager for better code organization
     */
    removeStylesByViewPath(viewPath = null) {
        return this._resourceManager.removeStylesByViewPath(viewPath);
    }


    /**
     * Remove scripts from registry (but not from DOM if other views use them)
     */
    /**
     * Remove scripts from registry (but not from DOM if other views use them)
     * Delegated to ResourceManager for better code organization
     */
    removeScripts() {
        return this._resourceManager.removeScripts();
    }


    /**
     * Process defined properties and methods from config
     * @private
     */
    /**
     * Process defined properties and methods from config
     * Delegated to ConfigurationManager
     */
    processDefinedProperties(config) {
        return this._configManager.processDefinedProperties(config);
    }



    /**
     * Set scope for the view
     * Delegated to ConfigurationManager
     */
    setScope(scope) {
        return this._configManager.setScope(scope);
    }


    /**
     * Commit constructor data
     * Delegated to ConfigurationManager
     */
    commitConstructorData() {
        return this._configManager.commitConstructorData();
    }

    /**
     * Add event configuration for view engine
     * @param {string} eventType - Type of event
     * @param {Array} handlers - Array of handler objects
     * @returns {string} Event attribute string
     * @example
     * <AppViewEngine>.addEventConfig('click', [{handler: 'handleClick', params: [1, 2, 3]}]);
     */
    addEventConfig(eventType, handlers) {
        if (typeof eventType !== 'string' || eventType === '') {
            return;
        }
        if (typeof handlers !== 'object' || handlers === null) {
            return;
        }
        return this.addEventStack(eventType, handlers);
    }



    /**
     * Render the view with data
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Rendered content
     */
    /**
     * Render the view
     * Delegated to RenderEngine for better code organization
     */
    render() {
        return this._renderEngine.render();
    }

    /**
     * Virtual render the view with data (Scan version)
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Virtual rendered content
     */
    virtualRender() {
        return this._renderEngine.virtualRender();
    }




    /**
     * Prerender the view with data
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Prerendered content
     */
    prerender(_data = {}) {
        return this._renderEngine.prerender(_data);
    }

    /**
     * Virtual prerender the view with data (Scan version)
     * @param {Object} _data - Additional data to merge
     * @returns {string|Object} Virtual prerendered content
     */
    virtualPrerender(_data = {}) {
        return this._renderEngine.virtualPrerender(_data);
    }




    /**
     * Replace view content with new HTML
     * @param {string} htmlString - New HTML content
     * @returns {boolean} True if replaced successfully
     */
    replaceView(htmlString) {
        if (this.isHtmlString(htmlString)) {
            const container = document.createElement('div');
            container.innerHTML = htmlString;
            const frag = container.content;
            const oldElements = document.querySelectorAll(`[x-ref-view="${this.id}"]`);
            const elemtntCount = oldElements.length;
            for (let i = elemtntCount - 1; i > 0; i--) {
                const oldElement = oldElements[i];
                const newElement = frag.childNodes[i];
                oldElement.parentNode.replaceChild(newElement, oldElement);
            }
            const oldElement = oldElements[0];
            oldElement.parentNode.replaceChild(frag, oldElement);
            return true;
        }
        return false;
    }

    refresh(data = null) {
        return this._renderEngine.refresh(data);
    }


    onChildrenRefresh(childName, childIndex) {
        return this._lifecycleManager.onChildrenRefresh(childName, childIndex);
    }
    /**
     * Lifecycle: Called when super view is mounted (giữ nguyên tên từ code gốc)
     */
    onSuperViewMounted() {
        this._lifecycleManager.mounted();
    }

    /**
     * Lifecycle: Called when super view is unmounted (giữ nguyên tên từ code gốc)
     */
    onSuperViewUnmounted() {

    }

    /**
     * Lifecycle: Called when parent view is mounted (giữ nguyên tên từ code gốc)
     */
    onParentMounted() {
        this._lifecycleManager.mounted();
    }
    /**
     * Lifecycle: Called when parent view is unmounted (giữ nguyên tên từ code gốc)
     */
    onParentUnmounted() {
        // Placeholder for when parent view is unmounted
    }



    /**
     * Hàm parse string HTML thành DOM, thêm thuộc tính x-ref-view cho các phần tử con level 0, trả về string HTML mới.
     * @param {string} htmlString - Chuỗi HTML đầu vào
     * @param {string|number} id - Giá trị cho thuộc tính x-ref-view
     * @returns {string} Chuỗi HTML đã thêm thuộc tính x-ref-view cho các phần tử level 0
     */
    addXRefViewToRootElements(htmlString) {
        // Tạo một container ảo để parse HTML
        const container = document.createElement('div');
        container.innerHTML = htmlString;

        // Lặp qua các phần tử con trực tiếp (level 0)
        Array.from(container.children).forEach(child => {
            child.setAttribute('x-ref-view', this.id);
        });

        // Trả về HTML đã được thêm thuộc tính
        return container.innerHTML;
    }

    /**
     * Check if string is HTML
     * @param {string} str - String to check
     * @returns {boolean} True if HTML string
     * @private
     */
    isHtmlString(str) {
        return /<[a-z][\s\S]*>/i.test(str);
    }



    renderPlaceholder() {
        return `<div class="${ATTR.className('placeholder')}" ${ATTR.KEYS.VIEW_ID}="${this.id}"></div>`;
    }

    showError(error) {
        if (this.isSuperView) {
            return `<div class="${ATTR.className('ERROR_VIEW')}">${error}</div>`;
        }
        else if (this.hasSuperView) {
            if (this.renderLongSections.length > 0) {
                return this.renderLongSections.map(section => {
                    return this.App.View.section(section, `<div class="${ATTR.className('section-error')}" ${ATTR.KEYS.VIEW_SECTION_REF}="${this.id}">${error}</div>`, 'html');
                }).join('');
            }
            else {
                return `<div class="${ATTR.className('ERROR_VIEW')}" ${ATTR.KEYS.VIEW_ID}="${this.id}">${error}</div>`;
            }
        }
        else {
            if (this.renderLongSections.length > 0) {
                return this.renderLongSections.map(section => {
                    return this.App.View.section(section, `<div class="${ATTR.className('section-error')}" ${ATTR.KEYS.VIEW_SECTION_REF}="${this.id}">${error}</div>`, 'html');
                }).join('');
            }
            return `<div class="${ATTR.className('ERROR_VIEW')}" ${ATTR.KEYS.VIEW_ID}="${this.id}">${error}</div>`;
        }
    }

    showErrorScan(error) {
        return null;
    }


    /**
     * Reset original view
     * Delegated to ViewHierarchyManager
     */
    resetOriginalView() {
        return this._hierarchyManager.resetOriginalView();
    }

    /**
     * Eject original view
     * Delegated to ViewHierarchyManager
     */
    ejectOriginalView() {
        return this._hierarchyManager.ejectOriginalView();
    }

    /**
     * Remove this view and all children
     * Delegated to ViewHierarchyManager
     */
    remove() {
        return this._hierarchyManager.remove();
    }

    /**
     * Insert resources into DOM
     */
    insertResources() {
        this.resources.forEach(resource => {
            if (document.querySelector(`[data-resource-uuid="${resource.uuid}"]`)) {
                return;
            }
            const element = document.createElement(resource.tag);
            Object.entries(resource.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            element.setAttribute('data-resource-uuid', resource.uuid);
            if (resource.tag === 'script') {
                document.body.appendChild(element);
            }
            else if (resource.tag === 'link') {
                document.head.appendChild(element);
            }
            else if (resource.tag === 'style') {
                document.head.appendChild(element);
            }
            document.head.appendChild(element);
        });
    }

    /**
     * Remove resources from DOM
     */
    removeResources() {
        this.resources.forEach(resource => {
            const element = document.querySelector(`[data-resource-uuid="${resource.uuid}"]`);
            if (element) {
                element.remove();
            }
        });
    }


    __showError(error) {
        logger.error(`ViewEngine Error [${this.path}]: ${error}`);
        return this.showError(error);
    }

    __section(name, content, type) {
        return this._templateManager.section(name, content, type);
    }

    __yield(name, defaultValue = '') {
        return this._templateManager.yieldSection(name, defaultValue);
    }

    __yieldContent(name, defaultValue = '') {
        return this._templateManager.yieldContent(name, defaultValue);
    }



    __execute(...args) {
        return this.App.View.execute(...args);
    }

    __subscribe(...args) {
        // return this.subscribe(...args);
    }


    __text(...args) {
        return this.App.View.text(...args);
    }


    __follow(stateKeys = [], renderBlock = () => '') {
        // @follow directive has been removed - use __watch instead
        console.warn('@follow directive is deprecated. Use __watch() instead.');
        return this.__watch(uniqId(), stateKeys, renderBlock);
    }

    __attr(attrs = {}) {
        if (typeof attrs !== 'object' || attrs === null) {
            return '';
        }
        let result = this._reactiveManager.renderBindingAttribute(attrs);
        return result;
    }

    __watch(watchID, watchKeys = [], callback = () => { }) {
        return this._reactiveManager.renderWatchComponent(watchID, watchKeys, callback);
    }

    __output(subscribeKeys = [], renderBlock = () => '') {
        if (this.isVirtualRendering) {
            return this._reactiveManager.renderOutputComponentScan(subscribeKeys, renderBlock);
        }
        return this._reactiveManager.renderOutputComponent(subscribeKeys, renderBlock);
    }

    __outputEscaped(subscribeKeys = [], renderBlock = () => '') {
        return this._reactiveManager.renderOutputEscapedComponent(subscribeKeys, renderBlock);
    }

    /**
     * Unified reactive component method
     * @param {string} reactiveID - Component ID
     * @param {Array<string>} stateKeys - State keys to watch
     * @param {Function} renderBlock - Render function
     * @param {Object} options - Component options
     * @returns {string} Rendered component
     */
    __reactive(reactiveID, stateKeys = [], renderBlock = () => '', options = {}) {
        const {
            type = 'output',
            escapeHTML = false
        } = options;

        if (type === 'watch') {
            return this._reactiveManager.renderWatchComponent(reactiveID, stateKeys, renderBlock);
        }

        if (escapeHTML) {
            return this._reactiveManager.renderOutputEscapedComponent(stateKeys, renderBlock);
        }

        return this._reactiveManager.renderOutputComponent(stateKeys, renderBlock);
    }

    __checked(condition) {
        return condition ? 'checked' : '';
    }
    __classBinding(bindings = []) {
        if (!Array.isArray(bindings)) {
            return '';
        }
        return this._reactiveManager.renderClassBinding(bindings);
    }

    __styleBinding(watchKeys = [], styles = []) {
        // Generate reactive style binding
        // styles = [['color', 'red'], ['font-size', '14px']]
        // Returns: "color: red; font-size: 14px;"

        const generateStyle = () => {
            if (!Array.isArray(styles)) return '';

            return styles
                .map(([prop, value]) => {
                    if (prop && value !== null && value !== undefined) {
                        return `${prop}: ${value}`;
                    }
                    return '';
                })
                .filter(s => s)
                .join('; ');
        };

        if (watchKeys && watchKeys.length > 0) {
            // Reactive - watch state changes
            return this._reactiveManager.renderWatchComponent(watchKeys, generateStyle);
        } else {
            // Static - generate once
            return generateStyle();
        }
    }

    __showBinding(watchKeys = [], condition) {
        // Generate reactive visibility binding
        // Similar to v-show in Vue - toggles display property
        // Returns: "display: none;" or "" based on condition

        const generateDisplay = () => {
            return condition ? '' : 'display: none;';
        };

        if (watchKeys && watchKeys.length > 0) {
            // Reactive - watch state changes
            return this._reactiveManager.renderWatchComponent(watchKeys, generateDisplay);
        } else {
            // Static - generate once
            return generateDisplay();
        }
    }



    __block(name, attributes = {}, content) {
        return this._templateManager.addBlock(name, attributes, content);
    }

    __useBlock(name, defaultValue = '') {
        return this._templateManager.useBlock(name, defaultValue);
    }

    __mountBlock(name, defaultValue = '') {
        return this._templateManager.mountBlock(name, defaultValue);
    }

    __subscribeBlock(name, defaultValue = '') {
        return this._templateManager.subscribeBlock(name, defaultValue);
    }

    __include(path, data = {}) {
        if (this.isVirtualRendering) {
            const childParams = this._templateManager.childrenConfig[this._templateManager.childrenIndex];
            if (!(childParams && childParams.name === path)) {
                return null;
            }
            this._templateManager.childrenIndex++;
            const childConfig = this.App.View.ssrViewManager.getInstance(childParams.name, childParams.id);
            if (!childConfig) {
                return null;
            }
            const childData = { ...data, ...childConfig.data, __SSR_VIEW_ID__: childParams.id };
            const child = this.$include(childParams.name, childData);
            if (!child) {
                return null;
            }
            child.__.__scan(childConfig);
            return this.App.View.renderView(child, null, true);
        }

        if (this.isRefreshing) {
            let childCtrl = this.children.find(c => c.__scope.name === path && c.__scope.index === this._templateManager.childrenIndex);
            if (childCtrl) {
                childCtrl.isFirstClientRendering = false;
                childCtrl._templateManager.wrapperConfig.enable = true;
                this._templateManager.childrenIndex++;
                const result = this.childrenNeedToRefreshID === childCtrl.id ? childCtrl.rrend() : null;

                return childCtrl.render();
            }
        }
        return this.$include(path, data);

    }

    __includeif(path, data = {}) {
        if (!this.App.View.exists(path)) {
            return null;
        }
        return this.__include(path, data);
    }

    __includewhen(condition, path, data = {}) {
        if (!condition) {
            return null;
        }
        return this.__include(path, data);
    }


    __extends(name, data = {}) {
        if (this.isVirtualRendering) {
            if (!this.App.View.exists(name)) {
                return null;
            }
            let superViewConfig = null;
            let superViewOfChildren = this._templateManager.childrenConfig.find((child, index) => child.name === name && index == this._templateManager.childrenConfig.length - 1);
            if (superViewOfChildren) {
                superViewConfig = this.App.View.ssrViewManager.getInstance(superViewOfChildren.name, superViewOfChildren.id);
            } else {
                superViewConfig = this.App.View.ssrViewManager.scan(name);
            }
            if (!superViewConfig) {
                return null;
            }
            const superViewData = { ...data, ...superViewConfig.data, __SSR_VIEW_ID__: superViewConfig.viewId };
            const superView = this.$extends(name, superViewData);
            if (!superView) {
                return null;
            }
            superView.__.__scan(superViewConfig);
            return superView;
        }
        return this.$extends(name, data);
    }


    __setLoopContext(length) {
        let parent = this.loopContext;
        this.loopContext = new LoopContext(parent);
        this.loopContext.setCount(length);
        return this.loopContext;
    }

    __resetLoopContext() {
        if (this.loopContext && this.loopContext.parent) {
            let parent = this.loopContext.parent;
            this.loopContext.parent = null;
            Object.freeze(this.loopContext);
            this.loopContext = parent;
        } else if (this.loopContext) {
            Object.freeze(this.loopContext);
            this.loopContext = null;
        } else {
            this.loopContext = null;
        }
        return this.loopContext;
    }

    /**
     * Lặp qua danh sách hoặc đối tượng và gọi callback cho mỗi phần tử hoặc key
     * @param {Array|Object} list danh sách cần lặp hoặc đối tượng cần lặp
     * @param {function(item: any, defaultKeyName: string, index: number, loopContext: LoopContext): string} callback hàm callback để xử lý mỗi phần tử hoặc key của đối tượng
     * @returns {string} kết quả của việc lặp
     * @example
     * <AppViewEngine>.foreach([1, 2, 3], (item, defaultKeyName, index, loopContext) => {
     *     return `<div>${defaultKeyName}: ${item}</div>`;
     * });
     * // returns '<div>1</div><div>2</div><div>3</div>'
     * <AppViewEngine>.foreach({a: 1, b: 2, c: 3}, (value, key, index, loopContext) => {
     *     return `<div>${key}: ${value}</div>`;
     * });
     */
    __foreach(list, callback) {
        if (!list || (typeof list !== 'object')) {
            return '';
        }
        let result = '';
        if (Array.isArray(list)) {
            let loopContext = this.__setLoopContext(list);
            loopContext.setType('increment');
            list.forEach((item, index) => {
                loopContext.setCurrentTimes(index);
                result += callback(item, index, index, loopContext);
            });
            this.__resetLoopContext();
        } else {
            let count = Object.keys(list).length;
            let loopContext = this.__setLoopContext(count);
            loopContext.setType('increment');
            let index = 0;
            Object.entries(list).forEach(([key, value]) => {
                loopContext.setCurrentTimes(index);
                result += callback(value, key, index, loopContext);
                index = index + 1;
            });
            this.__resetLoopContext();
        }

        return result;
    }

    __for(loopType = 'increment', start = 0, end = 0, execute = (loop) => '') {
        const LoopContext = this.__setLoopContext(end);
        LoopContext.setType(loopType);
        const result = typeof execute === 'function' ? execute(LoopContext) : '';
        this.__resetLoopContext();
        return result;
    }


    /**
     * Scan and hydrate server-rendered view
     * This method:
     * 1. Finds DOM elements for this view
     * 2. Attaches event handlers from server data
     * 3. Sets up state subscriptions
     * 4. Stores children and following block references
     *
     * @param {Object} config - Server-side view configuration
     * @param {string} config.viewId - View instance ID
     * @param {Object} config.data - View data from server
     * @param {Object} config.events - Event handlers to attach
     * @param {Array} config.following - Following blocks to setup
     * @param {Array} config.children - Child views to scan
     * @param {Object} config.parent - Parent view reference
     */
    /**
     * Scan view configuration and setup reactive components
     * Delegated to RenderEngine for better code organization
     */
    __scan(config) {
        return this._renderEngine.scan(config);
    }

    /**
     * Find and store DOM elements for this view
     * @private
     * @param {string} viewId - View instance ID
     */
    __scanDOMElements(viewId) {
        return this._renderEngine.scanDOMElements(viewId);
    }

    /**
     * Store children view references for hydration
     * @private
     * @param {Array} children - Child view configurations
     */
    __storeChildrenReferences(children) {
        this._templateManager.storeChildrenReferences(children);
    }



    $extends(path, data = {}) {
        return this._hierarchyManager.createSuperView(path, data);
    }

    $include(path, data = {}) {
        return this._hierarchyManager.createChildView(path, data);
    }


    addEventStack(eventType, handlers) {
        if (typeof handlers !== 'object' || handlers === null) {
            return;
        }
        let eventIndex = this.eventIndex++;
        let eventID = this.id + '-' + eventType + '-' + eventIndex;
        if (typeof eventID !== 'string' || eventID === '') {
            return;
        }
        if (typeof this.events[eventType] === 'undefined') {
            this.events[eventType] = {};
        }
        if (typeof this.events[eventType][eventID] === 'undefined') {
            this.events[eventType][eventID] = []
        }
        this.events[eventType][eventID].push(...handlers);

        return ` data-${eventType}-id="${eventID}"`;
    }


    __addEventConfig(eventType, handlers) {
        return this.addEventConfig(eventType, handlers);
    }

    /**
     * Set event configuration for view engine
     * @param {Object} events - Event configuration object
     */
    setEventConfig(events) {
        if (typeof events !== 'object' || events === null) {
            return;
        }
        Object.entries(events).forEach((eventType, eventObjectList) => {
            if (typeof eventObjectList !== 'object' || eventObjectList === null) {
                return;
            }
            Object.entries(eventObjectList).forEach((eventID, handlers) => {
                this.addEventStack(eventType, eventID, handlers);
            });
        });
    }



    wrapattr() {
        return this._templateManager.wrapperAttribute();
    }

    startWrapper(tag = null, attributes = {}) {
        return this._templateManager.startWrapper(tag, attributes);
    }

    endWrapper() {
        return this._templateManager.endWrapper();
    }




    onStateDataChanges() {
        const data = this.stateChangeData;
        this.stateChangeData = null;
    }

    /**
     * Set App instance
     * @param {Object} app - App instance
     * @returns {ViewController} This instance for chaining
     */
    setApp(app) {
        this.App = app;
        return this;
    }

    setUrlPath(urlPath) {
        this.urlPath = urlPath;
        return this;
    }
    /**
     * Set super view
     * Delegated to ViewHierarchyManager
     */
    setSuperView(superView) {
        return this._hierarchyManager.setSuperView(superView);
    }

    /**
     * Set parent view
     * Delegated to ViewHierarchyManager
     */
    setParent(parent) {
        return this._hierarchyManager.setParent(parent);
    }

    /**
     * Set original view
     * Delegated to ViewHierarchyManager
     */
    setOriginalView(originalView) {
        return this._hierarchyManager.setOriginalView(originalView);
    }

    /**
     * Add child view
     * Delegated to ViewHierarchyManager
     */
    addChild(child, data = {}) {
        return this._hierarchyManager.addChild(child, data);
    }

    /**
     * Remove child view
     * Delegated to ViewHierarchyManager
     */
    removeChild(child) {
        return this._hierarchyManager.removeChild(child);
    }

    /**
     * Update data
     * Delegated to ConfigurationManager
     */
    updateData(__data = {}) {
        return this._configManager.updateData(__data);
    }

    /**
     * Update variable data
     * Delegated to ConfigurationManager
     */
    updateVariableData(data = {}) {
        return this._configManager.updateVariableData(data);
    }

    /**
     * Update variable item
     * Delegated to ConfigurationManager
     */
    updateVariableItem(key, value) {
        return this._configManager.updateVariableItem(key, value);
    }

    /**
     * Set isSuperView flag
     * @param {boolean} isSuperView - Super view flag
     * @returns {AppViewEngine} This instance for chaining
     */
    setIsSuperView(isSuperView) {
        this.isSuperView = isSuperView;
        return this;
    }

    /** Events */


    reset() {
        this._templateManager.resetChildrenIndex();
        this._reactiveManager.resetScanIndex();
    }

    clear() {
        // Use registry for proper cleanup if available
        if (this._childrenRegistry) {
            this._childrenRegistry.clear();
        } else {
            // Fallback to manual cleanup
            this.children.forEach(childCtrl => {
                if (childCtrl && childCtrl instanceof ViewController) {
                    childCtrl.destroy();
                }
            });
            this.children = [];
        }

        this._reactiveManager.clearForRefresh();
        this._bindingManager.reset();
        this.refElements = {};
    }

    query(selector) {
        for (const el of this.refElements) {
            // 1. chính element
            if (el.matches?.(selector)) {
                return el;
            }

            // 2. con bên trong
            const found = el.querySelector?.(selector);
            if (found) {
                return found;
            }
        }
        return null;
    }

    queryAll(selector) {
        const results = [];

        for (const el of this.refElements) {
            // chính element
            if (el.matches?.(selector)) {
                results.push(el);
            }

            // con bên trong
            const found = el.querySelectorAll?.(selector);
            if (found?.length) {
                results.push(...found);
            }
        }

        return results;
    }
    // accessors

    get type() {
        return this.viewType;
    }
    set type(value) {
        this.viewType = value;
    }

}