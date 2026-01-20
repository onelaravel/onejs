import { ViewState } from './ViewState.js';

// Import Helpers
import EventHelper from './helpers/EventHelper.js';
import ReactiveHelper from './helpers/ReactiveHelper.js';
import BindingHelper from './helpers/BindingHelper.js';
import ResourceHelper from './helpers/ResourceHelper.js';
import RenderHelper from './helpers/RenderHelper.js';
import LifecycleHelper from './helpers/LifecycleHelper.js';
import ConfigHelper from './helpers/ConfigHelper.js';
import TemplateHelper from './helpers/TemplateHelper.js';
import { ViewHierarchyManager } from './managers/ViewHierarchyManager.js';
import { ChildrenRegistry } from './managers/ChildrenRegistry.js';

/**
 * ViewControllerOptimized (New Architecture)
 * Fully stateless logic delegating to Static Helpers
 */
export class ViewControllerOptimized {
    constructor(path, view, app) {
        this.path = path;
        this.view = view;
        this.App = app;

        // --- Core Properties ---
        this.id = view.id || null;
        this.states = new ViewState(this);
        this.config = {};
        this.data = {};

        // --- State Management (Internal) ---
        this.initializeInternalState();

        // --- Legacy Manager Bridges (Optional: Keep only if strictly needed for Hierarchy/Children) ---
        // Hierarchy and ChildrenRegistry are complex logic-heavy stateful managers.
        // For now, we keep them as objects or migrate later.
        this._hierarchyManager = new ViewHierarchyManager(this);
        this._childrenRegistry = new ChildrenRegistry(this);

        // --- Flags ---
        this.isMounted = false;
        this.isDestroyed = false;
        this.isReady = false;
        this.isRendered = false;
        this.eventListenerStatus = false;
    }

    initializeInternalState() {
        this._internal = {
            events: {
                unsubscribers: new Map()
            },
            reactive: {
                components: new Map(),
                config: [],
                index: 0,
                scanIndex: 0,
                ids: [],
                prerenderIDs: [],
                renderIDs: [],
                followingIDs: [],
                followingRenderIDs: [],
                followingPrerenderIDs: [],
                parentWatch: null
            },
            binding: {
                listeners: [],
                isStarted: false,
                elementFlags: new WeakMap(),
                elementMap: new WeakMap(),
                attrConfigs: [],
                attrListeners: [],
                attrIndex: 0,
                classConfigs: [],
                classListeners: [],
                isClassReady: false
            },
            resources: {
                insertedKeys: new Set()
            }
        };
    }

    // --- Public API Bridges to Helpers ---

    /**
     * Setup the view controller with configuration
     * This is called by View.js after instantiation
     */
    setup(path, config) {
        if (this.isInitlized) {
            return this;
        }

        // Set config and path
        this.path = path;
        this.config = config || {};

        // Parse basic config properties
        if (config) {
            this.id = config.viewId || this.id;
            this.data = config.data || {};
            // ... map other flat config properties if needed ...
        }

        // Initialize Internal State via ConfigHelper
        // This will define properties (props, methods, getters) on the controller itself
        ConfigHelper.processDefinedProperties(this, config);

        // Execute Initialization Lifecycle
        this.initialize();

        return this;
    }

    initialize() {
        if (this.isInitlized) return;
        this.isInitlized = true;

        LifecycleHelper.callHook(this, 'beforeCreate');

        // Commit initial data from constructor to state
        // We need to implement commitConstructorData in ConfigHelper or here
        // Assuming ConfigHelper handles it for now based on previous context
        // ConfigHelper.commitConstructorData(this); 

        LifecycleHelper.callHook(this, 'created');

        LifecycleHelper.callHook(this, 'beforeInit');
        if (typeof this.init === 'function') {
            this.init();
        }
        LifecycleHelper.callHook(this, 'init');
        LifecycleHelper.callHook(this, 'afterInit');
    }

    __reactive(id, keys, renderFn) {
        return ReactiveHelper.renderOutputComponent(this, keys, renderFn);
    }

    // ... replicate other necessary methods ...

    mounted() {
        LifecycleHelper.callHook(this, 'beforeMount');
        // ... logic ...
        EventHelper.startEventListener(this);
        BindingHelper.startBindingEventListener(this);
        // ... logic ...
        this.isMounted = true;
        LifecycleHelper.callHook(this, 'mounted');
    }

    destroy() {
        EventHelper.stopEventListener(this);
        BindingHelper.destroy(this);
        ReactiveHelper.destroy(this);
        ResourceHelper.removeResources(this);

        if (this._childrenRegistry) this._childrenRegistry.clear();

        this._internal = null;
        this.isDestroyed = true;
    }
}
