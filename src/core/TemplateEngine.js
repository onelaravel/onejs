/**
 * Template Engine for managing and rendering templates
 */
export class TemplateEngine {
    constructor(App, View, viewInstance, subscribe) {
        this.App = App;
        this.View = View;
        this.viewInstance = viewInstance;
        this.subscribe = subscribe;
        this.templates = {};
    }

    /**
     * Set templates
     * @param {Object} templates - Object of template functions
     */
    setTemplates(templates) {
        this.templates = templates;
    }

    /**
     * Render a template
     * @param {string} name - Template name
     * @param {Object} context - Context data
     * @param {Array|Object} data - Template data
     * @returns {string} Rendered template
     */
    render(name, context, data = []) {
        if (!this.templates[name]) {
            console.warn(`Template '${name}' not found`);
            return '';
        }

        try {
            const templateFn = this.templates[name];
            return templateFn(context, data);
        } catch (error) {
            console.error(`Error rendering template '${name}':`, error);
            return `<div class="template-error">Template '${name}' error: ${error.message}</div>`;
        }
    }

    /**
     * Check if template exists
     * @param {string} name - Template name
     * @returns {boolean} True if template exists
     */
    hasTemplate(name) {
        return !!this.templates[name];
    }

    /**
     * Get template
     * @param {string} name - Template name
     * @returns {Function|null} Template function or null
     */
    getTemplate(name) {
        return this.templates[name] || null;
    }

    /**
     * Remove template
     * @param {string} name - Template name
     */
    removeTemplate(name) {
        delete this.templates[name];
    }

    /**
     * Clear all templates
     */
    clearTemplates() {
        this.templates = {};
    }

    /**
     * Get all template names
     * @returns {Array} Array of template names
     */
    getTemplateNames() {
        return Object.keys(this.templates);
    }
}