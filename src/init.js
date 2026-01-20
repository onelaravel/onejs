/**
 * init Module
 * ES6 Module for Blade Compiler
 */

// import { App } from './app.js';

function initApp(App) {
    App = App || window.App;
    
    // Check if APP_CONFIGS is available
    if (typeof window.APP_CONFIGS === 'undefined') {
        console.error('APP_CONFIGS not found! Please define window.APP_CONFIGS in your HTML.');
        return;
    }
    
    console.log('✅ APP_CONFIGS found:', window.APP_CONFIGS);

    const config = window.APP_CONFIGS;
    
    // Validate required App modules
    if (typeof App === 'undefined') {
        console.error('App core module not found! Please ensure app.main.js is loaded.');
        return;
    }

    // Validate config structure
    if (!config || typeof config !== 'object') {
        console.error('Invalid APP_CONFIGS! Config must be an object.');
        return;
    }

    // Initialize view container first
    const container = config.container ? (
        typeof config.container === 'string' ? (
            document.querySelector(config.container) || document.body
        ) : (config.container instanceof HTMLElement ? config.container : document.body)
    ) : document.body;
    if (container) {
        App.View.setContainer(container);
    } else {
        console.warn('⚠️ No container specified and no default container found');
    }

    const isServerRendered = container.getAttribute('data-server-rendered') === 'true';

    App.env = {...App.env, ...config.env};

    if (App.View) {
        // If server-rendered, ensure view container is properly hydrated
        if (isServerRendered) {
            // Mark container as hydrated without re-rendering content
            App.View._isHydrated = true;
        }

        // Initialize View configuration
        if (App.View && config.view) {
            App.View.init(config.view);
        } else if (config.view) {
            console.warn('⚠️ View configuration provided but App.View not found');
        }

    }

    // Initialize API configuration
    if (config.api && App.Http) {
        if (config.api.baseUrl) {
            App.Http.setBaseUrl(config.api.baseUrl);
        }

        // Set default headers including CSRF token
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };

        if (config.api.csrfToken) {
            defaultHeaders['X-CSRF-TOKEN'] = config.api.csrfToken;
        }

        App.Http.setDefaultHeaders(defaultHeaders);
        App.Http.setTimeout(config.api.timeout || 10000);

    } else if (config.api) {
        console.warn('⚠️ API configuration provided but AppInstance.HttpService not found');
    } else {
        console.warn('⚠️ No API configuration provided');
    }

    // Initialize router configuration
    if (App.Router) {
        if (config.router.allRoutes) {
            App.Router.setAllRoutes(config.router.allRoutes);
        }
        // Get routes from router config or fallback to top-level routes
        let routes = config.router?.routes || config.routes;
        if (!routes || !Array.isArray(routes) || routes.length === 0) {
            const scope = config.appScope || 'web';
            routes = [
                { path: `/${scope}`, view: `${scope}.home` },
                { path: `/${scope}/about`, view: `${scope}.about` },
                { path: `/${scope}/users`, view: `${scope}.users` },
                { path: `/${scope}/users/:id`, view: `${scope}.user-detail` },
                { path: `/${scope}/contact`, view: `${scope}.contact` }
            ];
        } else {
            console.log('🔧 Using provided routes:', routes.length);
        }

        // Register routes
        routes.forEach(route => {
            if (route.path && (route.view || route.component)) {
                const viewName = route.view || route.component;
                App.Router.addRoute(route.path, viewName, route.options || {});
            }
        });

        // Configure router options
        if (config.router) {
            if (config.router.mode) {
                App.Router.setMode(config.router.mode);
            }
            if (config.router.base) {
                App.Router.setBase(config.router.base);
            }
            
            // Setup default router hooks if not provided
            if (!config.router.beforeEach) {
                App.Router.beforeEach(function(to, from) {
                    if (App.mode === 'development') {
                        console.log('Navigating to:', to.path);
                    }
                    return true;
                });
            } else {
                App.Router.beforeEach(config.router.beforeEach);
            }
            
            if (!config.router.afterEach) {
                App.Router.afterEach(function(to, from) {
                    if (App.mode === 'development') {
                        console.log('Navigation complete:', to.path || to);
                    }
                    // to.path should be set from Router, fallback to window.location.pathname
                    const path = to.path || window.location.pathname;
                    updateActiveNav(path);
                });
            } else {
                App.Router.afterEach(function(to, from) {
                    // Call custom afterEach if provided
                    if (typeof config.router.afterEach === 'function') {
                        config.router.afterEach(to, from);
                    }
                    // Always update navigation
                    // to.path should be set from Router, fallback to window.location.pathname
                    const path = to.path || window.location.pathname;
                    updateActiveNav(path);
                });
            }
            console.log('✅ Router configuration applied');
        }

        // Set default route
        const defaultRoute = config.defaultRoute || `/${config.appScope || 'web'}`;
        App.Router.setDefaultRoute(defaultRoute);

        if (isServerRendered) {
            // Start router but don't handle initial route
            App.Router.start(true); // Pass true to skip initial route handling

            // Mark as client-side ready after a short delay
            setTimeout(() => {
                if (container) {
                    container.setAttribute('data-server-rendered', 'false');
                }
            }, 100);
        } else {
            // Start the router normally
            App.Router.start();
            console.log('✅ Router started');
        }
    } else {
        console.warn('⚠️ Router not available - AppInstance.Router not found');
    }

    if(config.view){
        if(config.view.superView){
            App.View.setSuperViewPath(config.view.superView);
        }
    }
    // Initialize system data
    // Initialize mode (development/production)
    if (config.mode) {
        App.mode = config.mode;

        // Enable/disable debug logging based on mode
        if (config.mode === 'development') {
            console.log('🔧 Development mode enabled - debug logging active');
        } else {
            console.log('🏭 Production mode enabled');
        }
    } else {
        // Set default mode
        App.mode = 'development';
        console.warn('⚠️ No mode specified in config, using default: development');
    }

    // Initialize global data
    App.globalData = {
        siteName: 'One App',
        version: '1.0.0',
        csrfToken: config.api?.csrfToken,
        appScope: config.appScope,
        currentUser: config.currentUser,
        ...(config.data || {})
    };

    // Initialize language configuration
    if (config.lang) {
        App.lang = {
            current: config.lang.locale || 'en',
            fallback: config.lang.fallback || 'en',
            ...config.lang
        };
        console.log('✅ Language configuration initialized:', App.lang);
    } else {
        // Set default language configuration
        App.lang = {
            current: 'en',
            fallback: 'en'
        };
        console.warn('⚠️ No language configuration provided, using defaults');
    }


    // Setup navigation updates
    if (App.View) {
        App.View.on('view:rendered', function (viewName) {
            console.log('View rendered:', viewName);
            updateActiveNav();
        });
    } else {
        console.warn('⚠️ Navigation updates not available - App.View not found');
    }

    // Custom initialization callback
    if (config.onInit && typeof config.onInit === 'function') {
        try {
            config.onInit(App, config);
            console.log('✅ Custom initialization callback executed');
        } catch (error) {
            console.error('❌ Error in custom initialization callback:', error);
        }
    }

    // Dispatch App ready event
    try {
        const appReadyEvent = new CustomEvent('app:ready', {
            detail: { App: App, config }
        });
        document.dispatchEvent(appReadyEvent);
        console.log('✅ App ready event dispatched');
    } catch (error) {
        console.error('❌ Error dispatching App ready event:', error);
    }

    console.log('🎉 App initialization completed successfully!');
}

// Navigation helper function - updates active navigation link
export function updateActiveNav(currentPath) {
    // Use provided path or current location
    const path = currentPath || window.location.pathname;
    
    // Find all navigation links (support multiple selectors)
    const navLinks = document.querySelectorAll('.nav-menu a, .nav-link, nav a[data-navigate]');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        
        // Check href attribute
        const href = link.getAttribute('href');
        // Check data-navigate attribute
        const navigatePath = link.getAttribute('data-navigate');
        
        // Match if href or data-navigate matches current path
        let isActive = false;
        
        // 1. Exact match
        if (href === path || navigatePath === path) {
            isActive = true;
        }
        // 2. Check full URL match
        else {
            const fullUrl = window.location.protocol + '//' + window.location.host + path;
            if (href === fullUrl) {
                isActive = true;
            }
        }
        
        // 3. Partial/prefix match for paths with query parameters or dynamic segments
        // e.g., /demo matches /demo/section-name
        if (!isActive && (href || navigatePath)) {
            const basePath = href || navigatePath;
            // Extract base path without query string
            const basePathWithoutQuery = basePath.split('?')[0];
            const currentPathWithoutQuery = path.split('?')[0];
            
            // Check if current path starts with nav link path (for routes with parameters)
            if (basePathWithoutQuery && currentPathWithoutQuery.startsWith(basePathWithoutQuery + '/')) {
                isActive = true;
            }
            // Also check exact match after removing query string
            else if (basePathWithoutQuery === currentPathWithoutQuery) {
                isActive = true;
            }
        }
        
        if (isActive) {
            link.classList.add('active');
        }
    });
}

// Make updateActiveNav globally available for router hooks
if (typeof window !== 'undefined') {
    window.updateActiveNav = updateActiveNav;
}
// try {
//     // Make updateActiveNav globally available for router config
//     window.updateActiveNav = updateActiveNav;

//     // Initialize when DOM is ready
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', initApp);
//     } else {
//         initApp();
//     }
// } catch (error) {
//     console.error('❌ Error in init:', error);
// }

export default initApp;