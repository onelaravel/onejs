/**
 * ResourceManager - Manages view resources (styles and scripts)
 * Handles insertion, removal, and reference counting
 * 
 * Extracted from ViewController.js to improve maintainability
 * @author GitHub Copilot
 * @date 2025-12-29
 */

import logger from '../services/LoggerService.js';

export class ResourceManager {
    /**
     * @param {ViewController} controller - Parent controller instance
     */
    constructor(controller) {
        this.controller = controller;
        this.path = controller.path;
    }

    updateController(newController) {
        this.controller = newController;
        this.path = newController.path;
    }

    /**
     * Insert all resources (styles + scripts)
     */
    insertResources() {
        this.insertStyles();
        this.insertScripts();
    }

    /**
     * Remove all resources
     */
    removeResources() {
        this.removeStyles();
        this.removeScripts();
    }

    /**
     * Insert styles into DOM with reference counting
     * Extracted from ViewController.js line 428
     */
    insertStyles() {
        if (!this.controller.styles || this.controller.styles.length === 0) {
            return;
        }

        this.controller.styles.forEach(style => {
            const resourceKey = this.controller.App.View.Engine.getResourceKey({
                ...style,
                viewPath: this.path,
                resourceType: 'style'
            });

            // Check if already in registry
            let registryEntry = this.controller.App.View.Engine.resourceRegistry.get(resourceKey);

            if (registryEntry) {
                // Resource already exists - just add this view path to registry
                registryEntry.viewPaths.add(this.path);
                registryEntry.referenceCount++;
                this.controller.insertedResourceKeys.add(resourceKey);
                return; // Don't insert again
            }

            // Create and insert new style element
            let element;

            if (style.type === 'href') {
                // External stylesheet
                element = document.createElement('link');
                element.rel = 'stylesheet';
                element.href = style.href;

                // Add attributes
                if (style.attributes) {
                    Object.entries(style.attributes).forEach(([key, value]) => {
                        if (value === true) {
                            element.setAttribute(key, '');
                        } else {
                            element.setAttribute(key, value);
                        }
                    });
                }

                if (style.id) {
                    element.id = style.id;
                }

                element.setAttribute('data-view-path', this.path);
                element.setAttribute('data-resource-key', resourceKey);

                document.head.appendChild(element);

            } else if (style.type === 'code') {
                // Inline CSS
                element = document.createElement('style');
                element.textContent = style.content;

                if (style.id) {
                    element.id = style.id;
                }

                if (style.attributes) {
                    Object.entries(style.attributes).forEach(([key, value]) => {
                        if (key !== 'id' && key !== 'type') {
                            if (value === true) {
                                element.setAttribute(key, '');
                            } else {
                                element.setAttribute(key, value);
                            }
                        }
                    });
                }

                element.setAttribute('data-view-path', this.path);
                element.setAttribute('data-resource-key', resourceKey);

                document.head.appendChild(element);
            }

            // Register in global registry
            this.controller.App.View.Engine.resourceRegistry.set(resourceKey, {
                element: element,
                viewPaths: new Set([this.path]),
                referenceCount: 1,
                resourceType: 'style'
            });

            this.controller.insertedResourceKeys.add(resourceKey);
        });
    }

    /**
     * Insert scripts into DOM with reference counting
     * Extracted from ViewController.js line 523
     */
    insertScripts() {
        if (!this.controller.scripts || this.controller.scripts.length === 0) {
            return;
        }

        this.controller.scripts.forEach(script => {
            const resourceKey = this.controller.App.View.Engine.getResourceKey({
                ...script,
                viewPath: this.path,
                resourceType: 'script'
            });

            // Check if already in registry
            let registryEntry = this.controller.App.View.Engine.resourceRegistry.get(resourceKey);

            if (registryEntry) {
                // Resource already exists - just add this view path to registry
                registryEntry.viewPaths.add(this.path);
                registryEntry.referenceCount++;
                this.controller.insertedResourceKeys.add(resourceKey);

                // If script already loaded, call onload callback (only for external scripts with element)
                if (script.onload && registryEntry.element && registryEntry.element.readyState === 'complete') {
                    try {
                        script.onload();
                    } catch (error) {
                        logger.warn(`ResourceManager.insertScripts: Error calling onload for ${resourceKey}:`, error);
                    }
                }

                // For function wrappers, don't execute again (already executed)
                if (script.function && registryEntry.executed) {
                    return; // Function already executed, just tracking reference
                }

                return; // Don't insert again
            }

            // Create and insert new script element
            let element;

            if (script.type === 'src') {
                // External script
                element = document.createElement('script');
                element.src = script.src;
                element.type = script.attributes?.type || 'text/javascript';

                // Add attributes
                if (script.attributes) {
                    Object.entries(script.attributes).forEach(([key, value]) => {
                        if (key === 'async' || key === 'defer') {
                            element[key] = value === true || value === 'true';
                        } else if (value === true) {
                            element.setAttribute(key, '');
                        } else {
                            element.setAttribute(key, value);
                        }
                    });
                }

                if (script.id) {
                    element.id = script.id;
                }

                element.setAttribute('data-view-path', this.path);
                element.setAttribute('data-resource-key', resourceKey);

                // Handle onload/onerror
                if (script.onload) {
                    element.onload = script.onload;
                }
                if (script.onerror) {
                    element.onerror = script.onerror;
                }

                document.body.appendChild(element);

            } else if (script.type === 'code') {
                // Inline script - Use registered script function if available
                if (script.function) {
                    // Get script from ViewEngine.scripts registry
                    const scriptCallback = this.controller.App.View.Engine.getScript(this.path, script.function);

                    if (scriptCallback && typeof scriptCallback === 'function') {
                        // Function wrapper: Execute only once, track in registry
                        try {
                            scriptCallback.call(this.controller);

                            // Register in global registry with executed flag
                            this.controller.App.View.Engine.resourceRegistry.set(resourceKey, {
                                element: null, // No DOM element for function wrapper
                                viewPaths: new Set([this.path]),
                                referenceCount: 1,
                                resourceType: 'script',
                                executed: true, // Mark as executed - ensures single execution
                                functionName: script.function // Store function name for reference
                            });

                            this.controller.insertedResourceKeys.add(resourceKey);
                        } catch (error) {
                            logger.error(`ResourceManager.insertScripts: Error executing script function ${script.function}:`, error);
                        }
                        return; // Don't continue to element creation
                    } else {
                        logger.warn(`ResourceManager.insertScripts: Script function ${script.function} not found in registry for view ${this.path}`);
                    }

                } else if (script.content) {
                    // Fallback: Insert raw content (legacy support)
                    element = document.createElement('script');
                    element.textContent = script.content;
                    element.type = script.attributes?.type || 'text/javascript';

                    if (script.id) {
                        element.id = script.id;
                    }

                    if (script.attributes) {
                        Object.entries(script.attributes).forEach(([key, value]) => {
                            if (key !== 'id' && key !== 'type') {
                                if (value === true) {
                                    element.setAttribute(key, '');
                                } else {
                                    element.setAttribute(key, value);
                                }
                            }
                        });
                    }

                    element.setAttribute('data-view-path', this.path);
                    element.setAttribute('data-resource-key', resourceKey);
                    try {
                        document.body.appendChild(element);
                    } catch (error) {
                        logger.warn(`ResourceManager.insertScripts: Error appending script ${resourceKey}:`, error);
                        logger.log(element);
                    }
                } else {
                    logger.warn(`ResourceManager.insertScripts: Script ${resourceKey} has no function or content`);
                    return; // Don't register if no content/function
                }
            }

            // Register in global registry (for non-function scripts)
            if (element) {
                this.controller.App.View.Engine.resourceRegistry.set(resourceKey, {
                    element: element,
                    viewPaths: new Set([this.path]),
                    referenceCount: 1,
                    resourceType: 'script'
                });

                this.controller.insertedResourceKeys.add(resourceKey);
            }
        });
    }

    /**
     * Remove styles from registry with reference counting
     * Extracted from ViewController.js line 683
     */
    removeStyles() {
        if (!this.controller.styles || this.controller.styles.length === 0) {
            // Fallback: Remove all styles with this view path from DOM
            this.removeStylesByViewPath();
            return;
        }

        this.controller.styles.forEach(style => {
            const resourceKey = this.controller.App.View.Engine.getResourceKey({
                ...style,
                viewPath: this.path,
                resourceType: 'style'
            });

            const registryEntry = this.controller.App.View.Engine.resourceRegistry.get(resourceKey);

            if (registryEntry) {
                // Remove this view path from registry
                registryEntry.viewPaths.delete(this.path);
                registryEntry.referenceCount--;

                // Only remove from DOM if no other views are using it
                if (registryEntry.referenceCount <= 0) {
                    if (registryEntry.element && registryEntry.element.parentNode) {
                        registryEntry.element.remove();
                    }

                    // Remove from registry
                    this.controller.App.View.Engine.resourceRegistry.delete(resourceKey);
                }

                this.controller.insertedResourceKeys.delete(resourceKey);
            } else {
                // Fallback: If not found in registry, try to remove from DOM directly
                const elements = document.querySelectorAll(`[data-view-path="${this.path}"][data-resource-key="${resourceKey}"]`);
                elements.forEach(element => {
                    if (element.parentNode) {
                        element.remove();
                    }
                });
            }
        });

        // Final fallback: Remove any remaining styles with this view path
        this.removeStylesByViewPath();
    }

    /**
     * Remove all styles from DOM that belong to a view path
     * Extracted from ViewController.js line 738
     */
    removeStylesByViewPath(viewPath = null) {
        const targetPath = viewPath || this.path;
        if (!targetPath) {
            return;
        }

        // Find all style/link elements with this view path
        const styleElements = document.querySelectorAll(`style[data-view-path="${targetPath}"], link[data-view-path="${targetPath}"]`);

        styleElements.forEach(element => {
            const resourceKey = element.getAttribute('data-resource-key');

            if (resourceKey) {
                // Check registry to see if other views are using this resource
                const registryEntry = this.controller.App.View.Engine.resourceRegistry.get(resourceKey);

                if (registryEntry) {
                    // Remove this view path from registry
                    registryEntry.viewPaths.delete(targetPath);
                    registryEntry.referenceCount--;

                    // Only remove from DOM if no other views are using it
                    if (registryEntry.referenceCount <= 0) {
                        if (element.parentNode) {
                            element.remove();
                        }
                        // Remove from registry
                        this.controller.App.View.Engine.resourceRegistry.delete(resourceKey);
                    }
                } else {
                    // Not in registry, safe to remove directly
                    if (element.parentNode) {
                        element.remove();
                    }
                }

                // Remove from insertedResourceKeys (if this is the same instance)
                if (this.path === targetPath) {
                    this.controller.insertedResourceKeys.delete(resourceKey);
                }
            } else {
                // No resource key, but has view path - safe to remove
                if (element.parentNode) {
                    element.remove();
                }
            }
        });
    }

    /**
     * Remove scripts from registry with reference counting
     * Extracted from ViewController.js line 790
     */
    removeScripts() {
        if (!this.controller.scripts || this.controller.scripts.length === 0) {
            return;
        }

        this.controller.scripts.forEach(script => {
            const resourceKey = this.controller.App.View.Engine.getResourceKey({
                ...script,
                viewPath: this.path,
                resourceType: 'script'
            });

            const registryEntry = this.controller.App.View.Engine.resourceRegistry.get(resourceKey);

            if (registryEntry) {
                // Remove this view path from registry
                registryEntry.viewPaths.delete(this.path);
                registryEntry.referenceCount--;

                // Only remove from DOM if no other views are using it
                if (registryEntry.referenceCount <= 0) {
                    // For function wrappers, don't remove from DOM (no element)
                    // Just remove from registry
                    if (registryEntry.element && registryEntry.element.parentNode) {
                        registryEntry.element.remove();
                    }

                    // Remove from registry
                    this.controller.App.View.Engine.resourceRegistry.delete(resourceKey);
                }

                this.controller.insertedResourceKeys.delete(resourceKey);
            }
        });
    }
}
