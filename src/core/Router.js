/**
 * router Module
 * ES6 Module for Blade Compiler
 */

// import { Application } from "../app.js";
import { View } from "./View.js";

class ActiveRoute {
    constructor(route, urlPath, params, query = {}, fragment = {}) {
        this.$route = route;
        this.$urlPath = urlPath;
        this.$params = params || {};
        this.$query = query || {};
        this.$fragment = fragment || {};
        this.$paramKeys = [...Object.keys(params || {})];
        Object.keys(params).forEach(key => {
            Object.defineProperty(this, key, {
                get: () => this.$params[key],
                set: (value) => {
                    this.$params[key] = value;
                },
                enumerable: true,
                configurable: false,
            });
        });
    }

    getPath() {
        return this.$urlPath || null;
    }
    getUrlPath() {
        return this.$urlPath || null;
    }

    getParams() {
        return this.$params || {};
    }
    getParam(name) {
        return this.$params[name] || null;
    }
    getQuery() {
        return this.$query || {};
    }
    getFragment() {
        return this.$fragment || {};
    }
}

export class Router {
    static activeRoute = null;
    static containers = {};
    constructor(App = null) {
        /**
         * @type {Application}
         */
        this.App = App;
        this.routes = [];
        this.currentRoute = null;
        this.mode = 'history';
        this.base = '';
        this._beforeEach = null;
        this._afterEach = null;
        this.defaultRoute = '/';

        // Bind methods
        this.handleRoute = this.handleRoute.bind(this);
        this.handlePopState = this.handlePopState.bind(this);

        /**
         * @type {Object<string, {path: string, view: string, params: object}>}
         */
        this.routeConfigs = {};
        this.currentUri = window.location.pathname + window.location.search;
    }

    setApp(app) {
        this.App = app;
        return this;
    }

    addRouteConfig(routeConfig) {
        this.routeConfigs[routeConfig.name] = routeConfig;
    }

    setAllRoutes(routes) {
        for (const route of routes) {
            this.addRouteConfig(route);
        }
    }


    getURL(name, params = {}) {
        const routeConfig = this.routeConfigs[name];
        if (!routeConfig) {
            return null;
        }
        let url = this.generateUrl(routeConfig.path, params);
        if (!(url.startsWith('/') || url.startsWith('http:') || url.startsWith('https:'))) {
            url = this.base + url;
        }
        return url;
    }

    addRoute(path, view, options = {}) {
        this.routes.push({
            path: this.normalizePath(path),
            view: view,
            options: options
        });
    }

    setMode(mode) {
        this.mode = mode;
    }

    setBase(base) {
        this.base = base;
    }

    setDefaultRoute(route) {
        this.defaultRoute = route;
    }

    beforeEach(callback) {
        this._beforeEach = callback;
    }

    afterEach(callback) {
        this._afterEach = callback;
    }

    normalizePath(path) {
        // Remove leading slash if present, then add it back to ensure consistency
        let normalized = path.startsWith('/') ? path : '/' + path;

        // Remove trailing slash except for root path
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }

        // Handle empty path as root
        if (normalized === '') {
            normalized = '/';
        }

        return normalized;
    }

    /**
     * So sánh xem chuỗi str có khớp với format không.
     * @param {string} str - Chuỗi đầu vào cần kiểm tra
     * @param {string} format - Định dạng, ví dụ: {abc}, {abc}-def, demo-{key}, test-demo-{key}.xyz, ...
     * @returns {boolean} true nếu khớp, false nếu không
     */
    matchFormat(str, format) {
        // Chuyển format thành regex
        // Thay thế {param} thành ([^\/\-.]+) để match 1 đoạn không chứa /, -, .
        // Giữ lại các ký tự đặc biệt như -, ., ...
        let regexStr = format.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'); // escape ký tự đặc biệt
        regexStr = regexStr.replace(/\{[a-zA-Z0-9_]+\}/g, '([^\\/\\-.]+)');
        // Cho phép match toàn bộ chuỗi
        regexStr = '^' + regexStr + '$';
        const regex = new RegExp(regexStr);
        return regex.test(str);
    }

    hasParameter(path) {
        return /\{[a-zA-Z0-9_]+\??\}/.test(path);
    }

    /**
     * Check if parameter is optional (has ? suffix)
     * @param {string} path - The path segment to check (e.g., "{name?}")
     * @returns {boolean}
     */
    isOptionalParameter(path) {
        return /\{[a-zA-Z0-9_]+\?\}/.test(path);
    }

    isAnyParameter(path) {
        return path.includes('*') || path.toLowerCase() === '{any}';
    }

    /**
     * Lấy tên tham số đầu tiên trong path có format {param}
     * Đảm bảo hoạt động trên tất cả các trình duyệt (không dùng lookbehind/lookahead)
     * @param {string} format - Chuỗi path, ví dụ: "abc-{name}.html"
     * @returns {string|null} - Trả về tên param đầu tiên nếu có, ngược lại trả về null
     */
    getParameterName(format) {
        // Dùng RegExp đơn giản, không lookbehind/lookahead để tương thích trình duyệt cũ
        // Hỗ trợ cả {param} và {param?} (optional)
        var regex = /\{([a-zA-Z0-9_]+)\??\}/;
        var match = regex.exec(format);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    /**
     * Lấy giá trị tham số đầu tiên trong path theo format {param} hoặc {param?}
     * @param {string} format - Chuỗi format, ví dụ: "{id}" hoặc "{id?}"
     * @param {string} path - Chuỗi path thực tế, ví dụ: "1"
     * @returns {string|null} - Giá trị param nếu tìm thấy, ngược lại trả về null
     */
    getParameterValue(format, path) {
        if (typeof path !== 'string' || typeof format !== 'string') return null;

        // Nếu format chỉ là {param} hoặc {param?} thì trả về path
        if (format.match(/^\{[a-zA-Z0-9_]+\??\}$/)) {
            return path;
        }

        // Escape các ký tự đặc biệt trong format (trừ {param})
        let regexStr = format.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        // Thay thế {param} hoặc {param?} thành nhóm bắt
        regexStr = regexStr.replace(/\{[a-zA-Z0-9_]+\??\}/g, '([^\\/\\-.]+)');
        // Tạo regex
        const regex = new RegExp('^' + regexStr + '$');
        const match = regex.exec(path);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    getAnyParameterValue(format, path) {
        // Nếu format chứa dấu * thì xem như là {any}
        if (typeof format === 'string' && format.includes('*')) {
            format = format.replace(/\*/g, '{any}');
        }
        if (typeof path !== 'string' || typeof format !== 'string') return null;
        // Escape các ký tự đặc biệt trong format (trừ {param})
        let regexStr = format.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        // Thay thế từng {param} thành nhóm bắt
        regexStr = regexStr.replace(/\{[a-zA-Z0-9_]+\}/g, '([^\\/\\-.]+)');
        const regex = new RegExp('^' + regexStr + '$');
        const valueMatch = regex.exec(path);
        if (!valueMatch) return null;
        // Trả về giá trị đầu tiên (hoặc null nếu không có)
        return valueMatch[1] || null;
    }

    /**
     * Check if a route with parameters matches the given path
     * @param {object<{path: string, view: string, params: object}>} route - The route pattern (e.g., "/web/users/{id}")
     * @param {string} urlPath - The actual path to match (e.g., "/web/users/1")
     * @returns {Object|null} - Returns {params} if match, null if no match
     */
    checkParameterRoute(route, urlPath) {
        const routePathParts = this.App.Helper.trim(route.path, '/').split('/');
        const urlPathParts = this.App.Helper.trim(urlPath, '/').split('/');
        
        // Count trailing optional parameters in route
        let trailingOptionalCount = 0;
        for (let i = routePathParts.length - 1; i >= 0; i--) {
            if (this.isOptionalParameter(routePathParts[i])) {
                trailingOptionalCount++;
            } else {
                break; // Stop at first non-optional segment from the end
            }
        }
        
        // URL can have fewer segments if route has trailing optional params
        // Required segments = total - optional trailing segments
        const requiredSegments = routePathParts.length - trailingOptionalCount;
        
        // URL must have at least required segments and at most total segments
        if (urlPathParts.length < requiredSegments || urlPathParts.length > routePathParts.length) {
            return null;
        }

        const lastRoutePathIndex = routePathParts.length - 1;
        const params = {};

        for (let i = 0; i < routePathParts.length; i++) {
            const routePathPart = routePathParts[i];
            const urlPathPart = urlPathParts[i]; // May be undefined for optional params

            if (this.isAnyParameter(routePathPart)) {
                const paramValue = urlPathPart !== undefined 
                    ? this.getAnyParameterValue(routePathPart, urlPathPart) 
                    : null;
                params.any = paramValue;
                if (i === lastRoutePathIndex && i === 0) {
                    return params;
                }
            } else if (this.hasParameter(routePathPart)) {
                const paramName = this.getParameterName(routePathPart);
                const isOptional = this.isOptionalParameter(routePathPart);
                
                // If URL segment doesn't exist
                if (urlPathPart === undefined || urlPathPart === '') {
                    if (isOptional) {
                        // Optional param with no value -> null
                        params[paramName] = null;
                        continue;
                    } else {
                        // Required param missing
                        return null;
                    }
                }
                
                const paramValue = this.getParameterValue(routePathPart, urlPathPart);
                if (paramValue === null && !isOptional) {
                    return null;
                }
                params[paramName] = paramValue;
            }
            else {
                // Regular route part - exact match required
                if (routePathPart !== urlPathPart) {
                    return null;
                }
            }
        }

        return params;
    }

    matchRoute(path) {
        const normalizedPath = this.normalizePath(path);

        // Process routes in order - first match wins
        for (const route of this.routes) {
            const routePath = route.path;

            // Check if route has parameters
            const hasParameters = routePath.split('/').some(part => this.hasParameter(part) || this.isAnyParameter(part));

            if (hasParameters) {
                // Handle parameter route
                const params = this.checkParameterRoute(route, normalizedPath);
                if (params !== null) {
                    return { route, params, path: normalizedPath };
                }
            } else {
                // Handle exact route match
                if (routePath === normalizedPath) {
                    return { route, params: {}, path: normalizedPath };
                }
            }
        }

        return null;
    }

    async handleRoute(path, ignoreSetActiveRoute = false) {
        // Remove query string for route matching
        const pathForMatching = path.split('?')[0];
        const match = this.matchRoute(pathForMatching);

        if (!match) {
            return;
        }

        const { route, params } = match;

        // Call beforeEach hook
        if (this._beforeEach) {
            const result = await this._beforeEach(route, params);
            if (result === false) {
                return; // Navigation cancelled
            }
        }
        const URLParts = Router.getUrlParts();
        const query = URLParts.query;
        const fragment = URLParts.hash;

        if (!ignoreSetActiveRoute) {
            Router.addActiveRoute(route, match.path, params, query, fragment);
        }

        // Update current route
        this.currentRoute = { ...route, $params: params, $query: query, $fragment: fragment, $urlPath: match.path };

        // Render view
        if (this.App.View && (route.view || route.component)) {
            this.App.View.mountView(route.view || route.component, params, Router.getActiveRoute());
        }

        // Call afterEach hook with proper arguments: (to, from)
        // to = route object with path property
        if (this._afterEach) {
            const toRoute = { ...route, path: match.path };
            this._afterEach(toRoute, this.currentRoute);
        }
    }

    /**
     * Hydrate server-rendered views
     * Scans SSR HTML and attaches JavaScript behavior without re-rendering
     *
     * Flow:
     * 1. Get active route (from Router.activeRoute)
     * 2. Call beforeEach hook
     * 3. Call View.scanView() to:
     *    - Scan page view + all parent layouts
     *    - Setup view hierarchy (virtualRender)
     *    - Attach event handlers to existing DOM
     *    - Setup state subscriptions
     *    - Mount all views bottom-up
     * 4. Call afterEach hook
     * 5. Mark hydration complete
     */
    async hydrateViews() {

        if (!this.App?.View) {
            console.error('❌ Router.hydrateViews: App.View not available');
            return;
        }

        // Get active route info
        const activeRoute = Router.activeRoute || this.currentRoute;

        if (!activeRoute) {
            return;
        }

        const { $route: route, $params: params, $urlPath: urlPath, $query: query, $fragment: fragment } = activeRoute;

        // Call beforeEach hook (if exists)
        if (this._beforeEach) {
            const result = await this._beforeEach(route, params, urlPath);
            if (result === false) {
                return;
            }
        }

        // Handle view hydration
        if (route.view || route.component) {
            try {
                const viewName = route.view || route.component;

                this.App.View.mountViewScan(viewName, params, activeRoute);
                // Call afterEach hook with proper arguments: (to, from)
                if (this._afterEach) {
                    const toRoute = { ...route, path: urlPath };
                    this._afterEach(toRoute, this.currentRoute);
                }


            } catch (error) {
                console.error('❌ Router.hydrateViews: Error during hydration:', error);
            }
        }
    }


    handlePopState(event) {
        const path = window.location.pathname + window.location.search;
        this.currentUri = path; // Update currentUri during back/forward navigation
        this.handleRoute(path);
    }

    navigate(path) {

        if (this.mode === 'history') {
            window.history.pushState({}, '', path);
            try {
                this.handleRoute(path);
                this.currentUri = path;
            } catch (error) {
                console.error('❌ Router.navigate handleRoute error:', error);
            }
        } else {
            // Hash mode
            window.location.hash = path;
            try {
                this.handleRoute(path);
                this.currentUri = path;
            } catch (error) {
                console.error('❌ Router.navigate handleRoute (hash mode) error:', error);
            }
        }
    }

    /**
     * Generate URL with file extension
     * @param {string} route - Route pattern (e.g., '/users/{id}')
     * @param {object} params - Parameters to fill in
     * @param {string} extension - File extension (e.g., '.html', '.php')
     * @returns {string} Generated URL
     */
    generateUrl(route, params = {}, extension = '') {
        let url = route;

        // Replace parameters
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`{${key}}`, value);
        }

        // Add extension if provided
        if (extension && !url.endsWith(extension)) {
            url += extension;
        }

        return url;
    }

    /**
     * Navigate to route with file extension
     * @param {string} route - Route pattern
     * @param {object} params - Parameters
     * @param {string} extension - File extension
     */
    navigateTo(route, params = {}, extension = '') {
        const url = this.generateUrl(route, params, extension);
        this.navigate(url);
    }

    start(skipInitial = false) {
        // Detect if page has server-rendered content
        // Check container for data-server-rendered attribute
        const container = this.App?.View?.container || document.querySelector('#spa-content, #app-root, #app');
        const serverRendered = container.getAttribute('data-server-rendered');
        const isServerRendered = serverRendered === 'true';
        const URLParts = Router.getUrlParts();
        const initialPath = this.mode === 'history' ? (window.location.pathname + window.location.search) : (window.location.hash.substring(1) || this.defaultRoute);

        this.setActiveRouteForCurrentPath(initialPath);

        // Add event listeners
        if (this.mode === 'history') {
            window.addEventListener('popstate', this.handlePopState);
        } else {
            window.addEventListener('hashchange', this.handlePopState);
        }

        // Choose initial rendering strategy
        if (isServerRendered) {
            // SSR: Hydrate existing HTML
            console.log('🚀 Router.start: Starting SSR hydration...');
            this.hydrateViews();
        } else if (!skipInitial) {
            // CSR: Render from scratch
            this.handleRoute(initialPath);
        } else {
            console.log('🔍 Router.start: Skipping initial route handling' + (this.mode === 'history' ? '' : '( hash )') + ' but activeRoute is set');
        }

        this.setupAutoNavigation();

    }

    stop() {
        if (this.mode === 'history') {
            window.removeEventListener('popstate', this.handlePopState);
        } else {
            window.removeEventListener('hashchange', this.handlePopState);
        }
        // Remove auto-navigation listener
        document.removeEventListener('click', this._autoNavHandler);
    }

    /**
     * Set activeRoute for current path without rendering view
     * Used when starting router with skipInitial = true
     */
    setActiveRouteForCurrentPath(path) {
        // console.log('🔍 setActiveRouteForCurrentPath called with:', path);
        // Remove query string for route matching
        const pathForMatching = path.split('?')[0];
        const match = this.matchRoute(pathForMatching);

        if (match) {
            const { route, params } = match;
            const URLParts = Router.getUrlParts();
            const query = URLParts.query;
            const fragment = URLParts.hash;
            // console.log('✅ Setting activeRoute for current path:', route.path, 'with params:', params);

            // Set activeRoute without rendering
            Router.addActiveRoute(route, match.path, params, query, fragment);
            this.currentRoute = { ...route, $params: params, $query: query, $fragment: fragment, $urlPath: match.path };

            // console.log('✅ activeRoute set successfully:', Router.activeRoute);
        } else {
            console.log('❌ No matching route found for current path:', path);
        }
    }

    /**
     * Setup auto-detect navigation for internal links
     */
    setupAutoNavigation() {
        // console.log('🔍 setupAutoNavigation called');
        // Store reference to handler for removal
        this._autoNavHandler = this.handleAutoNavigation.bind(this);
        document.addEventListener('click', this._autoNavHandler);
        // console.log('✅ Auto-navigation setup complete - event listener added');
    }

    /**
     * Handle auto-detect navigation
     * @param {Event} e - Click event
     */
    handleAutoNavigation(e) {
        // console.log('🔍 handleAutoNavigation called for:', e.target);

        // Check for data-nav-link attribute first (highest priority)
        const oneNavElement = e.target.closest('[data-nav-link]');
        if (oneNavElement) {
            // Check if navigation is disabled
            if (oneNavElement.hasAttribute('data-nav-disabled')) {
                return;
            }

            const navPath = oneNavElement.getAttribute('data-nav-link');

            if (navPath && navPath.trim() !== '') {
                e.preventDefault();
                if (navPath === this.currentUri) {
                    return;
                }
                this.navigate(navPath);
                return;
            }
        }

        // Check for data-navigate attribute (alternative to data-nav-link)
        const navigateElement = e.target.closest('[data-navigate]');
        if (navigateElement) {
            // Check if navigation is disabled
            if (navigateElement.hasAttribute('data-nav-disabled')) {
                return;
            }

            const navPath = navigateElement.getAttribute('data-navigate');

            if (navPath && navPath.trim() !== '') {
                e.preventDefault();
                if (navPath === this.currentUri) {
                    console.log('🚫 Same path - no navigation needed:', navPath);
                    return;
                }
                this.navigate(navPath);
                return;
            }
        }

        // Fallback to traditional <a> tag handling
        const link = e.target.closest('a[href]');
        if (!link) return;
        if(Router.isCurrentPath(link.href, this.mode)){
            return;
        }
        if(this.mode !== "hash" && link.href.startsWith('#')){
            return;
        }
        // Skip if link has target="_blank"
        if (link.target === '_blank') {
            return;
        }

        // Skip if link has data-nav="disabled" or on-nav="false"
        if (link.dataset.nav === 'disabled' || link.getAttribute('data-nav') === 'false') {
            return;
        }

        // Skip if link has data-nav="false" (explicitly disabled)
        if (link.dataset.nav === 'false') {
            return;
        }

        // Skip mailto, tel, and other special protocols
        if (link.href.startsWith('mailto:') || link.href.startsWith('tel:') || link.href.startsWith('javascript:')) {
            return;
        }

        const href = link.href;

        // Check if it's an external URL (different domain)
        try {
            const linkUrl = new URL(href);
            const currentUrl = new URL(window.location.href);

            // If different host, skip (external link)
            if (linkUrl.host !== currentUrl.host) {
                return;
            }
        } catch (error) {
            // If URL parsing fails, treat as internal link
            console.log('⚠️ URL parsing failed, treating as internal:', href);
        }

        // Check if it's a full URL with same domain (and not same path - already checked above)
        if (href.startsWith('http://') || href.startsWith('https://')) {
            try {
                const linkUrl = new URL(href);
                const currentUrl = new URL(window.location.href);

                if (linkUrl.host === currentUrl.host) {
                    // Same domain, extract path with query string for navigation
                    const path = linkUrl.pathname + linkUrl.search;
                    e.preventDefault();
                    if (path === this.currentUri) {
                        return;
                    }
                    this.navigate(path);
                    return;
                }
            } catch (error) {
                console.log('⚠️ URL parsing failed for full URL:', href);
            }
        }

        // Handle relative URLs (and not same path - already checked above)
        if (href && !href.startsWith('http') && !href.startsWith('//')) {
            e.preventDefault();
            if (href === this.currentUri) {
                return;
            }
            this.navigate(href);
            return;
        }

    }
    static getUrlParts() {
        const { location } = window;
        const { search, hash, pathname } = location;
        return {
            url: location.href,
            protocol: location.protocol,
            search: search.startsWith('?') ? search.substring(1) : search,
            path: pathname,
            query: Object.fromEntries(new URLSearchParams(search)),
            hash: hash.startsWith('#') ? hash.substring(1) : hash
        };
    }

    static addActiveRoute(route, urlPath, params, query = {}, fragment = null) {
        if (!route.path) {
            return;
        }
        if (!Router.containers[route.path]) {
            Router.containers[route.path] = new ActiveRoute(route, urlPath, params, query, fragment);
            Router.activeRoute = Router.containers[route.path];
        } else {
            Router.containers[route.path].$urlPath = urlPath;
            Router.containers[route.path].$params = params;
            Router.containers[route.path].$query = query;
            Router.containers[route.path].$fragment = fragment;
            Router.activeRoute = Router.containers[route.path];
        }
    }

    /**
     * Kiểm tra xem URL có khớp với route hiện tại không
     * @param {string} url - URL cần kiểm tra (có thể là rỗng, hash, query, relative, hoặc full URL)
     * @param {string} mode - Chế độ routing: 'history' hoặc 'hash' (mặc định: 'history')
     * @returns {boolean} - true nếu URL khớp với route hiện tại
     * 
     * Xử lý các định dạng URL khác nhau:
     * 
     * Mode 'history':
     * - Chuỗi rỗng: trả về false
     * - Hash fragment (#abc): cùng path (chỉ khác hash fragment)
     * - Query string (?name=value): cùng path (chỉ khác query)
     * - Absolute path (/path/to/page): so sánh pathname và search
     * - Relative path (abc, abc/def): so sánh với segment(s) cuối của current path
     * - Full URL (http://example.com/path): parse và so sánh pathname + search
     * 
     * Mode 'hash':
     * - Chỉ chấp nhận: "/abc...", "abc...", hoặc "[schema]://[host]/#/abc..."
     * - Từ chối: "#abc" (standalone), "?name=value", "http://..." (không có hash)
     * - So sánh với hash path từ window.location.hash
     */
    static isCurrentPath(url, mode = 'history') {
        // Kiểm tra URL rỗng hoặc null
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return false;
        }

        // Lấy route hiện tại
        const route = Router.getActiveRoute();
        if (!route) {
            return false;
        }

        const currentPath = route.getPath();
        if (!currentPath) {
            return false;
        }

        // Chuẩn hóa current path dựa trên mode
        let currentPathname, currentSearch;
        
        // Mode hash: lấy path từ hash thay vì pathname
        if (mode === 'hash') {
            // Trong hash mode, current path được lưu trong hash (bỏ ký tự #)
            const hashPath = window.location.hash.substring(1) || '';
            if (hashPath) {
                const hashParts = hashPath.split('?');
                currentPathname = hashParts[0];
                currentSearch = hashParts[1] ? '?' + hashParts[1] : '';
            } else {
                // Nếu hash rỗng, dùng currentPath làm fallback
                const pathParts = currentPath.split('?');
                currentPathname = pathParts[0];
                currentSearch = pathParts[1] ? '?' + pathParts[1] : '';
            }
        } else {
            // History mode: sử dụng pathname và search từ window.location hoặc currentPath
            try {
                // Thử parse current path như URL (có thể là relative)
                if (currentPath.startsWith('http://') || currentPath.startsWith('https://')) {
                    const currentUrl = new URL(currentPath);
                    currentPathname = currentUrl.pathname;
                    currentSearch = currentUrl.search;
                } else {
                    // Relative path - sử dụng trực tiếp
                    const pathParts = currentPath.split('?');
                    currentPathname = pathParts[0];
                    currentSearch = pathParts[1] ? '?' + pathParts[1] : '';
                }
            } catch (e) {
                // Fallback: sử dụng currentPath trực tiếp
                const pathParts = currentPath.split('?');
                currentPathname = pathParts[0];
                currentSearch = pathParts[1] ? '?' + pathParts[1] : '';
            }
        }

        // Chuẩn hóa input URL
        const normalizedUrl = url.trim();

        // Hash mode: chỉ chấp nhận "/abc...", "abc...", hoặc "[schema]://[host]/#/abc..."
        if (mode === 'hash') {
            // Từ chối standalone hash fragment (#abc không có ://) hoặc query string (?name=value)
            if ((normalizedUrl.startsWith('#') && !normalizedUrl.includes('://')) || 
                normalizedUrl.startsWith('?')) {
                return false;
            }

            let inputPathname, inputSearch;

            // Trường hợp: Full URL với hash [schema]://[host]/#/abc...
            if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
                try {
                    const inputUrl = new URL(normalizedUrl);
                    
                    // Kiểm tra host có khớp với window.location.host không
                    if (inputUrl.host !== window.location.host) {
                        return false; // Host khác nhau
                    }

                    // Trích xuất hash path (bỏ ký tự #)
                    const hashPath = inputUrl.hash.substring(1) || '';
                    if (!hashPath) {
                        return false; // Không có hash path trong URL
                    }

                    // Parse hash path
                    const hashParts = hashPath.split('?');
                    inputPathname = hashParts[0];
                    inputSearch = hashParts[1] ? '?' + hashParts[1] : '';
                } catch (e) {
                    return false; // Định dạng URL không hợp lệ
                }
            } else {
                // Trường hợp: Absolute path (/abc...) hoặc relative path (abc...)
                // Bỏ hash và query để so sánh
                const urlWithoutHash = normalizedUrl.split('#')[0];
                const pathParts = urlWithoutHash.split('?');
                inputPathname = pathParts[0];
                inputSearch = pathParts[1] ? '?' + pathParts[1] : '';
            }

            // So sánh với current hash path
            return currentPathname === inputPathname && currentSearch === inputSearch;
        }

        // History mode: xử lý tất cả các định dạng URL như trước
        // Trường hợp 1: Hash fragment (#abc) - cùng path, chỉ khác hash fragment
        if (normalizedUrl.startsWith('#')) {
            return true; // Cùng path, khác hash fragment
        }

        // Trường hợp 2: Query string (?name=value) - cùng path, chỉ khác query
        if (normalizedUrl.startsWith('?')) {
            return true; // Cùng path, khác query
        }

        // Trường hợp 3: Absolute path (/path/to/page)
        if (normalizedUrl.startsWith('/')) {
            try {
                // Bỏ hash nếu có (trong history mode, hash là fragment)
                const urlWithoutHash = normalizedUrl.split('#')[0];
                const pathParts = urlWithoutHash.split('?');
                const inputPathname = pathParts[0];
                const inputSearch = pathParts[1] ? '?' + pathParts[1] : '';

                // So sánh pathname và search
                return currentPathname === inputPathname && currentSearch === inputSearch;
            } catch (e) {
                // Nếu parse thất bại, so sánh chuỗi đơn giản
                const urlWithoutHash = normalizedUrl.split('#')[0];
                return currentPath === urlWithoutHash || currentPathname === urlWithoutHash;
            }
        }

        // Trường hợp 4: Full URL (http://example.com/path) - chỉ trong history mode
        if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
            try {
                const inputUrl = new URL(normalizedUrl);
                const inputPathname = inputUrl.pathname;
                const inputSearch = inputUrl.search;

                // So sánh với window.location nếu currentPath là relative
                if (!currentPath.startsWith('http://') && !currentPath.startsWith('https://')) {
                    // Current path là relative, so sánh với window.location
                    return window.location.pathname === inputPathname && 
                           window.location.search === inputSearch;
                }

                // Cả hai đều là full URL, so sánh trực tiếp
                return currentPathname === inputPathname && currentSearch === inputSearch;
            } catch (e) {
                return false; // Định dạng URL không hợp lệ
            }
        }

        // Trường hợp 5: Relative path (abc, abc/def, ...) - so sánh với segment(s) cuối của current path
        // Bỏ hash và query từ relative URL
        const relativeUrl = normalizedUrl.split('#')[0].split('?')[0];
        
        // Lấy segment(s) cuối của current pathname
        const currentSegments = currentPathname.split('/').filter(s => s);
        const inputSegments = relativeUrl.split('/').filter(s => s);

        // Nếu input có nhiều segments hơn current, không thể khớp
        if (inputSegments.length > currentSegments.length) {
            return false;
        }

        // So sánh N segments cuối, trong đó N = inputSegments.length
        const startIndex = currentSegments.length - inputSegments.length;
        for (let i = 0; i < inputSegments.length; i++) {
            if (currentSegments[startIndex + i] !== inputSegments[i]) {
                return false;
            }
        }

        return true;
    }

    static getCachedRoute(routePath) {
        return Router.containers[routePath] || null;
    }

    /**
     * Get current route
     * @returns {ActiveRoute} current route
     */
    static getCurrentRoute() {
        return Router.activeRoute || null;
    }
    /**
     * Get active route
     * @returns {ActiveRoute} active route
     */
    static getActiveRoute() {
        return Router.activeRoute || null;
    }
    static getCurrentPath() {
        return window.location.pathname;
    }
    static getCurrentUri() {
        return this.mode === 'history' ? Router.getCurrentPath() : Router.getCurrentHash();
    }
    static getCurrentHash() {
        const fragmentString = window.location.hash.substring(1) || '';
        return fragmentString;
    }
    static getCurrentUrl() {
        return this.mode === 'history' ? Router.getCurrentPath() + window.location.search : Router.getCurrentHash();
    }
    static getCurrentQuery() {
        const query = Object.fromEntries(new URLSearchParams(window.location.search));
        return query;
    }
    static getCurrentFragment() {
        const fragmentString = window.location.hash.substring(1) || '';
        return fragmentString;
    }
}

export default Router;

export const useRoute = () => Router.getCurrentRoute();
export const useParams = () => useRoute()?.getParams() || {};
export const useQuery = () => Router.getCurrentQuery() || {};
export const useFragment = () => Router.getCurrentFragment() || {};