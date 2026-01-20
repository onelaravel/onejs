const path = require('path');

class CompilerConfig {
    constructor() {
        this.config = {
            paths: {
                views_input: "resources/views",
                js_input: "resources/js/app",
                build_output: "resources/js/build",
                build_scopes: "resources/js/build/scopes",
                public_static: "public/static",
                app_output: "public/static/app",
                scopes_output: "public/static/app/scopes"
            },
            files: {
                view_templates: "view.templates.js",
                wrapper: "wraper.js",
                main: "main.js"
            },
            patterns: {
                blade: "**/*.blade.php",
                js: "**/*.js"
            },
            settings: {
                default_scope: "web",
                auto_create_dirs: true,
                verbose: false
            },
            build_directories: [
                "web",
                "admin", 
                "layouts",
                "partials",
                "custom",
                "base"
            ]
        };
    }

    get(key) {
        return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.config);
        target[lastKey] = value;
    }

    printConfig() {
        console.log("=============================");
        console.log("Compiler Configuration:");
        console.log("=============================");
        console.log("Views input:", this.get('paths.views_input'));
        console.log("JS input:", this.get('paths.js_input'));
        console.log("Build output:", this.get('paths.build_output'));
        console.log("App output:", this.get('paths.app_output'));
        console.log("Default scope:", this.get('settings.default_scope'));
        console.log("Auto create dirs:", this.get('settings.auto_create_dirs'));
        console.log("Verbose:", this.get('settings.verbose'));
        console.log("Build directories:");
        this.get('build_directories').forEach((dir, i) => {
            console.log(`  ${i + 1}. ${dir}`);
        });
        console.log("=============================");
    }
}

// Constants for backward compatibility
const JS_FUNCTION_PREFIX = "App.View";
const HTML_ATTR_PREFIX = "one-";
const SPA_YIELD_ATTR_PREFIX = "one-yield-attr";
const SPA_YIELD_SUBSCRIBE_KEY_PREFIX = "one-yield-key";
const SPA_YIELD_SUBSCRIBE_TARGET_PREFIX = "one-yield-target";
const SPA_YIELD_SUBSCRIBE_ATTR_PREFIX = "one-yield-attr";
const SPA_YIELD_CONTENT_PREFIX = "one-yield-content";
const SPA_YIELD_CHILDREN_PREFIX = "one-yield-children";
const APP_VIEW_NAMESPACE = "App.View";
const APP_HELPER_NAMESPACE = "App.Helper";

// View functions configuration
class ViewConfig {
    constructor() {
        // View functions - all other functions go to Helper
        this.VIEW_FUNCTIONS = [
            // Core functions
            'generateViewId',
            'execute',
            'evaluate',
            'escString',
            'text',
            'templateToDom',
            
            // View management
            'view',
            'loadView',
            'renderView',
            'include',
            'includeIf',
            'extendView',
            
            // View lifecycle
            'setSuperViewPath',
            'addViewEngine',
            'callViewEngineMounted',
            
            // Wrapper functions
            'startWrapper',
            'endWrapper',
            'registerSubscribe',
            'wrapAttr',
            // Sections
            'section',
            'yield',
            'yieldContent',
            'renderSections',
            'hasSection',
            'getChangedSections',
            'resetChangedSections',
            'isChangedSection',
            'emitChangedSections',
            
            // Stacks
            'push',
            'stack',
            
            // Once
            'once',
            
            // Route
            'route',
            
            // Events
            'on',
            'off',
            'emit',
            
            // Initialization
            'init',
            'setApp',
            'setContainer',
            'clearOldRendering',
            
            // Auth & Error functions (for Blade compatibility)
            'isAuth',
            'can',
            'cannot',
            'hasError',
            'firstError',
            'csrfToken',
            
            // Loop functions (for Blade compatibility)
            'foreach',
            'foreachTemplate'
        ];
    }

    isViewFunction(functionName) {
        return this.VIEW_FUNCTIONS.includes(functionName);
    }
}

module.exports = {
    CompilerConfig,
    JS_FUNCTION_PREFIX,
    HTML_ATTR_PREFIX,
    SPA_YIELD_ATTR_PREFIX,
    SPA_YIELD_SUBSCRIBE_KEY_PREFIX,
    SPA_YIELD_SUBSCRIBE_TARGET_PREFIX,
    SPA_YIELD_SUBSCRIBE_ATTR_PREFIX,
    SPA_YIELD_CONTENT_PREFIX,
    SPA_YIELD_CHILDREN_PREFIX,
    APP_VIEW_NAMESPACE,
    APP_HELPER_NAMESPACE,
    ViewConfig
};

