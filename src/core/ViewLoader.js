/**
 * Dynamic View Loader
 * Provides lazy loading and code splitting for views
 * 
 * @module core/ViewLoader
 * @author OneLaravel Team
 * @since 2025-12-29
 */

import logger from './services/LoggerService.js';
import { warn, invariant } from '../helpers/devWarnings.js';

/**
 * View Loader - Handles dynamic view loading with caching
 * 
 * @class ViewLoader
 * 
 * @example
 * const loader = new ViewLoader();
 * const ViewClass = await loader.load('web.pages.home');
 */
export class ViewLoader {
  constructor() {
    /**
     * @type {Map<string, Function>}
     * @private
     */
    this.viewCache = new Map();
    /**
     * @type {Object}
     * @private
     */
    this.registry = {};    
    /**
     * @type {Map<string, Promise<Function>>}
     * @private
     */
    this.loadingPromises = new Map();
    
    /**
     * @type {Map<string, string>}
     * @private
     */
    this.viewPathMap = new Map();
  }

  /**
   * Set view registry
   * @param {Object} registry
   */
  setRegistry(registry) {
    this.registry = registry;
  }

  /**
   * Register a view path mapping
   * 
   * @param {string} viewPath - View path (e.g., 'web.pages.home')
   * @param {string} filePath - File path (e.g., './views/WebPagesHome.js')
   * 
   * @example
   * loader.register('web.pages.home', './views/WebPagesHome.js');
   */
  register(viewPath, filePath) {
    this.viewPathMap.set(viewPath, filePath);
  }

  /**
   * Register multiple view mappings
   * 
   * @param {Object<string, string>} mappings - View path to file path mappings
   * 
   * @example
   * loader.registerBulk({
   *   'web.pages.home': './views/WebPagesHome.js',
   *   'web.pages.about': './views/WebPagesAbout.js',
   * });
   */
  registerBulk(mappings) {
    Object.entries(mappings).forEach(([viewPath, filePath]) => {
      this.register(viewPath, filePath);
    });
  }

  /**
   * Load a view dynamically
   * 
   * @param {string} viewPath - View path
   * @returns {Promise<Function>} View class/function
   * @throws {Error} If view cannot be loaded
   * 
   * @example
   * const ViewClass = await loader.load('web.pages.home');
   * const view = ViewClass(data, systemData);
   */
  async load(viewPath) {
    invariant(viewPath, 'View path is required');

    // Check cache first
    if (this.viewCache.has(viewPath)) {
      logger.debug(`[ViewLoader] Loading from cache: ${viewPath}`);
      return this.viewCache.get(viewPath);
    }

    // Check if already loading
    if (this.loadingPromises.has(viewPath)) {
      logger.debug(`[ViewLoader] Waiting for in-progress load: ${viewPath}`);
      return this.loadingPromises.get(viewPath);
    }

    // Get file path
    const filePath = this.viewPathMap.get(viewPath);
    
    if (!filePath) {
      warn(false, `View path not registered: ${viewPath}`);
      throw new Error(`[ViewLoader] View not found: ${viewPath}`);
    }

    // Create loading promise
    const loadingPromise = this._loadViewModule(viewPath, filePath);
    this.loadingPromises.set(viewPath, loadingPromise);

    try {
      const ViewClass = await loadingPromise;
      
      // Cache the loaded view
      this.viewCache.set(viewPath, ViewClass);
      logger.debug(`[ViewLoader] Successfully loaded: ${viewPath}`);
      
      return ViewClass;
    } catch (error) {
      logger.error(`[ViewLoader] Failed to load view: ${viewPath}`, error);
      throw error;
    } finally {
      // Remove from loading promises
      this.loadingPromises.delete(viewPath);
    }
  }

  /**
   * Load view module using dynamic import from registry
   * 
   * @param {string} viewPath - View path
   * @param {string} filePath - File path (kept for backward compatibility)
   * @returns {Promise<Function>} View class/function
   * @private
   */
  async _loadViewModule(viewPath, filePath) {
    logger.debug(`[ViewLoader] Loading module: ${viewPath}`);
    
    try {
      // Use this.registry for static analysis by webpack
      const importFn = this.registry[viewPath];
      
      if (!importFn) {
        const errorMsg = `View "${viewPath}" not found in registry. Make sure view is registered via setRegistry()`;
        logger.error(`[ViewLoader] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Load from registry (webpack can analyze this statically)
      const module = await importFn();
      
      // Get the view function from module
      const ViewClass = module.default || module[this._getFunctionName(viewPath)];
      
      if (!ViewClass) {
        throw new Error(`View function not found in module: ${viewPath}`);
      }
      
      return ViewClass;
    } catch (error) {
      logger.error(`[ViewLoader] Import failed: ${viewPath}`, error);
      throw new Error(`Failed to load view module: ${error.message}`);
    }
  }

  /**
   * Convert view path to function name
   * 
   * @param {string} viewPath - View path (e.g., 'web.pages.home')
   * @returns {string} Function name (e.g., 'WebPagesHome')
   * @private
   */
  _getFunctionName(viewPath) {
    return viewPath
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Preload views for better performance
   * 
   * @param {Array<string>} viewPaths - View paths to preload
   * @returns {Promise<void>}
   * 
   * @example
   * await loader.preload(['web.pages.home', 'web.pages.about']);
   */
  async preload(viewPaths) {
    logger.debug('[ViewLoader] Preloading views:', viewPaths);
    
    const promises = viewPaths.map(viewPath => {
      return this.load(viewPath).catch(error => {
        logger.warn(`[ViewLoader] Failed to preload: ${viewPath}`, error);
      });
    });
    
    await Promise.all(promises);
  }

  /**
   * Clear cache for a specific view or all views
   * 
   * @param {string} [viewPath] - View path (if omitted, clears all)
   * 
   * @example
   * loader.clearCache('web.pages.home'); // Clear specific view
   * loader.clearCache(); // Clear all
   */
  clearCache(viewPath = null) {
    if (viewPath) {
      this.viewCache.delete(viewPath);
      logger.debug(`[ViewLoader] Cleared cache: ${viewPath}`);
    } else {
      this.viewCache.clear();
      logger.debug('[ViewLoader] Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cached: this.viewCache.size,
      loading: this.loadingPromises.size,
      registered: this.viewPathMap.size,
    };
  }

  /**
   * Check if view is cached
   * 
   * @param {string} viewPath - View path
   * @returns {boolean}
   */
  isCached(viewPath) {
    return this.viewCache.has(viewPath);
  }

  /**
   * Check if view is currently loading
   * 
   * @param {string} viewPath - View path
   * @returns {boolean}
   */
  isLoading(viewPath) {
    return this.loadingPromises.has(viewPath);
  }
}

/**
 * Global view loader instance
 * @type {ViewLoader}
 */
export const viewLoader = new ViewLoader();

export default viewLoader;
