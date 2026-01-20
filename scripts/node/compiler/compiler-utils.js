/**
 * Compiler utilities
 */

class CompilerUtils {
    constructor() {
        // No initialization needed
    }

    generateSectionsInfo(sections, analysis) {
        /** Generate sections info */
        const sectionsInfo = [];
        
        for (const section of sections) {
            sectionsInfo.push({
                name: section.name,
                type: section.type || 'long',
                preloader: section.preloader || false,
                useVars: section.useVars || false,
                script: section.script || {}
            });
        }
        
        return sectionsInfo;
    }

    formatFetchConfig(fetchConfig) {
        /** Format fetch config */
        if (typeof fetchConfig === 'string') {
            return fetchConfig;
        }
        
        return JSON.stringify(fetchConfig);
    }
}

module.exports = CompilerUtils;

