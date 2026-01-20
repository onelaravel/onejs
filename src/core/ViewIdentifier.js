/**
 * View Identifier System
 * Handles view identification and DOM mapping for server-rendered content
 */

export class ViewIdentifier {
    constructor() {
        this.viewElements = new Map();
        this.viewHierarchy = new Map();
        this.currentView = null;
        this.debugMode = false;
    }

    /**
     * Initialize view identification system
     */
    init() {
        this.scanViewElements();
        this.buildViewHierarchy();
        this.setupViewTracking();
        
        if (this.debugMode) {
            this.enableDebugMode();
        }
    }

    /**
     * Scan all elements with view identification attributes
     */
    scanViewElements() {
        const elements = document.querySelectorAll('[data-spa-view]');
        
        elements.forEach(element => {
            const viewInfo = this.extractViewInfo(element);
            if (viewInfo) {
                this.viewElements.set(viewInfo.id, {
                    element,
                    info: viewInfo,
                    children: [],
                    parent: null
                });
            }
        });

        console.log(`🔍 Found ${this.viewElements.size} view elements`);
    }

    /**
     * Extract view information from element
     */
    extractViewInfo(element) {
        const viewId = element.getAttribute('data-spa-view-id');
        const viewName = element.getAttribute('data-spa-view-name');
        const viewPath = element.getAttribute('data-spa-view-path');
        const viewType = element.getAttribute('data-spa-view-type');
        const viewScope = element.getAttribute('data-spa-view');

        if (!viewId) return null;

        return {
            id: viewId,
            name: viewName || 'unknown',
            path: viewPath || 'unknown',
            type: viewType || 'view',
            scope: viewScope || 'unknown',
            element
        };
    }

    /**
     * Build view hierarchy based on DOM structure
     */
    buildViewHierarchy() {
        this.viewElements.forEach((viewData, viewId) => {
            const element = viewData.element;
            
            // Find parent view
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
                const parentViewId = parent.getAttribute('data-spa-view-id');
                if (parentViewId && this.viewElements.has(parentViewId)) {
                    viewData.parent = parentViewId;
                    this.viewElements.get(parentViewId).children.push(viewId);
                    break;
                }
                parent = parent.parentElement;
            }
        });

        console.log('🏗️ View hierarchy built');
    }

    /**
     * Setup view tracking and event listeners
     */
    setupViewTracking() {
        // Track view changes
        this.viewElements.forEach((viewData, viewId) => {
            this.setupViewEventListeners(viewData);
        });

        // Track DOM changes for dynamic content
        this.setupMutationObserver();
    }

    /**
     * Setup event listeners for a view
     */
    setupViewEventListeners(viewData) {
        const { element, info } = viewData;

        // Add view lifecycle events
        element.addEventListener('spa:view:enter', () => {
            this.onViewEnter(info);
        });

        element.addEventListener('spa:view:leave', () => {
            this.onViewLeave(info);
        });

        // Add click tracking for debugging
        if (this.debugMode) {
            element.addEventListener('click', (e) => {
                console.log(`🖱️ Click on view: ${info.name} (${info.id})`, e.target);
            });
        }
    }

    /**
     * Setup mutation observer for dynamic content
     */
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const viewId = node.getAttribute('data-spa-view-id');
                            if (viewId && !this.viewElements.has(viewId)) {
                                // New view element added
                                this.scanViewElements();
                                this.buildViewHierarchy();
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Get view by ID
     */
    getView(viewId) {
        return this.viewElements.get(viewId);
    }

    /**
     * Get all views by type
     */
    getViewsByType(type) {
        const views = [];
        this.viewElements.forEach((viewData, viewId) => {
            if (viewData.info.type === type) {
                views.push(viewData);
            }
        });
        return views;
    }

    /**
     * Get current active view
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Set current active view
     */
    setCurrentView(viewId) {
        const viewData = this.viewElements.get(viewId);
        if (viewData) {
            this.currentView = viewData;
            this.emitViewChange(viewData);
        }
    }

    /**
     * Get view hierarchy for a specific view
     */
    getViewHierarchy(viewId) {
        const hierarchy = [];
        let current = viewId;

        while (current) {
            const viewData = this.viewElements.get(current);
            if (viewData) {
                hierarchy.unshift(viewData);
                current = viewData.parent;
            } else {
                break;
            }
        }

        return hierarchy;
    }

    /**
     * Find view containing a specific element
     */
    findViewContainingElement(element) {
        let current = element;
        
        while (current && current !== document.body) {
            const viewId = current.getAttribute('data-spa-view-id');
            if (viewId && this.viewElements.has(viewId)) {
                return this.viewElements.get(viewId);
            }
            current = current.parentElement;
        }
        
        return null;
    }

    /**
     * View lifecycle events
     */
    onViewEnter(viewInfo) {
        console.log(`🚀 View entered: ${viewInfo.name} (${viewInfo.id})`);
        this.setCurrentView(viewInfo.id);
    }

    onViewLeave(viewInfo) {
        console.log(`👋 View left: ${viewInfo.name} (${viewInfo.id})`);
    }

    /**
     * Emit view change event
     */
    emitViewChange(viewData) {
        const event = new CustomEvent('spa:view:changed', {
            detail: {
                view: viewData,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        this.debugMode = true;
        document.body.classList.add('debug-view-boundaries');
        
        // Add debug styles
        const style = document.createElement('style');
        style.textContent = `
            .debug-view-boundaries [data-spa-view] {
                border: 2px dashed #007cba !important;
                margin: 2px !important;
                position: relative !important;
            }
            
            .debug-view-boundaries [data-spa-view]::before {
                content: attr(data-spa-view-name) " (" attr(data-spa-view-id) ")" !important;
                position: absolute !important;
                top: -20px !important;
                left: 0 !important;
                font-size: 10px !important;
                color: white !important;
                background: #007cba !important;
                padding: 2px 6px !important;
                border-radius: 3px !important;
                opacity: 1 !important;
                z-index: 1000 !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugMode = false;
        document.body.classList.remove('debug-view-boundaries');
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            totalViews: this.viewElements.size,
            currentView: this.currentView?.info,
            viewTypes: this.getViewTypeStats(),
            hierarchy: this.getViewHierarchyStats()
        };
    }

    /**
     * Get view type statistics
     */
    getViewTypeStats() {
        const stats = {};
        this.viewElements.forEach((viewData) => {
            const type = viewData.info.type;
            stats[type] = (stats[type] || 0) + 1;
        });
        return stats;
    }

    /**
     * Get view hierarchy statistics
     */
    getViewHierarchyStats() {
        const stats = {
            rootViews: 0,
            nestedViews: 0,
            maxDepth: 0
        };

        this.viewElements.forEach((viewData) => {
            if (!viewData.parent) {
                stats.rootViews++;
            } else {
                stats.nestedViews++;
            }

            const depth = this.getViewHierarchy(viewData.info.id).length;
            stats.maxDepth = Math.max(stats.maxDepth, depth);
        });

        return stats;
    }

    /**
     * Export view data for debugging
     */
    exportViewData() {
        const data = {};
        this.viewElements.forEach((viewData, viewId) => {
            data[viewId] = {
                info: viewData.info,
                hasParent: !!viewData.parent,
                childrenCount: viewData.children.length,
                elementTag: viewData.element.tagName,
                elementClasses: viewData.element.className
            };
        });
        return data;
    }
}
