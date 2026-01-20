/**
 * View Engine class for managing view instances
 * @param {Object} config - View configuration
 */
import { __defineGetters, __defineMethods, __defineProp, __defineProperties, __defineProps, deleteProp, hasData, uniqId } from '../helpers/utils.js';
import { ViewState } from './ViewState.js';
import logger from './services/LoggerService.js';
import { ViewController } from './ViewController.js';

/**
 * @property {ViewController} __ - Internal view controller
 */
export class View {
    /**
     * Global resource registry
     * Key: resourceKey (e.g., 'css:/css/chart.css' or 'js:/js/chart.js')
     * Value: { element: HTMLElement, viewPaths: Set<string>, referenceCount: number, resourceType: string }
     */
    static resourceRegistry = new Map();
    static scripts = new Map();

    static registerScript(name, key, callback) {
        if (!name || !key || typeof callback !== 'function') {
            return;
        }
        if (!this.scripts.has(name)) {
            this.scripts.set(name, new Map());
        }
        if (this.scripts.get(name).has(key)) {
            return;
        }
        this.scripts.get(name).set(key, callback);
    }

    static getScript(name, key) {
        if (!name || !key) {
            return null;
        }
        return this.scripts.get(name)?.get(key) || null;
    }

    /**
     * Generate resource key from resource data
     * @param {Object} resource - Resource object
     * @returns {string} Resource key
     */
    static getResourceKey(resource) {
        // For function wrapper scripts, use function name (ensures single execution)
        if (resource.type === 'code' && resource.function) {
            return `script:function:${resource.function}`;
        }

        // For external resources, use src/href
        if (resource.type === 'src' && resource.src) {
            return `script:${resource.src}`;
        }
        if (resource.type === 'href' && resource.href) {
            return `style:${resource.href}`;
        }

        // For inline resources with id, use id
        if (resource.id) {
            const prefix = resource.type === 'code'
                ? (resource.resourceType === 'script' ? 'script:inline:' : 'style:inline:')
                : '';
            return `${prefix}${resource.id}`;
        }

        // Fallback: use view path + content hash
        const content = resource.content || resource.src || resource.href || '';
        const hash = View._simpleHash(content);
        return `${resource.type}:${resource.viewPath}:${hash}`;
    }

    /**
     * Simple hash function for content
     * @private
     */
    static _simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    constructor(path, config) {


        /**
         * @type {ViewController}
         */
        const controller = new ViewController(path, this, null);
        Object.defineProperty(this, '__', {
            value: controller,
            writable: false,
            configurable: false,
            enumerable: false,
        });
        /**
         * @type {boolean}
         */
        
        __defineProp(this, 'path', {
            value: path,
            writable: false,
            configurable: false,
            enumerable: false,
        });
        
        __defineProp(this, 'viewType', {
            value: 'view',
            writable: true,
            configurable: false,
            enumerable: false,
        });

    }


    /**
     * Setup the view engine with configuration
     * @param {string} path - View path
     * @param {Object} config - View configuration
     */
    setup(path, userDefined, config) {
        if (this.isInitlized) {
            return this;
        }
        this.__.setApp(this.App);
        // Set config and path

        // this.config = config || {};
        this.__initialize__();

        if (userDefined && typeof userDefined === 'object') {
            Object.entries(userDefined).forEach(([key, value]) => {
                this[key] = value;
            });
        }



        this.__.setup(path, config);
        // Call _initialize to do the actual setup
        return this;
    }


    /**
     * Initialize the view engine with configuration
     * @private
     */
    __initialize__() {
        if (this.isInitlized) {
            return;
        }

        __defineProp(this, 'isInitlized', {
            value: true,
            writable: false,
            configurable: false,
            enumerable: false,
        });

    }






    /**
     * Set App instance
     * @param {Object} app - App instance
     * @returns {AppViewEngine} This instance for chaining
     */
    setApp(app) {
        this.__.setApp(app);
        return this;
    }


    /**
     * Reset view engine
     */
    reset() {
        // Implementation placeholder
    }

    // accessors

    get App() {
        return this.__.App;
    }
    set App(value) {
        // this.__.App = value;
    }

    get id() {
        return this.__.id;
    }
    set id(value) {
        // this.__.id = value;
    }

    get type() {
        return this.viewType;
    }
    set type(value) {
        this.viewType = value;
    }

    get parent() {
        return this.__.parent?.view || null;
    }
    set parent(value) {
        // this.__.parent = value;
    }

    get children() {
        return this.__.children.map(ctrl => ctrl.view);
    }
    set children(value) {
        // this.__.children = value;
    }

    get superView() {
        return this.__.superView?.view || null;
    }
    set superView(value) {
        // this.__.superView = value;
    }
    get originalView() {
        return this.__.originalView?.view || null;
    }
    set originalView(value) {
        // this.__.originalView = value;
    }
    get isSuperView() {
        return this.__.isSuperView;
    }
    set isSuperView(value) {
        // this.__.isSuperView = value;
    }
    get isOriginalView() {
        return this.__.isOriginalView;
    }
    set isOriginalView(value) {
        // this.__.isOriginalView = value;
    }

    get hasSuperView() {
        return this.__.hasSuperView;
    }
    set hasSuperView(value) {
        this.__.hasSuperView = value;
    }

    get urlPath() {
        return this.__.urlPath;
    }
    set urlPath(value) {
        this.__.urlPath = value;
    }

}

// Export ViewEngine as alias for View (for backward compatibility)
export const ViewEngine = View;