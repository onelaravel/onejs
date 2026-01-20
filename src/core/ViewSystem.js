/**
 * Enhanced View System with Server-Side Rendering Support
 * Handles view identification, hydration, and DOM mapping
 */

import { ViewIdentifier } from './ViewIdentifier.js';

export class ViewSystem {
    constructor() {
        this.identifier = new ViewIdentifier();
        this.hydratedViews = new Set();
        this.viewInstances = new Map();
        this.isServerRendered = false;
        this.hydrationComplete = false;
    }

    /**
     * Initialize the view system
     */
    init() {
        this.detectServerRendering();
        this.identifier.init();
        
        if (this.isServerRendered) {
            this.hydrateServerRenderedViews();
        }
        
        this.setupGlobalEventListeners();
    }

    /**
     * Detect if page was server-rendered
     */
    detectServerRendering() {
        const container = document.querySelector('#app-root, #app, [data-server-rendered]');
        this.isServerRendered = container && container.getAttribute('data-server-rendered') === 'true';
        
        console.log(`🔍 Server rendering detected: ${this.isServerRendered}`);
    }

    /**
     * Hydrate server-rendered views
     */
    hydrateServerRenderedViews() {
        console.log('🚀 Starting hydration of server-rendered views...');
        
        // Get all view elements
        const viewElements = this.identifier.getAllViewElements();
        
        viewElements.forEach(element => {
            const viewInfo = this.identifier.extractViewInfo(element);
            if (viewInfo) {
                this.hydrateView(element, viewInfo);
            }
        });

        // Mark hydration as complete
        this.hydrationComplete = true;
        this.emitHydrationComplete();
        
        console.log('✅ Hydration complete');
    }

    /**
     * Hydrate a specific view
     */
    hydrateView(element, viewInfo) {
        try {
            // Create view instance if not exists
            if (!this.viewInstances.has(viewInfo.id)) {
                const viewInstance = this.createViewInstance(viewInfo);
                this.viewInstances.set(viewInfo.id, viewInstance);
            }

            const viewInstance = this.viewInstances.get(viewInfo.id);
            
            // Attach view instance to element
            element._spaViewInstance = viewInstance;
            
            // Mark as hydrated
            this.hydratedViews.add(viewInfo.id);
            
            // Trigger view lifecycle
            this.triggerViewLifecycle(viewInstance, 'mounted');
            
            console.log(`✅ Hydrated view: ${viewInfo.name} (${viewInfo.id})`);
            
        } catch (error) {
            console.error(`❌ Failed to hydrate view ${viewInfo.name}:`, error);
        }
    }

    /**
     * Create view instance
     */
    createViewInstance(viewInfo) {
        return {
            id: viewInfo.id,
            name: viewInfo.name,
            path: viewInfo.path,
            type: viewInfo.type,
            element: viewInfo.element,
            isHydrated: false,
            lifecycle: {
                mounted: false,
                updated: false,
                destroyed: false
            },
            data: {},
            methods: {}
        };
    }

    /**
     * Trigger view lifecycle events
     */
    triggerViewLifecycle(viewInstance, event) {
        const element = viewInstance.element;
        
        // Dispatch custom events
        const customEvent = new CustomEvent(`spa:view:${event}`, {
            detail: {
                view: viewInstance,
                timestamp: Date.now()
            }
        });
        element.dispatchEvent(customEvent);

        // Update lifecycle state
        viewInstance.lifecycle[event] = true;
        
        // Call view methods if available
        if (viewInstance.methods[event]) {
            try {
                viewInstance.methods[event].call(viewInstance);
            } catch (error) {
                console.error(`Error in view ${event} method:`, error);
            }
        }
    }

    /**
     * Setup global event listeners
     */
    setupGlobalEventListeners() {
        // Listen for view changes
        document.addEventListener('spa:view:changed', (event) => {
            this.onViewChanged(event.detail.view);
        });

        // Listen for navigation events
        document.addEventListener('spa:navigation:start', () => {
            this.pauseViewUpdates();
        });

        document.addEventListener('spa:navigation:complete', () => {
            this.resumeViewUpdates();
        });
    }

    /**
     * Handle view change
     */
    onViewChanged(viewData) {
        console.log(`🔄 View changed to: ${viewData.info.name}`);
        
        // Update current view tracking
        this.identifier.setCurrentView(viewData.info.id);
        
        // Trigger view enter event
        this.triggerViewLifecycle(viewData, 'enter');
    }

    /**
     * Pause view updates during navigation
     */
    pauseViewUpdates() {
        this.viewInstances.forEach(viewInstance => {
            viewInstance.isPaused = true;
        });
    }

    /**
     * Resume view updates after navigation
     */
    resumeViewUpdates() {
        this.viewInstances.forEach(viewInstance => {
            viewInstance.isPaused = false;
        });
    }

    /**
     * Get view by ID
     */
    getView(viewId) {
        return this.viewInstances.get(viewId);
    }

    /**
     * Get all hydrated views
     */
    getHydratedViews() {
        return Array.from(this.hydratedViews).map(id => this.viewInstances.get(id));
    }

    /**
     * Get views by type
     */
    getViewsByType(type) {
        const views = [];
        this.viewInstances.forEach(viewInstance => {
            if (viewInstance.type === type) {
                views.push(viewInstance);
            }
        });
        return views;
    }

    /**
     * Update view data
     */
    updateViewData(viewId, data) {
        const viewInstance = this.viewInstances.get(viewId);
        if (viewInstance) {
            viewInstance.data = { ...viewInstance.data, ...data };
            this.triggerViewLifecycle(viewInstance, 'updated');
        }
    }

    /**
     * Destroy view
     */
    destroyView(viewId) {
        const viewInstance = this.viewInstances.get(viewId);
        if (viewInstance) {
            this.triggerViewLifecycle(viewInstance, 'destroyed');
            this.hydratedViews.delete(viewId);
            this.viewInstances.delete(viewId);
        }
    }

    /**
     * Emit hydration complete event
     */
    emitHydrationComplete() {
        const event = new CustomEvent('spa:hydration:complete', {
            detail: {
                hydratedViews: this.hydratedViews.size,
                totalViews: this.viewInstances.size,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            isServerRendered: this.isServerRendered,
            hydrationComplete: this.hydrationComplete,
            totalViews: this.viewInstances.size,
            hydratedViews: this.hydratedViews.size,
            identifier: this.identifier.getDebugInfo()
        };
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        this.identifier.enableDebugMode();
        console.log('🔧 Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.identifier.disableDebugMode();
        console.log('🔧 Debug mode disabled');
    }

    /**
     * Export system data for debugging
     */
    exportSystemData() {
        return {
            status: this.getStatus(),
            views: this.identifier.exportViewData(),
            instances: Array.from(this.viewInstances.entries()).map(([id, instance]) => ({
                id,
                name: instance.name,
                type: instance.type,
                isHydrated: this.hydratedViews.has(id),
                lifecycle: instance.lifecycle
            }))
        };
    }
}
