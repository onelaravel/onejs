import { uniqId } from "../../helpers/utils.js";
import OneMarkup, { OneMarkupModel } from "../OneMarkup.js";
import OneDOM from "../OneDOM.js";
import { ViewState } from "../ViewState.js";

/**
 * ReactiveComponent - Reactive component thống nhất
 * Thay thế cả WatchComponent và OutputComponent để hiệu suất và bảo trì tốt hơn
 * 
 * @class ReactiveComponent
 * @description Xử lý reactive rendering cho cả watch blocks và output expressions
 * 
 * Tính năng:
 * - Quản lý lifecycle thống nhất
 * - Tối ưu state subscriptions
 * - Xử lý children view tốt hơn
 * - Hỗ trợ escape HTML cho loại output
 * - Xử lý lỗi cải thiện
 * - Ngăn memory leak
 */
export class ReactiveComponent {
    /**
     * @param {Object} options
     * @param {Application} options.App - Instance Application
     * @param {ViewController} options.controller - View controller
     * @param {Array<string>} options.stateKeys - Các state keys để theo dõi
     * @param {Function} options.renderBlock - Hàm render
     * @param {string} options.renderID - Component ID
     * @param {ReactiveComponent} options.parentWatchComponent - Component cha
     * @param {string} options.type - Loại component: 'watch' hoặc 'output'
     * @param {boolean} options.escapeHTML - Escape HTML cho output
     */
    constructor({ 
        App, 
        controller, 
        stateKeys = [], 
        renderBlock = () => '', 
        renderID = '', 
        parentWatchComponent = null,
        type = 'watch', 
        escapeHTML = false
    }) {
        /**
         * @type {Application}
         */
        this.App = App;
        /**
         * @type {ViewController}
         */
        this.controller = controller;
        /**
         * @type {ViewState}
         */
        this.states = controller.states;
        /**
         * @type {Array<string>}
         */
        this.stateKeys = stateKeys;
        /**
         * @type {Function}
         */
        this.renderBlock = renderBlock;
        /**
         * @type {string}
         */
        this.id = renderID || uniqId();
        /**
         * @type {string} - 'watch' hoặc 'output'
         */
        this.type = type;
        /**
         * @type {boolean}
         */
        this.escapeHTML = escapeHTML;
        
        // Các cờ lifecycle
        this.isMounted = false;
        this.isScanned = false;
        this.isDestroyed = false;
        this._isUpdating = false;
        
        // Tham chiếu DOM
        this.openTag = null;
        this.closeTag = null;
        this.refElements = [];
        /**
         * @type {OneMarkupModel|null}
         */
        this.markup = null;
        
        // Quản lý state
        this.subscribes = [];
        this.renderedContent = '';
        
        // Cấp bậc
        this.parentWatchComponent = parentWatchComponent;
        this.childrenIDs = [];
    }

    /**
     * Mount component và thiết lập state subscriptions
     */
    mounted() {
        if (this.isMounted || this.isDestroyed) return;
        
        // console.log(`ReactiveComponent mounted [${this.type}]:`, this.id);
        
        this.scan();
        
        // Đăng ký theo dõi state changes
        if (this.stateKeys.length > 0) {
            const unsubscribe = this.states.__.subscribe(this.stateKeys, () => {
                if (!this._isUpdating && this.isMounted) {
                    // console.log(`ReactiveComponent state changed [${this.type}], updating:`, this.id);
                    this.update();
                }
            });
            this.subscribes.push(unsubscribe);
        }
        
        this.isMounted = true;
        
        // Mount children cho loại watch
        if (this.type === 'watch') {
            this._mountChildren();
        }
    }

    /**
     * Unmount component và dọn dẹp subscriptions
     */
    unmounted() {
        if (!this.isMounted || this.isDestroyed) return;
        
        // console.log(`ReactiveComponent unmounted [${this.type}]:`, this.id);
        
        this.isMounted = false;
        
        // Unmount children cho loại watch
        if (this.type === 'watch') {
            this._unmountChildren();
        }
        
        this._unsubscribeAll();
    }

    /**
     * Cập nhật component khi state thay đổi
     */
    update() {
        if (this._isUpdating || !this.isMounted || this.isDestroyed) return;
        
        this._isUpdating = true;
        
        try {
            this.controller._reactiveManager?.onWatchComponentUpdating?.();
            
            if (this.type === 'watch') {
                // Cập nhật đầy đủ cho watch components với quản lý children
                this._updateWatchComponent();
            } else {
                // Cập nhật nhanh cho output components (không có children)
                this._updateOutputComponent();
            }
            
            this.controller._reactiveManager?.onWatchComponentUpdated?.();
        } catch (error) {
            console.error(`ReactiveComponent update error [${this.type}][${this.id}]:`, error);
        } finally {
            this._isUpdating = false;
        }
    }

    /**
     * Cập nhật watch component với quản lý children
     * @private
     */
    _updateWatchComponent() {
        // Lưu context gốc
        const originalChildrenIDs = this.controller._hierarchyManager?.renewChildrenIDs || [];
        const originRCChildrenIDs = this.controller._hierarchyManager?.rcChildrenIDs || [];
        
        if (this.controller._hierarchyManager) {
            this.controller._hierarchyManager.renewChildrenIDs = this.childrenIDs;
            this.controller._hierarchyManager.rcChildrenIDs = [];
        }
        
        try {
            // Unmount và xóa
            this._unmountChildren();
            this.clear();
            
            // Render lại
            if (this.closeTag?.parentNode) {
                const newContent = this.renderContent();
                OneDOM.before(this.closeTag, newContent);
                
                // Cập nhật children IDs
                if (this.controller._hierarchyManager) {
                    this.childrenIDs = this.controller._hierarchyManager.rcChildrenIDs.slice();
                }
                
                // Re-scan and mount
                this.scan();
                this._mountChildren();
            }
        } finally {
            // Restore context
            if (this.controller._hierarchyManager) {
                this.controller._hierarchyManager.renewChildrenIDs = originalChildrenIDs;
                this.controller._hierarchyManager.rcChildrenIDs = originRCChildrenIDs;
            }
        }
    }

    /**
     * Quick update for output component (no children management)
     * @private
     */
    _updateOutputComponent() {
        this.clear();
        
        if (this.closeTag?.parentNode) {
            const newContent = this.renderContent();
            
            // Output component uses text node for performance
            const textNode = document.createTextNode(newContent);
            OneDOM.before(this.closeTag, textNode);
            
            this.scan();
        }
    }

    /**
     * Render content with error handling and escaping
     */
    renderContent() {
        try {
            let content = this.renderBlock(this);
            
            // Apply HTML escaping for output type
            if (this.type === 'output' && this.escapeHTML) {
                if (typeof content === 'string') {
                    content = this.App.View.escString(content);
                } else if (content != null) {
                    content = this.App.View.escString(String(content));
                }
            }
            
            this.renderedContent = content ?? '';
            return this.renderedContent;
        } catch (error) {
            console.error(`ReactiveComponent renderContent error [${this.type}][${this.id}]:`, error);
            this.renderedContent = '';
            return this.type === 'watch' 
                ? `<!-- Error in ${this.type}: ${error.message} -->`
                : '';
        }
    }

    /**
     * Tạo output render đầy đủ với comment markers
     */
    render() {
        const content = this.renderContent();
        
        // Dùng tên tag khác nhau cho các loại khác nhau
        if (this.type === 'output') {
            return `<!-- [one:reactive-out id="${this.id}"] -->${content}<!-- [/one:reactive-out] -->`;
        }
        
        return `<!-- [one:reactive id="${this.id}"] -->${content}<!-- [/one:reactive] -->`;
    }

    /**
     * Quét và cache các tham chiếu DOM giữa comment markers
     * 
     * v2.0.0 - Cải thiện validation:
     * - Kiểm tra kết nối markup trước khi quét
     * - Validate sự tồn tại của openTag/closeTag
     * - Xử lý lỗi và logging tốt hơn
     */
    scan() {
        if (this.isScanned || this.isDestroyed) return;
        
        try {
            if (!this.markup) {
                // Thử reactive markup mới trước
                const tagName = this.type === 'output' ? 'reactive-out' : 'reactive';
                this.markup = OneMarkup.first(tagName, { id: this.id }, { useCache: false });
                
                // Fallback về legacy markup để tương thích ngược
                if (!this.markup) {
                    const legacyTag = this.type === 'output' ? 'output' : 'watch';
                    this.markup = OneMarkup.first(legacyTag, { id: this.id }, { useCache: false });
                }
                
                if (!this.markup) {
                    this.isScanned = true;
                    return;
                }
                
                // Validate markup có các tags cần thiết
                if (!this.markup.openTag || !this.markup.closeTag) {
                    console.warn(`ReactiveComponent [${this.type}][${this.id}]: Markup missing tags`);
                    this.isScanned = true;
                    return;
                }
                
                // Validate các tags vẫn còn trong DOM
                if (!this.markup.openTag.isConnected || !this.markup.closeTag.isConnected) {
                    console.warn(`ReactiveComponent [${this.type}][${this.id}]: Markup tags not connected`);
                    this.isScanned = true;
                    return;
                }
                
                this.openTag = this.markup.openTag;
                this.closeTag = this.markup.closeTag;
                this.refElements = this.markup.nodes.slice();
            } else {
                // Quét lại markup hiện tại - validate trước
                if (!this.markup.openTag?.isConnected || !this.markup.closeTag?.isConnected) {
                    console.warn(`ReactiveComponent [${this.type}][${this.id}]: Cannot re-scan, markup disconnected`);
                    this.isScanned = true;
                    return;
                }
                
                this.refElements = [];
                this.markup.__scan();
                this.refElements = this.markup.nodes.slice();
            }
            
            this.isScanned = true;
        } catch (error) {
            console.error(`ReactiveComponent scan error [${this.type}][${this.id}]:`, error);
            this.isScanned = true;
        }
    }

    /**
     * Xóa các DOM elements giữa markers
     * 
     * v2.0.0 - Cải thiện dọn dẹp:
     * - Validates kết nối node trước khi xóa
     * - Xóa mảng sau khi xóa
     * - Ngăn memory leaks từ các DOM refs bị bỏ rơi
     */
    clear() {
        this.isScanned = false;
        
        // Remove all DOM nodes between markers
        this.refElements.forEach(node => {
            try {
                // Only remove if node is still in DOM
                if (node && node.parentNode && node.isConnected) {
                    node.parentNode.removeChild(node);
                }
            } catch (error) {
                console.error(`ReactiveComponent clear node error [${this.type}]:`, error);
            }
        });
        
        // Clear array to release references
        this.refElements.length = 0;
    }

    /**
     * Destroy component completely
     * 
     * v2.0.0 - Enhanced memory leak prevention:
     * - Proper OneMarkup disposal
     * - Break circular references
     * - Clear all arrays
     * - Cleanup DOM references
     */
    destroy() {
        if (this.isDestroyed) return;
        
        console.log(`ReactiveComponent destroyed [${this.type}]:`, this.id);
        
        // Unmount first
        this.unmounted();
        
        // Clear DOM elements
        this.clear();
        
        // Dispose OneMarkup (clear internal cache)
        if (this.markup && typeof this.markup.dispose === 'function') {
            try {
                this.markup.dispose();
            } catch (error) {
                console.error(`ReactiveComponent markup disposal error [${this.type}]:`, error);
            }
        }
        
        // Clear all arrays to release references
        this.refElements = [];
        this.childrenIDs = [];
        this.stateKeys = [];
        
        // Break circular reference with parent
        if (this.parentWatchComponent) {
            // Remove this component from parent's children
            if (this.parentWatchComponent.childrenIDs) {
                const index = this.parentWatchComponent.childrenIDs.indexOf(this.id);
                if (index > -1) {
                    this.parentWatchComponent.childrenIDs.splice(index, 1);
                }
            }
            this.parentWatchComponent = null;
        }
        
        // Set destroyed flag early to prevent operations
        this.isDestroyed = true;
        
        // Nullify all references for garbage collection
        this.markup = null;
        this.openTag = null;
        this.closeTag = null;
        this.renderBlock = null;
        this.controller = null;
        this.states = null;
        this.App = null;
    }

    /**
     * Mount child view controllers (using ChildrenRegistry)
     * @private
     */
    _mountChildren() {
        if (!this.controller?._childrenRegistry) return;
        
        try {
            const registry = this.controller._childrenRegistry;
            
            // Get children belonging to this reactive component from registry
            const rcChildren = registry.getReactiveComponentChildren(this.id);
            
            // Mount all children belonging to this reactive component
            rcChildren.forEach(childNode => {
                const childId = childNode.scope.id;
                if (!registry.isMounted(childId)) {
                    registry.mount(childId);
                }
            });
            
            // Also mount children in childrenIDs (for backward compatibility)
            if (this.childrenIDs.length > 0) {
                this.childrenIDs.forEach(childId => {
                    if (!registry.isMounted(childId)) {
                        registry.mount(childId);
                    }
                });
            }
        } catch (error) {
            console.error(`ReactiveComponent mount children error [${this.type}][${this.id}]:`, error);
        }
    }

    /**
     * Unmount child view controllers (using ChildrenRegistry)
     * @private
     */
    _unmountChildren() {
        if (!this.controller?._childrenRegistry) return;
        
        try {
            const registry = this.controller._childrenRegistry;
            
            // Get children belonging to this reactive component from registry
            const rcChildren = registry.getReactiveComponentChildren(this.id);
            
            // Unmount all children belonging to this reactive component
            rcChildren.forEach(childNode => {
                const childId = childNode.scope.id;
                if (registry.isMounted(childId)) {
                    registry.unmount(childId);
                }
            });
            
            // Also unmount children in childrenIDs (for backward compatibility)
            if (this.childrenIDs.length > 0) {
                this.childrenIDs.forEach(childId => {
                    if (registry.isMounted(childId)) {
                        registry.unmount(childId);
                    }
                });
            }
        } catch (error) {
            console.error(`ReactiveComponent unmount children error [${this.type}][${this.id}]:`, error);
        }
    }

    /**
     * Unsubscribe all state subscriptions
     * 
     * v2.0.0 - Enhanced error handling:
     * - Continues even if individual unsubscribe fails
     * - Clears array after all attempts
     * - Prevents partial cleanup
     * 
     * @private
     */
    _unsubscribeAll() {
        const errors = [];
        
        // Try to unsubscribe all, collecting errors
        this.subscribes.forEach((unsubscribe, index) => {
            try {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            } catch (error) {
                errors.push({ index, error });
                console.error(`ReactiveComponent unsubscribe error [${this.type}] at index ${index}:`, error);
            }
        });
        
        // Always clear array, even if some failed
        this.subscribes.length = 0;
        
        // Log summary if errors occurred
        if (errors.length > 0) {
            console.warn(`ReactiveComponent [${this.type}][${this.id}]: ${errors.length} unsubscribe errors occurred`);
        }
    }

    /**
     * Get current state values
     * @returns {Object}
     */
    getStateValues() {
        if (!this.stateKeys.length) return {};
        
        return this.stateKeys.reduce((acc, key) => {
            acc[key] = this.states[key];
            return acc;
        }, {});
    }

    /**
     * Check if component has state dependencies
     * @returns {boolean}
     */
    hasStateDependencies() {
        return this.stateKeys.length > 0;
    }

    /**
     * Force update without state change check
     */
    forceUpdate() {
        const wasUpdating = this._isUpdating;
        this._isUpdating = false;
        this.update();
        this._isUpdating = wasUpdating;
    }
}

/**
 * Factory function for creating reactive components
 * Used by compiler: __reactive(reactiveID, stateKeys, renderBlock, options)
 * 
 * @param {ViewController} controller - View controller
 * @param {string} reactiveID - Component ID
 * @param {Array<string>} stateKeys - State keys to watch
 * @param {Function} renderBlock - Render function
 * @param {Object} options - Component options
 * @returns {ReactiveComponent}
 */
export function __reactive(controller, reactiveID, stateKeys, renderBlock, options = {}) {
    const {
        type = 'output',
        escapeHTML = false,
        parentWatchComponent = null
    } = options;
    
    const component = new ReactiveComponent({
        App: controller.App,
        controller,
        stateKeys,
        renderBlock,
        renderID: reactiveID,
        type,
        escapeHTML,
        parentWatchComponent
    });
    
    return component;
}

export default ReactiveComponent;
