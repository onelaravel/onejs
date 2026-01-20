/**
 * Development Warnings Helper
 * Provides helpful warnings during development without impacting production
 * 
 * @module helpers/devWarnings
 * @author OneLaravel Team
 * @since 2025-12-29
 */

/**
 * Check if running in development mode
 * @returns {boolean}
 */
function isDevelopment() {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
}

/**
 * Warn if condition is false (development only)
 * 
 * @param {boolean} condition - Condition to check
 * @param {string} message - Warning message
 * @param {*} data - Optional additional data
 * 
 * @example
 * warn(view.mounted, 'Accessing view before mount');
 * warn(!circularRef, 'Circular reference detected', { view: view.path });
 */
export function warn(condition, message, data = null) {
  if (!condition && isDevelopment()) {
    const fullMessage = `[OneLaravel Warning] ${message}`;
    
    if (data) {
      console.warn(fullMessage, data);
    } else {
      console.warn(fullMessage);
    }
    
    // Show stack trace in development
    if (console.trace) {
      console.trace();
    }
  }
}

/**
 * Deprecation warning
 * 
 * @param {string} oldName - Deprecated feature name
 * @param {string} newName - Replacement feature name
 * @param {string} version - Version when it will be removed
 * 
 * @example
 * deprecate('ViewEngine', 'ViewController', '2.0.0');
 */
export function deprecate(oldName, newName, version = '2.0.0') {
  if (isDevelopment()) {
    console.warn(
      `[OneLaravel Deprecation] ${oldName} is deprecated and will be removed in v${version}. ` +
      `Use ${newName} instead.`
    );
  }
}

/**
 * Invariant check - throws error if condition is false
 * Used for critical checks that should never fail
 * 
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message
 * @throws {Error}
 * 
 * @example
 * invariant(App, 'App instance is required');
 * invariant(viewId, 'View ID cannot be null');
 */
export function invariant(condition, message) {
  if (!condition) {
    throw new Error(`[OneLaravel Invariant] ${message}`);
  }
}

/**
 * Log info message (development only)
 * 
 * @param {string} message - Info message
 * @param {*} data - Optional data
 */
export function devLog(message, data = null) {
  if (isDevelopment()) {
    if (data) {
      console.log(`[OneLaravel] ${message}`, data);
    } else {
      console.log(`[OneLaravel] ${message}`);
    }
  }
}

/**
 * Assert type at runtime (development only)
 * 
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type
 * @param {string} name - Variable name
 * 
 * @example
 * assertType(viewId, 'string', 'viewId');
 * assertType(config, 'object', 'config');
 */
export function assertType(value, expectedType, name) {
  if (!isDevelopment()) return;
  
  const actualType = typeof value;
  
  if (actualType !== expectedType) {
    console.warn(
      `[OneLaravel Type Warning] Expected ${name} to be ${expectedType}, ` +
      `but got ${actualType}`,
      { value }
    );
  }
}

/**
 * Check for circular references (development only)
 * 
 * @param {Object} obj - Object to check
 * @param {string} path - Object path for error message
 * @returns {boolean} True if circular reference detected
 * 
 * @example
 * if (checkCircular(view, 'view')) {
 *   warn(false, 'Circular reference in view');
 * }
 */
export function checkCircular(obj, path = 'root') {
  if (!isDevelopment()) return false;
  
  const seen = new WeakSet();
  
  function detect(obj, currentPath) {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        console.warn(
          `[OneLaravel Circular Reference] Detected at ${currentPath}`
        );
        return true;
      }
      
      seen.add(obj);
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (detect(obj[key], `${currentPath}.${key}`)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  return detect(obj, path);
}

/**
 * Performance warning if execution time exceeds threshold
 * 
 * @param {Function} fn - Function to measure
 * @param {string} label - Label for measurement
 * @param {number} threshold - Threshold in ms (default: 16ms for 60fps)
 * @returns {*} Function result
 * 
 * @example
 * warnIfSlow(() => view.render(), 'render', 16);
 */
export function warnIfSlow(fn, label, threshold = 16) {
  if (!isDevelopment()) {
    return fn();
  }
  
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (duration > threshold) {
    console.warn(
      `[OneLaravel Performance] ${label} took ${duration.toFixed(2)}ms ` +
      `(threshold: ${threshold}ms)`
    );
  }
  
  return result;
}

export default {
  warn,
  deprecate,
  invariant,
  devLog,
  assertType,
  checkCircular,
  warnIfSlow,
};
