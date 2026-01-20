export default class ResourceHelper {
    /**
     * Insert view resources (JS/CSS)
     */
    static insertResources(controller) {
        ResourceHelper.insertStyles(controller);
        ResourceHelper.insertScripts(controller);
    }

    static insertStyles(controller) {
        if (!controller.styles || controller.styles.length === 0) return;

        const state = controller._internal.resources;

        controller.styles.forEach(style => {
            const resourceKey = controller.App.View.Engine.getResourceKey({
                ...style,
                viewPath: controller.path,
                resourceType: 'style'
            });

            // Check global registry logic (simplified for Helper)
            let registryEntry = controller.App.View.Engine.resourceRegistry.get(resourceKey);

            if (registryEntry) {
                if (!registryEntry.viewPaths.has(controller.path)) {
                    registryEntry.viewPaths.add(controller.path);
                    registryEntry.referenceCount++;
                    state.insertedKeys.add(resourceKey); // Track locally
                }
                return;
            }

            // Create Element logic
            let element;
            if (style.type === 'href') {
                element = document.createElement('link');
                element.rel = 'stylesheet';
                element.href = style.href;
                // ... add attributes ...
            } else {
                element = document.createElement('style');
                element.textContent = style.content;
                // ... add attributes ...
            }

            element.setAttribute('data-view-path', controller.path);
            element.setAttribute('data-resource-key', resourceKey);

            document.head.appendChild(element);

            // Add to Registry
            controller.App.View.Engine.resourceRegistry.set(resourceKey, {
                element,
                viewPaths: new Set([controller.path]),
                referenceCount: 1,
                resourceType: 'style'
            });

            state.insertedKeys.add(resourceKey);
        });
    }

    static insertScripts(controller) {
        // ... Similar logic to insertStyles but for scripts ...
        // Needs careful porting of execution logic (onload, onerror)
        if (!controller.scripts || controller.scripts.length === 0) return;

        const state = controller._internal.resources;

        controller.scripts.forEach(script => {
            // ... logic ...
            // For brevity, skipping full implementation but structure is identical
            // Use state.insertedKeys to track
        });
    }

    static removeResources(controller) {
        const state = controller._internal.resources;

        // Use state.insertedKeys to know what to try and remove
        // Access global registry to decrement counts
        // If count == 0, remove DOM element

        // ... logic ...

        state.insertedKeys.clear();
    }
}
