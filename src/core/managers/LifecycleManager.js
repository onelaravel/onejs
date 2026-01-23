/**
 * LifecycleManager - Quản lý các lifecycle hooks của view
 * Xử lý created, mounted, updated, destroyed và các hooks liên quan
 * 
 * Tách từ ViewController.js để cải thiện khả năng bảo trì
 * @module core/managers/LifecycleManager
 * @author OneLaravel Team
 * @since 2025-12-29
 */

import logger from '../services/LoggerService.js';
import { devLog } from '../../helpers/devWarnings.js';

export class LifecycleManager {
    /**
     * @param {ViewController} controller - Parent controller instance
     */
    constructor(controller) {
        this.controller = controller;
        this.view = controller.view;
    }

    beforeCreate() {
        // logger.log(`🔵 beforeCreate: ${this.controller.path}`);
        // Lifecycle: Được gọi trước khi tạo view
        if (typeof this.view.beforeCreate === 'function') {
            this.view.beforeCreate();
        }
    }

    /**
     * Lifecycle: Được gọi khi view được tạo (trước lần render đầu tiên)
     */
    created() {
        // logger.log(`🟢 created: ${this.controller.path}`);
        if (typeof this.view.created === 'function') {
            this.view.created();
        }

        // Chèn styles trước khi render
        this.controller.insertStyles();
    }

    /**
     * Lifecycle: Được gọi trước khi view được cập nhật
     */
    beforeUpdate() {
        logger.log(`🟡 beforeUpdate: ${this.controller.path}`);
        if (typeof this.view.beforeUpdate === 'function') {
            this.view.beforeUpdate();
        }
    }

    /**
     * Lifecycle: Được gọi sau khi view được cập nhật
     */
    updated() {
        // logger.log(`🟠 updated: ${this.controller.path}`);
        if (typeof this.view.updated === 'function') {
            this.view.updated();
        }
    }

    /**
     * Lifecycle: Được gọi trước khi khởi tạo
     */
    beforeInit() {
        // logger.log(`🔷 beforeInit: ${this.controller.path}`);
        if (typeof this.view.beforeInit === 'function') {
            this.view.beforeInit();
        }
    }

    /**
     * Lifecycle: Được gọi trong quá trình khởi tạo
     */
    init() {
        // logger.log(`🔶 init: ${this.controller.path}`);
        if (typeof this.view.init === 'function') {
            this.view.init();
        }
    }

    /**
     * Lifecycle: Được gọi sau khi khởi tạo
     */
    afterInit() {
        // logger.log(`🔸 afterInit: ${this.controller.path}`);
        if (typeof this.view.afterInit === 'function') {
            this.view.afterInit();
        }
    }

    /**
     * Lifecycle: Được gọi trước khi view bị hủy
     */
    beforeDestroy() {
        // logger.log(`🔴 beforeDestroy: ${this.controller.path}`);
        if (typeof this.view.beforeDestroy === 'function') {
            this.view.beforeDestroy();
        }
    }

    /**
     * Lifecycle: Được gọi trong quá trình hủy
     */
    destroying() {
        // logger.log(`🟥 destroying: ${this.controller.path}`);
        if (typeof this.view.destroying === 'function') {
            this.view.destroying();
        }
    }

    /**
     * Lifecycle: Được gọi sau khi view bị hủy
     */
    destroyed() {
        // logger.log(`⬛ destroyed: ${this.controller.path}`);
        if (typeof this.view.destroyed === 'function') {
            this.view.destroyed();
        }
    }

    /**
     * Lifecycle: Được gọi trước khi view được mount
     */
    beforeMount() {
        // logger.log(`🟦 beforeMount: ${this.controller.path}`);
        if (typeof this.view.beforeMount === 'function') {
            this.view.beforeMount();
        }
    }

    /**
     * Lifecycle: Được gọi trong quá trình mounting
     */
    mounting() {
        // logger.log(`🟪 mounting: ${this.controller.path}`);
        if (typeof this.view.mounting === 'function') {
            this.view.mounting();
        }
    }

    /**
     * Lifecycle: Được gọi khi view được mount (sau khi DOM sẵn sàng)
     * Đây là nơi scripts được chèn và event listeners được khởi động
     */
    mounted() {
        const ctrl = this.controller;
        // logger.log(`🟩 mounted START: ${ctrl.path}`);
        ctrl.isDestroyed = false;

        if (!ctrl.isMarkupScanned) {
            ctrl.__scanDOMElements(ctrl.id);
            ctrl.isMarkupScanned = true;
        }

        if (!ctrl.isMounted) {
            this.beforeMount();

            try {
                this.mounting();

                // Chèn scripts sau khi DOM sẵn sàng
                ctrl.insertScripts();

                // Thông báo super view và children
                if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
                    ctrl.originalView.onSuperViewMounted();
                }

                // Thông báo children (controller.children được duy trì bởi ChildrenRegistry)
                if (ctrl.children && ctrl.children.length > 0) {
                    ctrl.children.forEach(childCtrl => {
                        if (childCtrl && childCtrl instanceof this.App.View.Controller) {
                            childCtrl.onParentMounted();
                        }
                    });
                }

                // Mount ReactiveComponents (output & watch thống nhất)
                if (ctrl._reactiveManager.reactiveComponents && ctrl._reactiveManager.reactiveComponents.size > 0) {
                    ctrl._reactiveManager.reactiveComponents.forEach(component => {
                        component.mounted();
                    });
                }

                // Khởi động event listeners
                this.start();

                ctrl.isMounted = true;
                ctrl.isReady = true;
                ctrl.isRendered = true;

                if (typeof ctrl.view.mounted === 'function') {
                    ctrl.view.mounted();
                }

                // logger.log(`✅ mounted COMPLETE: ${ctrl.path}`);

            } catch (error) {
                logger.warn('Error in mounted lifecycle hook:', error);
            }

            ctrl.states.__.readyToCommit = true;
        }

        ctrl.isReadyToStateChangeListen = true;
    }
    mountOriginalView() {
        const ctrl = this.controller;
        if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
            ctrl.originalView._lifecycleManager.mounted();
        }
    }

    /**
     * Lifecycle: Called before view is unmounted
     */
    beforeUnmount() {
        // logger.log(`🟨 beforeUnmount: ${this.controller.path}`);
        if (typeof this.view.beforeUnmount === 'function') {
            this.view.beforeUnmount();
        }
    }

    /**
     * Lifecycle: Called during unmounting
     */
    unmounting() {
        // logger.log(`🟧 unmounting: ${this.controller.path}`);
        if (typeof this.view.unmounting === 'function') {
            this.view.unmounting();
        }
    }

    /**
     * Lifecycle: Called when view is unmounted
     * This is where scripts are removed and event listeners are stopped
     */
    unmounted() {
        const ctrl = this.controller;
        // logger.log(`🔻 unmounted START: ${ctrl.path}`);

        if (ctrl.isMounted) {
            ctrl.isReadyToStateChangeListen = false;
            ctrl.states.__.readyToCommit = false;

            this.beforeUnmount();
            this.unmounting();

            // Remove scripts
            ctrl.removeScripts();

            // Stop event listeners
            this.stop();

            ctrl.isMounted = false;
        }

        // Notify super view and children
        if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
            ctrl.originalView.onSuperViewUnmounted();
        }

        if (ctrl.children && ctrl.children.length > 0) {
            ctrl.children.forEach(childCtrl => {
                if (childCtrl && childCtrl instanceof this.App.View.Controller) {
                    childCtrl.onParentUnmounted();
                }
            });
        }

        // Unmount ReactiveComponents (unified output & watch)
        if (ctrl._reactiveManager.reactiveComponents && ctrl._reactiveManager.reactiveComponents.size > 0) {
            ctrl._reactiveManager.reactiveComponents.forEach(component => {
                component.unmounted();
            });
        }

        if (typeof ctrl.view.unmounted === 'function') {
            ctrl.view.unmounted();
        }

        // logger.log(`✅ unmounted COMPLETE: ${ctrl.path}`);
    }

    unmountOriginalView() {
        const ctrl = this.controller;
        if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
            ctrl.originalView._lifecycleManager.unmounted();
        }
    }

    /**
     * Destroy view and cleanup resources
     */
    destroy() {
        const ctrl = this.controller;
        // logger.log(`💀 destroy START: ${ctrl.path}`);

        // Mark as destroyed to prevent processing after destroy
        ctrl.isDestroyed = true;
        this.beforeDestroy();
        this.destroying();

        // Save view path before cleanup (needed for removing styles from DOM)
        const viewPath = ctrl.path;

        // Reset pending flag to prevent processing after destroy
        ctrl._stateChangePending = false;

        // Clear state change collections
        if (ctrl.changedStateKeys) {
            ctrl.changedStateKeys.clear();
        }
        ctrl.changeStateQueueCount = 0;

        this.unmounted(); // Will call removeScripts()

        // Remove styles (will use fallback if styles array is empty)
        ctrl.removeStyles();

        // Final cleanup: Remove all styles with this view path from DOM
        // This ensures CSS is removed even if registry is out of sync
        if (viewPath) {
            ctrl.removeStylesByViewPath(viewPath);
        }

        if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
            ctrl.originalView._lifecycleManager.destroy();
        }

        // Destroy all children using ChildrenRegistry for proper cleanup
        if (ctrl._childrenRegistry) {
            ctrl._childrenRegistry.clear();
        } else {
            // Fallback: manual destroy if registry not available
            if (ctrl.children && ctrl.children.length > 0) {
                ctrl.children.forEach(childCtrl => {
                    if (childCtrl && childCtrl instanceof this.App.View.Controller) {
                        childCtrl._lifecycleManager.destroy();
                    }
                });
            }
        }

        ctrl._reactiveManager.destroy();
        if (ctrl.refElements && ctrl.refElements.length > 0) {
            ctrl.refElements.forEach(element => element.parentNode && element.parentNode.removeChild(element));
            ctrl.refElements = [];
        }

        this.destroyed();
        // logger.log(`☠️ destroy COMPLETE: ${ctrl.path}`);
    }

    destroyOriginalView() {
        const ctrl = this.controller;
        if (ctrl.originalView && ctrl.originalView instanceof this.App.View.Controller) {
            ctrl.originalView._lifecycleManager.destroy();
        }
    }

    start() {
        const ctrl = this.controller;
        if (ctrl.isStarted) {
            return;
        }
        // Khởi động event listeners
        ctrl._eventManager.startEventListener();
        ctrl._bindingManager.startBindingEventListener();
        ctrl._bindingManager.startClassBindingEventListener();
        ctrl.isStarted = true;
    }
    stop() {
        const ctrl = this.controller;
        if (!ctrl.isStarted) {
            return;
        }
        // Dừng event listeners
        ctrl._eventManager.stopEventListener();
        ctrl._bindingManager.stopBindingEventListener();
        ctrl._bindingManager.stopClassBindingEventListener();

        ctrl.isStarted = false;
    }

    /**
     * Lấy tham chiếu đến App từ controller
     */

    get App() {
        return this.controller.App;
    }
    set App(value) {
        devLog('LifecycleManager.App is read-only.');
    }

}
