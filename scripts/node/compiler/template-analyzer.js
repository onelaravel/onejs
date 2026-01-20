/**
 * Template analyzer - analyzes template content
 */

class TemplateAnalyzer {
    constructor() {
        // No initialization needed
    }

    analyzeTemplate(templateContent) {
        /** Analyze template content */
        const analysis = {
            hasPrerender: false,
            conditionalContent: '',
            sections: [],
            variables: [],
            directives: []
        };

        // Check for prerender content
        if (templateContent.includes('preloader') || templateContent.includes('loading')) {
            analysis.hasPrerender = true;
        }

        // Check for conditional content
        if (templateContent.includes('@if') || templateContent.includes('@unless')) {
            analysis.conditionalContent = templateContent;
        }

        // Extract sections
        const sectionMatches = templateContent.match(/\$\{App\.View\.section\(['"]([^'"]+)['"][^}]*\)\}/g);
        if (sectionMatches) {
            analysis.sections = sectionMatches.map(match => {
                const nameMatch = match.match(/['"]([^'"]+)['"]/);
                return nameMatch ? nameMatch[1] : null;
            }).filter(Boolean);
        }

        // Extract variables
        const varMatches = templateContent.match(/\$\{([^}]+)\}/g);
        if (varMatches) {
            analysis.variables = varMatches.map(match => match.slice(2, -1));
        }

        return analysis;
    }
}

module.exports = TemplateAnalyzer;

