/**
 * Generators for functions (render, prerender, init, etc.)
 */

const { JS_FUNCTION_PREFIX, HTML_ATTR_PREFIX } = require('./config');

class FunctionGenerators {
    constructor() {
        // No initialization needed
    }

    generateRenderFunction(templateContent, varsDeclaration, extendedView, extendsData, sectionsInfo = null, hasPrerender = false, setupScript = "", directivesLine = "") {
        /** Generate render function */
        const varsLine = varsDeclaration ? "    " + varsDeclaration + "\n" : "";
        const viewIdLine = "    \n";
        
        // Filter out sections that are already in prerender
        // Only filter if hasPrerender is true (meaning some sections are in prerender)
        let filteredTemplate = templateContent;
        if (sectionsInfo && hasPrerender) {
            for (const section of sectionsInfo) {
                const sectionName = section.name;
                const useVars = section.useVars || false;
                const preloader = section.preloader || false;
                const sectionType = section.type || 'long';
                
                // Remove sections that are already in prerender
                // Only remove static sections (not using vars) that are in prerender
                if (!useVars) {
                    if (sectionType === 'short') {
                        const pattern = new RegExp(`\\$\\{${JS_FUNCTION_PREFIX}\\.section\\(['"]${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"],\\s*[^)]+\\)\\}`, 'g');
                        filteredTemplate = filteredTemplate.replace(pattern, '');
                    } else { // long section
                        const pattern = new RegExp(`\\$\\{${JS_FUNCTION_PREFIX}\\.section\\(['"]${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"],\\s*\`[^\`]*\`,\\s*['"]html['"]\\)\\}`, 'gs');
                        filteredTemplate = filteredTemplate.replace(pattern, '');
                    }
                }
                // If section uses vars, keep it in render (dynamic sections)
            }
        }
        
        // No need to escape template content as it's already processed correctly
        const filteredTemplateEscaped = filteredTemplate;
        
        // Add setup script but remove useState declarations if register & update mechanism exists
        let setupLine = "";
        if (setupScript) {
            // Check if register & update mechanism exists (has updateStateByKey)
            const hasRegisterUpdate = directivesLine && directivesLine.includes('updateStateByKey');
            
            if (hasRegisterUpdate) {
                // If register & update mechanism exists, remove useState declarations from setup script
                // Only remove useState declarations that have state key already registered
                let filteredSetup = setupScript;
                // Filter logic here if needed
                setupLine = filteredSetup ? "    " + filteredSetup + "\n" : "";
            } else {
                setupLine = "    " + setupScript + "\n";
            }
        }

        if (extendedView) {
            const dataParam = extendsData ? ", " + extendsData : "";
            return `function(__$spaViewData$__ = {}) {
            ${varsLine}${directivesLine}${viewIdLine}${setupLine}    let __outputRenderedContent__ = '';
            try {
                __outputRenderedContent__ = \`${filteredTemplateEscaped}\`;
            } catch(e) {
                __outputRenderedContent__ = this.showError(e.message);
            }
            return ${JS_FUNCTION_PREFIX}.extendView('${extendedView}'${dataParam});
            }`;
        } else {
            return `function(__$spaViewData$__ = {}) {
            ${varsLine}${directivesLine}${viewIdLine}${setupLine}    let __outputRenderedContent__ = '';
            try {
                __outputRenderedContent__ = \`${filteredTemplateEscaped}\`;
            } catch(e) {
                __outputRenderedContent__ = this.showError(e.message);
            }
            return __outputRenderedContent__;
            }`;
        }
    }

    generateLoadServerDataFunction(varsDeclaration, setupScript = "", directivesLine = "") {
        /** Generate loadServerData function - similar to render but without template content and return */
        const varsLine = varsDeclaration ? "    " + varsDeclaration + "\n" : "";
        const viewIdLine = "    \n";
        
        let setupLine = "";
        if (setupScript) {
            // Filter setup script to remove useState declarations if needed
            const filteredSetup = setupScript;
            setupLine = filteredSetup.trim() ? "    " + filteredSetup + "\n" : "";
        }
        
        return `function(__$spaViewData$__ = {}) {
            ${varsLine}${directivesLine}${viewIdLine}${setupLine}    // Load server data - no template content needed
            // This function is only for loading data when view is rendered from server
            }`;
    }

    generatePrerenderFunction(hasAwait, hasFetch, varsLine, viewIdLine, templateContent, extendedView = null, extendsData = null, sectionsInfo = null, conditionalContent = null, hasPrerender = true) {
        /** Generate prerender function */
        if (hasAwait || hasFetch) {
            if (extendedView) {
                const dataParam = extendsData ? ", " + extendsData : "";
                return `function(__$spaViewData$__ = {}) {
                ${varsLine}${viewIdLine}    let __outputRenderedContent__ = '';
                try {
                    __outputRenderedContent__ = \`<div class="${HTML_ATTR_PREFIX}preloader" ref="\${__VIEW_ID__}" data-view-name="\${__VIEW_PATH__}">\${${JS_FUNCTION_PREFIX}.text('loading')}</div>\`;
                } catch(e) {
                    __outputRenderedContent__ = this.showError(e.message);
                }
                return ${JS_FUNCTION_PREFIX}.extendView('${extendedView}'${dataParam});
                }`;
            } else {
                return `function(__$spaViewData$__ = {}) {
                ${varsLine}${viewIdLine}    let __outputRenderedContent__ = '';
                try {
                    __outputRenderedContent__ = \`<div class="${HTML_ATTR_PREFIX}preloader" ref="\${__VIEW_ID__}" data-view-name="\${__VIEW_PATH__}">\${${JS_FUNCTION_PREFIX}.text('loading')}</div>\`;
                } catch(e) {
                    __outputRenderedContent__ = this.showError(e.message);
                }
                return __outputRenderedContent__;
                }`;
            }
        } else {
            // No await/fetch - use conditional content or empty
            const content = conditionalContent || '';
            
            if (extendedView) {
                const dataParam = extendsData ? ", " + extendsData : "";
                return `function(__$spaViewData$__ = {}) {
                ${varsLine}${viewIdLine}    let __outputRenderedContent__ = '';
                try {
                    __outputRenderedContent__ = \`${content}\`;
                } catch(e) {
                    __outputRenderedContent__ = this.showError(e.message);
                }
                return ${JS_FUNCTION_PREFIX}.extendView('${extendedView}'${dataParam});
                }`;
            } else {
                return `function(__$spaViewData$__ = {}) {
                ${varsLine}${viewIdLine}    let __outputRenderedContent__ = '';
                try {
                    __outputRenderedContent__ = \`${content}\`;
                } catch(e) {
                    __outputRenderedContent__ = this.showError(e.message);
                }
                return __outputRenderedContent__;
                }`;
            }
        }
    }

    generateCssFunctions(viewName, cssContent = null) {
        /** Generate CSS functions (addCSS, removeCSS) */
        if (cssContent && cssContent.length > 0) {
            // Separate inline CSS and external CSS
            const inlineCss = [];
            const externalCss = [];
            
            for (const css of cssContent) {
                if (css.startsWith('<link') || css.includes('href=')) {
                    externalCss.push(css);
                } else {
                    inlineCss.push(css);
                }
            }
            
            const addCssFunction = `,
        addCSS: function() {
            ${inlineCss.length > 0 ? `
            const style = document.createElement('style');
            style.setAttribute('data-view-name', '${viewName}');
            style.textContent = \`${inlineCss.join('\n')}\`;
            document.head.appendChild(style);` : ''}
            ${externalCss.length > 0 ? `
            const existingLinks = document.querySelectorAll('link[data-view-name="${viewName}"]');
            existingLinks.forEach(link => link.remove());
            ${externalCss.map(css => `
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.setAttribute('data-view-name', '${viewName}');
            link.href = '${css}';
            document.head.appendChild(link);`).join('')}` : ''}
        }`;
            
            const removeCssFunction = `,
        removeCSS: function() {
            const styles = document.querySelectorAll('style[data-view-name="${viewName}"]');
            styles.forEach(style => style.remove());
            const links = document.querySelectorAll('link[data-view-name="${viewName}"]');
            links.forEach(link => link.remove());
        }`;
            
            return addCssFunction + removeCssFunction;
        } else {
            return `,
        addCSS: function() {
            // No CSS content found in @onInit
        },
        removeCSS: function() {
            const styles = document.querySelectorAll('style[data-view-name="${viewName}"]');
            styles.forEach(style => style.remove());
        }`;
        }
    }

    generateInitFunction(initCode) {
        /** Generate init function */
        if (!initCode || !initCode.trim()) {
            return "function(__$spaViewData$__ = {}) { }";
        }
        
        return `function(__$spaViewData$__ = {}) {
            ${initCode}
        }`;
    }

    generateDestroyFunction() {
        /** Generate destroy function */
        return "function() { }";
    }

    generateWrapperFunction(wrapperContent) {
        /** Generate wrapper function */
        if (!wrapperContent || !wrapperContent.trim()) {
            return "";
        }
        
        return wrapperContent;
    }
}

module.exports = FunctionGenerators;

