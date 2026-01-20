import { ReactiveComponent } from '../reactive/ReactiveComponent.js';

export default class ReactiveHelper {

    /**
     * Render Output Component (Thay thế renderOutputComponent)
     */
    static renderOutputComponent(controller, stateKeys = [], renderBlock = () => '') {
        const state = controller._internal.reactive;

        // Logic Virtual Rendering for SSR hydration sequencing or Dry Run
        if (controller.isVirtualRendering) {
            controller.isVirtualRendering = false; // Disable flag temporarily to scan
            let result = ReactiveHelper.renderOutputComponentScan(controller, stateKeys, renderBlock);
            controller.isVirtualRendering = true; // Restore flag
            if (result !== false) return result;
        }

        // Tạo instance ReactiveComponent
        const rc = new ReactiveComponent({
            stateKeys,
            renderBlock,
            controller: controller,
            App: controller.App,
            type: 'output',
            escapeHTML: false
        });

        // Store active component in new state structure
        state.ids.push(rc.id);
        state.components.set(rc.id, rc);

        return rc.render();
    }

    /**
     * Quét Output Component trong quá trình Virtual Render / SSR hydration
     */
    static renderOutputComponentScan(controller, stateKeys, renderBlock, escapeHTML = false) {
        const state = controller._internal.reactive;

        // Truy cập state.scanIndex thay vì this.reactiveComponentScanIndex
        let reactiveComponentIndex = state.scanIndex;

        // Check if config exists for this index
        if (!state.config || !state.config[reactiveComponentIndex]) {
            return false;
        }

        let reactiveComponentConfig = state.config[reactiveComponentIndex];

        const { id: renderID } = reactiveComponentConfig;

        const rc = new ReactiveComponent({
            renderID,
            stateKeys,
            renderBlock,
            controller: controller, // Pass controller explicitly
            App: controller.App,
            type: 'output',
            escapeHTML
        });

        state.ids.push(rc.id);
        state.components.set(rc.id, rc);
        state.scanIndex++; // Increment scan index

        return rc.render();
    }

    /**
     * Render Watch Component (Re-renders sections of DOM)
     */
    static renderWatchComponent(controller, stateKeys = [], renderBlock = () => '') {
        const state = controller._internal.reactive;

        // Virtual Rendering for Hydration/Dry-Run
        if (controller.isVirtualRendering) {
            controller.isVirtualRendering = false;
            let result = ReactiveHelper.renderWatchComponentScan(controller, stateKeys, renderBlock);
            controller.isVirtualRendering = true;
            if (result !== false) return result;
        }

        const rc = new ReactiveComponent({
            stateKeys,
            renderBlock,
            controller: controller,
            App: controller.App,
            type: 'watch',
            parentWatchComponent: state.parentWatch, // Access parent from global tracking or specific logic
            escapeHTML: false
        });

        state.ids.push(rc.id);
        state.components.set(rc.id, rc);

        // Update current rendering component tracking
        const previousRenderingComponent = controller._reactiveManager?.currentRenderingComponent; // Keep legacy prop for compatibility or move to state
        // We might want to move currentRenderingComponent to _internal later, but for now assuming legacy prop usage in ViewHierarchy

        return rc.render();
    }

    static renderWatchComponentScan(controller, stateKeys, renderBlock) {
        const state = controller._internal.reactive;

        let reactiveComponentIndex = state.scanIndex;
        if (!state.config || !state.config[reactiveComponentIndex]) {
            return false;
        }

        let reactiveComponentConfig = state.config[reactiveComponentIndex];
        const { id: renderID } = reactiveComponentConfig;

        const rc = new ReactiveComponent({
            renderID,
            stateKeys,
            renderBlock,
            controller: controller,
            App: controller.App,
            type: 'watch',
            escapeHTML: false
        });

        state.ids.push(rc.id);
        state.components.set(rc.id, rc);
        state.scanIndex++;

        return rc.render();
    }

    /**
     * Clear reactive state for refresh
     */
    static clearForRefresh(controller) {
        const state = controller._internal.reactive;
        if (state.components.size > 0) {
            state.components.forEach(c => c.destroy());
            state.components.clear();
        }
        state.ids = [];
        state.renderIDs = [];
        state.prerenderIDs = [];
        state.scanIndex = 0;
        state.followingIDs = [];
        state.followingRenderIDs = [];
        state.followingPrerenderIDs = [];
    }

    /**
     * Main Destroy method
     */
    static destroy(controller) {
        const state = controller._internal.reactive;

        if (state.components.size > 0) {
            state.components.forEach(c => {
                try {
                    c.destroy();
                } catch (e) { console.warn('Error destroying reactive component', e); }
            });
            state.components.clear();
        }

        state.ids = [];
        state.config = null;
    }
}
