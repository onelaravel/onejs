/**
 * TypeScript-style type definitions using JSDoc
 * This file provides type hints for better IDE support and documentation
 * 
 * @module types/index
 * @author OneLaravel Team
 * @since 2025-12-29
 */

/**
 * @typedef {Object} Application
 * @property {string} name - Application name
 * @property {Helper} Helper - Helper instance
 * @property {Router} Router - Router instance
 * @property {ViewManager} View - ViewManager instance
 * @property {typeof HttpService} HttpService - HttpService class
 * @property {HttpService} Http - HttpService instance
 * @property {OneMarkup} OneMarkup - OneMarkup class
 * @property {API} Api - API class
 * @property {string} mode - Application mode (development/production)
 * @property {boolean} isInitialized - Initialization status
 * @property {AppEnvironment} env - Environment configuration
 * @property {Function} init - Initialize application
 */

/**
 * @typedef {Object} AppEnvironment
 * @property {string} mode - Environment mode (web/mobile)
 * @property {boolean} debug - Debug mode flag
 * @property {string} base_url - Base URL
 * @property {string} csrf_token - CSRF token
 * @property {string} router_mode - Router mode (history/hash)
 */

/**
 * @typedef {Object} ViewData
 * @property {string} [__SSR_VIEW_ID__] - Server-side rendered view ID
 * @property {*} [key: string] - Additional data properties
 */

/**
 * @typedef {Object} SystemData
 * @property {Application} App - Application instance
 * @property {typeof View} View - View class
 * @property {string} __base__ - Base path
 * @property {string} __layout__ - Layout path
 * @property {string} __page__ - Page path
 * @property {string} __component__ - Component path
 * @property {string} __template__ - Template path
 * @property {string} __partial__ - Partial path
 * @property {string} __system__ - System path
 * @property {Object} __env - Environment data
 * @property {Object} __helper - Helper functions
 */

/**
 * @typedef {Object} ViewConfig
 * @property {string} superView - Super view path
 * @property {boolean} hasSuperView - Has super view flag
 * @property {string} viewType - View type (view/layout/component)
 * @property {Object} sections - Section definitions
 * @property {WrapperConfig} wrapperConfig - Wrapper configuration
 * @property {Array<string>} __props__ - Property names
 * @property {boolean} hasAwaitData - Has await data flag
 * @property {boolean} hasFetchData - Has fetch data flag
 * @property {boolean} subscribe - Subscribe flag
 * @property {Object|null} fetch - Fetch configuration
 * @property {ViewData} data - View data
 * @property {string} viewId - View ID
 * @property {string} path - View path
 * @property {boolean} usesVars - Uses vars flag
 * @property {boolean} hasSections - Has sections flag
 * @property {boolean} hasSectionPreload - Has section preload flag
 * @property {boolean} hasPrerender - Has prerender flag
 * @property {Array<string>} renderLongSections - Long sections to render
 * @property {Array<string>} renderSections - Sections to render
 * @property {Array<string>} prerenderSections - Sections to prerender
 * @property {Array<ScriptResource>} scripts - Script resources
 * @property {Array<StyleResource>} styles - Style resources
 * @property {Array<Resource>} resources - Other resources
 * @property {Function} commitConstructorData - Commit constructor data
 * @property {Function} updateVariableData - Update variable data
 * @property {Function} updateVariableItem - Update variable item
 * @property {Function} loadServerData - Load server data
 * @property {Function} prerender - Prerender function
 * @property {Function} render - Render function
 * @property {Function} init - Init function
 * @property {Function} destroy - Destroy function
 */

/**
 * @typedef {Object} WrapperConfig
 * @property {boolean} enable - Enable wrapper
 * @property {string|null} tag - Wrapper tag name
 * @property {boolean} subscribe - Subscribe to state changes
 * @property {Object} attributes - Wrapper attributes
 */

/**
 * @typedef {Object} Resource
 * @property {string} type - Resource type (src/href/code)
 * @property {string} resourceType - Resource type (script/style)
 * @property {string} [src] - External resource URL
 * @property {string} [href] - External stylesheet URL
 * @property {string} [content] - Inline content
 * @property {string} [function] - Function name for code type
 * @property {string} [id] - Resource ID
 * @property {Object} [attributes] - Additional attributes
 */

/**
 * @typedef {Resource} ScriptResource
 * @property {'script'} resourceType
 */

/**
 * @typedef {Resource} StyleResource
 * @property {'style'} resourceType
 */

/**
 * @typedef {Object} StateDefinition
 * @property {*} value - State value
 * @property {Function} setValue - State setter
 * @property {string} key - State key
 * @property {Array<Function>} subscribers - State subscribers
 */

/**
 * @typedef {Object} EventConfig
 * @property {string} eventType - Event type (click/input/etc)
 * @property {Array<EventHandler>} handlers - Event handlers
 * @property {string} eventID - Event ID
 */

/**
 * @typedef {Object} EventHandler
 * @property {string|Function} handler - Handler function or name
 * @property {Array<*>} params - Handler parameters
 * @property {Object} options - Handler options
 */

/**
 * @typedef {Object} OutputComponentConfig
 * @property {string} outputId - Output ID
 * @property {string} stateKey - State key to watch
 * @property {boolean} escaped - Escape HTML flag
 * @property {HTMLElement} element - Output element
 */

/**
 * @typedef {Object} WatchComponentConfig
 * @property {string} watchId - Watch ID
 * @property {string} stateKey - State key to watch
 * @property {Function} callback - Watch callback
 */

/**
 * @typedef {Object} RouteConfig
 * @property {string} path - Route path
 * @property {string} name - Route name
 * @property {Function|string} handler - Route handler
 * @property {Object} [meta] - Route metadata
 * @property {Array<Function>} [middleware] - Route middleware
 */

/**
 * @typedef {Object} RouterConfig
 * @property {string} mode - Router mode (history/hash)
 * @property {string} base - Base path
 * @property {Function} [scrollBehavior] - Scroll behavior function
 */

/**
 * @typedef {Object} HTTPConfig
 * @property {string} baseURL - Base URL
 * @property {Object} headers - Default headers
 * @property {number} timeout - Request timeout
 * @property {Function} [onRequest] - Request interceptor
 * @property {Function} [onResponse] - Response interceptor
 * @property {Function} [onError] - Error interceptor
 */

/**
 * @typedef {Object} SSRViewData
 * @property {string} viewId - View ID
 * @property {ViewData} data - View data
 * @property {Object} events - Event configurations
 * @property {Array<string>} children - Child view IDs
 */

// Export empty object to make this a module
export { };
