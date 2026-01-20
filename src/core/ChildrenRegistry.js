/**
 * ChildrenRegistry - Centralized Children Management System
 * 
 * Replaces the complex 4-array tracking system (scanChildrenIDs, renewChildrenIDs, rcChildrenIDs, children)
 * with a unified Map-based registry for better:
 * - Memory management (automatic cleanup)
 * - Lifecycle coordination (smart mount/unmount)
 * - State synchronization (reactive data binding)
 * - Performance (efficient queries and diffs)
 * 
 * @see docs/dev/CHILDREN_VIEW_MANAGEMENT_ANALYSIS.md
 * @see docs/dev/CONTROLLER_VIEW_SEPARATION.md
 */

/**
 * ChildrenRegistry Class
 * 
 * Centralized management for all child views with:
 * - Map-based storage for O(1) lookups
 * - Automatic lifecycle management
 * - Reactive data binding support
 * - Memory leak prevention
 */
export class ChildrenRegistry {
    /**
     * @param {ViewController} controller - Parent controller
     */
    constructor(controller) {
        /** @type {ViewController} */
        this.controller = controller;
        
        /** @type {Map<string, Object>} Main registry: childId → ChildNode */
        this.registry = new Map();
        
        /** @type {Set<string>} Set of currently mounted child IDs */
        this.mountedChildren = new Set();
        
        /** @type {Map<string, Set<string>>} Reactive component → child IDs mapping */
        this.reactiveComponentChildren = new Map();
    }
    
    /**
     * Register a child view
     * 
     * Stores the controller internally and provides view access via getter.
     * Links child to parent reactive component if applicable.
     * 
     * @param {View} child - Child view instance (child.__ is ViewController)
     * @param {Object} options - Registration options
     * @param {Object} options.data - Initial data for child
     * @param {Object} options.parentReactiveComponent - Parent reactive component if applicable
     * @param {number} options.index - Child index
     * @returns {Object} ChildNode
     */
    register(child, options = {}) {
        const {
            data = {},
            parentReactiveComponent = null,
            index = this.registry.size
        } = options;
        
        const childCtrl = child.__;  // Get controller from view
        
        const childNode = {
            controller: childCtrl,
            get view() {
                return childCtrl.view;  // ✅ Fixed: return child controller's view
            },
            state: 'pending',
            lifecycle: {
                created: Date.now(),
                mounted: null,
                unmounted: null
            },
            scope: {
                name: childCtrl.view.path,
                id: childCtrl.view.id,
                index,
                data: this._createReactiveData(data),
                subscriptions: new Set()
            },
            parent: this.controller,
            parentReactiveComponent
        };
        
        this.registry.set(childCtrl.view.id, childNode);
        
        // Track in reactive component if applicable
        if (parentReactiveComponent) {
            if (!this.reactiveComponentChildren.has(parentReactiveComponent.id)) {
                this.reactiveComponentChildren.set(parentReactiveComponent.id, new Set());
            }
            this.reactiveComponentChildren.get(parentReactiveComponent.id).add(childCtrl.view.id);
        }
        
        // Link to main children array (backward compatibility)
        if (!this.controller.children.includes(childCtrl)) {
            this.controller.children.push(childCtrl);
        }
        
        return childNode;
    }
    
    /**
     * Create reactive data proxy for child scope
     * 
     * Wraps data in a Proxy to detect changes and notify children.
     * 
     * @param {Object} data - Initial data object
     * @returns {Object} Proxied data object
     */
    _createReactiveData(data) {
        return new Proxy(data, {
            set: (target, key, value) => {
                const oldValue = target[key];
                target[key] = value;
                
                // Notify child about data change
                if (oldValue !== value) {
                    this._notifyChildDataChange(key, value);
                }
                
                return true;
            }
        });
    }
    
    /**
     * Get child node by ID
     * 
     * @param {string} childId - Child view ID
     * @returns {Object|undefined} ChildNode or undefined
     */
    get(childId) {
        return this.registry.get(childId);
    }
    
    /**
     * Get all children for a reactive component
     * 
     * @param {string} reactiveComponentId - Reactive component ID
     * @returns {Array<Object>} Array of ChildNodes
     */
    getReactiveComponentChildren(reactiveComponentId) {
        const childIds = this.reactiveComponentChildren.get(reactiveComponentId);
        if (!childIds) return [];
        
        return Array.from(childIds)
            .map(id => this.registry.get(id))
            .filter(node => node !== undefined);
    }
    
    /**
     * Mark child as mounted
     * 
     * Updates state, timestamps, and calls child's mounted lifecycle hook.
     * 
     * @param {string} childId - Child view ID
     */
    mount(childId) {
        const childNode = this.registry.get(childId);
        if (!childNode) return;
        
        // Prevent double mounting
        if (childNode.state === 'mounted' || this.mountedChildren.has(childId)) {
            return;
        }
        
        childNode.state = 'mounted';
        childNode.lifecycle.mounted = Date.now();
        this.mountedChildren.add(childId);
        
        // Call child controller's mounted hook
        if (childNode.controller._lifecycleManager) {
            childNode.controller._lifecycleManager.mounted();
        }
    }
    
    /**
     * Unmount child
     * 
     * Updates state, timestamps, and calls child's unmounted lifecycle hook.
     * 
     * @param {string} childId - Child view ID
     */
    unmount(childId) {
        const childNode = this.registry.get(childId);
        if (!childNode) return;
        
        // Only unmount if currently mounted
        if (childNode.state !== 'mounted' && !this.mountedChildren.has(childId)) {
            return;
        }
        
        childNode.state = 'unmounted';
        childNode.lifecycle.unmounted = Date.now();
        this.mountedChildren.delete(childId);
        
        // Call child controller's unmounted hook
        if (childNode.controller._lifecycleManager) {
            childNode.controller._lifecycleManager.unmounted();
        }
    }
    
    /**
     * Unregister and destroy child
     * 
     * Performs complete cleanup:
     * 1. Unmounts if still mounted
     * 2. Clears subscriptions
     * 3. Removes from reactive component tracking
     * 4. Destroys child controller
     * 5. Removes from registry and main children array
     * 
     * @param {string} childId - Child view ID
     */
    destroy(childId) {
        const childNode = this.registry.get(childId);
        if (!childNode) return;
        
        // Unmount if still mounted
        if (this.mountedChildren.has(childId)) {
            this.unmount(childId);
        }
        
        // Clean up subscriptions
        childNode.scope.subscriptions.forEach(unsub => unsub());
        childNode.scope.subscriptions.clear();
        
        // Remove from reactive component tracking
        if (childNode.parentReactiveComponent) {
            const rcId = childNode.parentReactiveComponent.id;
            this.reactiveComponentChildren.get(rcId)?.delete(childId);
        }
        
        // Destroy child controller
        if (childNode.controller._lifecycleManager) {
            childNode.controller._lifecycleManager.destroy();
        }
        
        // Remove from registry
        this.registry.delete(childId);
        
        // Note: Removal from controller.children array is handled by ViewHierarchyManager.removeChild()
        // This keeps separation of concerns - ViewHierarchyManager manages the children array,
        // ChildrenRegistry only manages the registry Map and tracking Sets
    }
    
    /**
     * Find children that can be reused (by path)
     * 
     * Searches for unmounted children with matching path for reuse during
     * reactive component updates.
     * 
     * @param {string} path - View path to search for
     * @param {boolean} excludeMounted - Exclude mounted children from results
     * @returns {Array<{id: string, childNode: Object}>} Array of candidates
     */
    findReusable(path, excludeMounted = true) {
        const candidates = [];
        
        for (const [id, childNode] of this.registry) {
            if (childNode.controller.view.path === path) {
                if (excludeMounted && this.mountedChildren.has(id)) {
                    continue;
                }
                candidates.push({ id, childNode });
            }
        }
        
        return candidates;
    }
    
    /**
     * Clean up orphaned children
     * 
     * Destroys children that are not in the active IDs set and are unmounted.
     * Useful for cleaning up after reactive component updates.
     * 
     * @param {Array<string>} activeIds - Set of currently active child IDs
     * @returns {number} Number of children destroyed
     */
    cleanupOrphaned(activeIds) {
        const activeSet = new Set(activeIds);
        const toDestroy = [];
        
        for (const [id, childNode] of this.registry) {
            if (!activeSet.has(id) && childNode.state !== 'mounted') {
                toDestroy.push(id);
            }
        }
        
        toDestroy.forEach(id => this.destroy(id));
        
        return toDestroy.length;
    }
    
    /**
     * Get all child IDs (for backward compatibility)
     * 
     * @returns {Array<string>} Array of child IDs
     */
    getAllIds() {
        return Array.from(this.registry.keys());
    }
    
    /**
     * Update parent reactive component for a child
     * Used when a child is reused in a different reactive component
     * 
     * @param {string} childId - Child view ID
     * @param {Object} newParentRC - New parent reactive component
     */
    updateParentReactiveComponent(childId, newParentRC) {
        const childNode = this.registry.get(childId);
        if (!childNode) return;
        
        // Remove from old reactive component tracking
        if (childNode.parentReactiveComponent) {
            const oldRcId = childNode.parentReactiveComponent.id;
            this.reactiveComponentChildren.get(oldRcId)?.delete(childId);
            
            // Clean up empty set
            if (this.reactiveComponentChildren.get(oldRcId)?.size === 0) {
                this.reactiveComponentChildren.delete(oldRcId);
            }
        }
        
        // Update to new reactive component
        childNode.parentReactiveComponent = newParentRC;
        
        // Add to new reactive component tracking
        if (newParentRC) {
            if (!this.reactiveComponentChildren.has(newParentRC.id)) {
                this.reactiveComponentChildren.set(newParentRC.id, new Set());
            }
            this.reactiveComponentChildren.get(newParentRC.id).add(childId);
        }
    }
    
    /**
     * Get all mounted child IDs
     * 
     * @returns {Array<string>} Array of mounted child IDs
     */
    getMountedIds() {
        return Array.from(this.mountedChildren);
    }
    
    /**
     * Check if child is mounted
     * 
     * @param {string} childId - Child view ID
     * @returns {boolean} true if mounted
     */
    isMounted(childId) {
        return this.mountedChildren.has(childId);
    }
    
    /**
     * Get registry size
     * 
     * @returns {number} Number of registered children
     */
    get size() {
        return this.registry.size;
    }
    
    /**
     * Clear all children
     * 
     * Destroys all children and clears all tracking structures.
     */
    /**
     * Clear all children
     * 
     * Destroys all registered children and clears all tracking.
     */
    clear() {
        const allChildIds = Array.from(this.registry.keys());
        allChildIds.forEach(childId => {
            this.destroy(childId);
        });
        
        this.registry.clear();
        this.mountedChildren.clear();
        this.reactiveComponentChildren.clear();
        
        // Clear children array (ViewHierarchyManager's responsibility, but clear() is special case)
        if (this.controller.children) {
            this.controller.children = [];
        }
    }
    
    /**
     * Notify child about parent data change
     * 
     * Called when reactive data in child scope changes.
     * Children can subscribe to these changes for automatic updates.
     * 
     * @param {string} key - Data key that changed
     * @param {any} value - New value
     * @private
     */
    _notifyChildDataChange(key, value) {
        // Implementation depends on child's subscription mechanism
        // This is a placeholder for future reactive binding features
        // Currently, subscriptions are managed manually via scope.subscriptions
    }
}
