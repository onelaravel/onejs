/**
 * Main compiler class that combines all modules
 */

const fs = require('fs');
const path = require('path');
const { 
    JS_FUNCTION_PREFIX, 
    HTML_ATTR_PREFIX,
    ViewConfig 
} = require('./config');
const { 
    extractBalancedParentheses, 
    formatAttrs, 
    normalizeQuotes, 
    formatJsOutput,
    replaceAll 
} = require('./utils');

class BladeCompiler {
    constructor() {
        this.parsers = new (require('./parsers'))();
        this.templateProcessor = new (require('./template-processor'))();
        this.templateAnalyzer = new (require('./template-analyzer'))();
        this.functionGenerators = new (require('./function-generators'))();
        this.compilerUtils = new (require('./compiler-utils'))();
        this.wrapperParser = new (require('./wrapper-parser'))();
        this.registerParser = new (require('./register-parser'))();
        this.viewConfig = new ViewConfig();
    }

    convertViewPathToFunctionName(viewPath) {
        /** Convert view path to function name (e.g., web.demo-if -> WebDemoIf) */
        // Split by dots and hyphens
        const parts = viewPath.split(/[.-]/);
        // Capitalize each part and join
        const functionName = parts.map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
        return functionName;
    }

    compileBladeToJs(bladeCode, viewName) {
        /** Main compiler function */
        bladeCode = bladeCode.trim();
        
        // Reset parser states to avoid data leakage between views
        if (typeof this.registerParser.reset === 'function') {
            this.registerParser.reset();
        }
        // Note: wrapper_parser doesn't reset because data from wrapper.js doesn't change
        
        // Parse wrapper content
        const { wrapperFunctionContent, wrapperConfigContent } = this.wrapperParser.parseWrapperFile();
        
        // Convert view path to function name
        const functionName = this.convertViewPathToFunctionName(viewName);
        
        // Remove Blade comments
        bladeCode = bladeCode.replace(/\{\{--.*?--\}\}/gs, '');
        
        // Check for directives
        const hasAwait = bladeCode.includes('@await(');
        const hasFetch = bladeCode.includes('@fetch(');
        
        // Parse main components
        const { extendedView, extendsExpression, extendsData } = this.parsers.parseExtends(bladeCode);
        const varsDeclaration = this.parsers.parseVars(bladeCode);
        const letDeclarations = this.parsers.parseLetDirectives(bladeCode);
        const constDeclarations = this.parsers.parseConstDirectives(bladeCode);
        const useStateDeclarations = this.parsers.parseUseStateDirectives(bladeCode);
        const fetchConfig = hasFetch ? this.parsers.parseFetch(bladeCode) : null;
        const { initFunctions, cssContent } = this.parsers.parseInit(bladeCode);
        const viewTypeData = this.parsers.parseViewType(bladeCode);
        
        // Parse @register directive
        const registerContent = this.parsers.parseRegister(bladeCode);
        const registerData = this.registerParser.parseRegisterContent(registerContent);
        
        // Parse @wrapper directive
        const wrapperContent = this.parsers.parseWrapper(bladeCode);
        
        // Process template content
        const { templateContent, sections } = this.templateProcessor.processTemplate(bladeCode);
        
        // Analyze template
        const analysis = this.templateAnalyzer.analyzeTemplate(templateContent);
        
        // Determine view type
        const viewType = viewTypeData.type || 'component';
        
        // Generate sections info
        const sectionsInfo = this.compilerUtils.generateSectionsInfo(sections, analysis);
        
        // Generate view ID line
        const viewIdLine = `    const __VIEW_ID__ = data.__SSR_VIEW_ID__ || ${JS_FUNCTION_PREFIX}.generateViewId();\n`;
        
        // Generate setup script
        let setupScript = '';
        if (wrapperFunctionContent) {
            setupScript = wrapperFunctionContent;
        }
        
        // Generate directives line
        let directivesLine = '';
        if (letDeclarations || constDeclarations || useStateDeclarations) {
            const allDeclarations = [
                ...(letDeclarations || []),
                ...(constDeclarations || []),
                ...(useStateDeclarations || [])
            ];
            directivesLine = '    ' + allDeclarations.join('\n    ') + '\n';
        }
        
        // Generate user defined line
        let userDefinedLine = '';
        if (registerData && Object.keys(registerData).length > 0) {
            userDefinedLine = `\n        userDefined: ${JSON.stringify(registerData)},\n`;
        }
        
        // Generate resources line
        let resourcesLine = '';
        if (registerData && registerData.resources && registerData.resources.length > 0) {
            resourcesLine = `\n        resources: ${JSON.stringify(registerData.resources)},\n`;
        } else {
            resourcesLine = '\n        resources: [],\n';
        }
        
        // Generate render function (setup script will be added to view function instead)
        const renderFunction = this.functionGenerators.generateRenderFunction(
            templateContent, varsDeclaration, extendedView, extendsData, 
            sectionsInfo, analysis.hasPrerender, '', directivesLine
        );
        
        // Generate init function
        const initCode = initFunctions ? initFunctions.join('\n    ') : '';
        const initFunction = `function(__$spaViewData$__ = {}) { ${initCode} }`;
        
        // Generate prerender function (only use pure vars_declaration, no directives)
        let prerenderVarsLine = '';
        if (varsDeclaration) {
            prerenderVarsLine = '    ' + varsDeclaration + '\n';
        }
        
        const prerenderFunc = this.functionGenerators.generatePrerenderFunction(
            hasAwait, hasFetch, prerenderVarsLine, viewIdLine, templateContent, 
            extendedView, extendsData, sectionsInfo, analysis.conditionalContent, 
            analysis.hasPrerender
        );
        
        // Generate loadServerData function
        const loadServerDataFunc = this.functionGenerators.generateLoadServerDataFunction(
            varsDeclaration, '', directivesLine
        );
        
        // CSS functions - combine CSS from @onInit and @register
        const combinedCssContent = cssContent ? [...cssContent] : [];
        
        // Add CSS from @register
        if (registerData && registerData.css) {
            const cssData = registerData.css;
            
            // Add inline CSS
            if (cssData.inline) {
                combinedCssContent.push(cssData.inline);
            }
            
            // Add external CSS links
            if (cssData.external && cssData.external.length > 0) {
                combinedCssContent.push(...cssData.external);
            }
        }
        
        const cssFunctions = this.functionGenerators.generateCssFunctions(viewName, combinedCssContent);
        
        // Generate wrapper config line
        let wrapperConfigLine = '';
        if (wrapperConfigContent) {
            wrapperConfigLine = wrapperConfigContent;
        }
        
        // Generate super view config
        let superViewConfig = 'null';
        let hasSuperView = 'false';
        if (extendedView) {
            superViewConfig = `'${extendedView}'`;
            hasSuperView = 'true';
        }
        
        // Generate setup script line
        let setupScriptLine = '';
        if (setupScript) {
            setupScriptLine = setupScript + '\n';
        }
        
        // Generate wrapper function line
        let wrapperFunctionLine = '';
        if (wrapperContent) {
            wrapperFunctionLine = wrapperContent + '\n';
        }
        
        // Build the return string carefully to avoid syntax errors
        return `export function ${functionName}(data = {}) {
    const {App, View} = data;
    const __VIEW_PATH__ = '${viewName}';
    const __VIEW_ID__ = data.__SSR_VIEW_ID__ || ${JS_FUNCTION_PREFIX}.generateViewId();
    const __VIEW_TYPE__ = '${viewType}';
${wrapperFunctionLine}
    self.setup('${viewName}', {
        superView: ${superViewConfig},
        hasSuperView: ${hasSuperView},
        viewType: '${viewType}',
        sections: ${JSON.stringify(sectionsInfo)},
        hasAwaitData: ${hasAwait},
        hasFetchData: ${hasFetch},
        fetch: ${fetchConfig ? this.compilerUtils.formatFetchConfig(fetchConfig) : 'null'},
        data: data,
        viewId: __VIEW_ID__,
        path: __VIEW_PATH__,
        usesVars: ${!!varsDeclaration},
        hasSections: ${!!sections.length},
        hasSectionPreload: ${sectionsInfo.some(section => section.preloader)},
        hasPrerender: ${analysis.hasPrerender},${userDefinedLine}${resourcesLine}
        prerender: ${prerenderFunc},
        render: ${renderFunction},
        loadServerData: ${loadServerDataFunc},
        init: ${initFunction},
        destroy: function() {},${cssFunctions}${wrapperConfigLine}
    });
    return self;
        }`;
    }
}

module.exports = BladeCompiler;

