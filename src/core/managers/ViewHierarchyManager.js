/**
 * ViewHierarchyManager - Manages view relationships and hierarchy
 * 
 * Responsibilities:
 * - Manage parent-child relationships
 * - Handle super view (layout inheritance)
 * - Manage original view references
 * - Create and configure child/super views
 * 
 * Extracted from ViewController.js (Phase 9) to reduce complexity
 * @author GitHub Copilot
 * @date 2025-12-29
 */

export class ViewHierarchyManager {
    /**
     * @param {ViewController} controller - Parent controller instance
     */
    constructor(controller) {
        this.controller = controller;
        this.scanChildrenIDs = [];

        this.renewChildrenIDs = [];

        this.rcChildrenIDs = [];
        
    }

    /**
     * Set super view (layout)
     * @param {View} superView - Super view instance
     * @returns {ViewController} Controller instance for chaining
     */
    setSuperView(superView) {
        this.controller.superView = superView.__;
        return this.controller;
    }

    /**
     * Set parent view
     * @param {View} parent - Parent view instance
     * @returns {ViewController} Controller instance for chaining
     */
    setParent(parent) {
        this.controller.parent = parent.__;
        return this.controller;
    }

    /**
     * Set original view (for extended views)
     * @param {View} originalView - Original view instance
     * @returns {ViewController} Controller instance for chaining
     */
    setOriginalView(originalView) {
        this.controller.originalView = originalView.__;
        this.controller.originalViewPath = originalView.path;
        this.controller.originalViewId = originalView.id;
        return this.controller;
    }

    /**
     * Add child view
     * Creates scope object and registers child in ChildrenRegistry
     * 
     * @param {View} child - Child view to add
     * @param {Object} data - Data to add to the child view
     * @returns {ViewController} Controller instance for chaining
     */
    addChild(child, data = {}) {
        // Get parent reactive component if in render context
        const parentRC = this.controller._reactiveManager?.currentRenderingComponent;
        
        // Register in ChildrenRegistry (handles controller storage and scope)
        const registry = this.controller._childrenRegistry;
        
        // Get correct index BEFORE register() pushes to array
        // Add defensive check for children array
        if (!this.controller.children) {
            console.error('ViewHierarchyManager.addChild: this.controller.children is undefined/null', {
                controller: this.controller,
                child: child,
                viewPath: this.controller?.path
            });
            this.controller.children = [];
        }
        const currentIndex = this.controller.children.length;
        
        registry.register(child, {
            data,
            parentReactiveComponent: parentRC,
            index: currentIndex  // ✅ Fixed: calculate index before push
        });
        
        return this.controller;
    }

    /**
     * Remove child view
     * Removes from registry and children array
     * 
     * @param {View} child - Child view to remove
     * @returns {ViewController} Controller instance for chaining
     */
    removeChild(child) {
        const childController = child.__;
        const childId = child.id;
        
        // Remove from registry (handles cleanup of registry, mounted state, RC tracking)
        const registry = this.controller._childrenRegistry;
        if (registry) {
            registry.destroy(childId);
        }
        
        // Remove from children array (ViewHierarchyManager's responsibility)
        if (!this.controller.children) {
            this.controller.children = [];
        }
        this.controller.children = this.controller.children.filter(c => c !== childController);
        
        return this.controller;
    }

    /**
     * Reset original view (destroy it)
     */
    resetOriginalView() {
        if (this.controller.originalView && this.controller.originalView instanceof ViewController) {
            this.controller.originalView.destroy();
        }
    }

    /**
     * Eject original view (clear references)
     */
    ejectOriginalView() {
        if (this.controller.originalView && this.controller.originalView instanceof ViewController) {
            this.controller.originalView = null;
            this.controller.originalViewId = null;
            this.controller.originalViewPath = null;
        }
    }

    /**
     * Remove this view and all children
     * @returns {ViewController} Controller instance for chaining
     */
    remove() {
        this.controller.master?.__?.removeChild(this.controller.view);
        
        // Add defensive check before forEach
        if (this.controller.children && Array.isArray(this.controller.children)) {
            this.controller.children.forEach(childCtrl => childCtrl.remove());
        }
        
        this.controller.master = null;
        this.controller.children = [];
        return this.controller;
    }

    /**
     * Create super view (layout inheritance)
     * Called by __extends template helper
     * 
     * @param {string} path - Super view path
     * @param {Object} data - Data to pass to super view
     * @returns {View|null} Super view instance
     */
    createSuperView(path, data = {}) {
        const originData = this.controller.data ? this.controller.data : {};
        if (originData.__SSR_VIEW_ID__) {
            originData.__SSR_VIEW_ID__ = null;
            delete originData.__SSR_VIEW_ID__;
        }

        const viewInstance = this.controller.App.View.extendView(path, { ...originData, ...data });
        if (!viewInstance) {
            return null;
        }

        this.controller.superViewPath = path;
        this.setSuperView(viewInstance);
        viewInstance.__.setOriginalView(this.controller.view);
        viewInstance.__.viewType = 'layout';
        return viewInstance;
    }

    /**
     * Create child view (include)
     * Called by $include helper
     * Uses ChildrenRegistry for intelligent reuse and cleanup
     * 
     * @param {string} path - Child view path
     * @param {Object} data - Data to pass to child view
     * @returns {View|null} Child view instance
     */
    createChildView(path, data = {}) {
        const registry = this.controller._childrenRegistry;
        
        // 1. Try to find reusable child from renewChildrenIDs
        if (this.renewChildrenIDs.length) {
            let childCtrl = this.controller.children.find(c => 
                c.view.name == path && this.renewChildrenIDs.includes(c.view.id)
            );
            
            if (childCtrl) {
                const view = childCtrl.view;
                
                // Update child in registry (refresh data and parentReactiveComponent)
                const childNode = registry.get(view.id);
                if (childNode) {
                    Object.assign(childNode.scope.data, data);
                    
                    // Update parentReactiveComponent for reused child
                    const currentRC = this.controller._reactiveManager?.currentRenderingComponent;
                    if (currentRC && childNode.parentReactiveComponent !== currentRC) {
                        registry.updateParentReactiveComponent(view.id, currentRC);
                    }
                }
                
                // Mark as needing refresh
                view.__._templateManager.wrapperConfig.enable = true;
                view.__.isScanned = false;
                view.__.isFirstClientRendering = true;
                view.__.updateVariableData(data);
                
                this.rcChildrenIDs.push(childCtrl.view.id);
                return view;
            }
        }

        // 2. Create new child
        const parentData = this.controller.data ? this.controller.data : {};
        if (parentData.__SSR_VIEW_ID__) {
            parentData.__SSR_VIEW_ID__ = null;
            delete parentData.__SSR_VIEW_ID__;
        }

        const viewInstance = this.controller.App.View.include(path, { ...parentData, ...data });
        if (!viewInstance) {
            return null;
        }

        // 3. Setup for rendering
        viewInstance.__._templateManager.wrapperConfig.enable = true;
        viewInstance.__.isScanned = false;
        viewInstance.__.isFirstClientRendering = true;
        viewInstance.__.setParent(this.controller.view);
        
        // 4. Register child (uses ChildrenRegistry)
        this.addChild(viewInstance, data);

        viewInstance.__.viewType = 'template';
        this.scanChildrenIDs.push(viewInstance.id);
        this.rcChildrenIDs.push(viewInstance.id);
        
        return viewInstance;
    }
}
