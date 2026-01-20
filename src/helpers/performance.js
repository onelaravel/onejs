/**
 * Performance Utilities
 * Debounce, throttle, and other performance optimization helpers
 * 
 * @module helpers/performance
 * @author OneLaravel Team
 * @since 2025-12-29
 */

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last invocation
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Debounced function
 * 
 * @example
 * const handleSearch = debounce((query) => {
 *   api.search(query);
 * }, 300);
 * 
 * input.addEventListener('input', (e) => handleSearch(e.target.value));
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle function - ensures function is called at most once per time period
 * 
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds (default: 100)
 * @returns {Function} Throttled function
 * 
 * @example
 * const handleScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 * 
 * window.addEventListener('scroll', handleScroll);
 */
export function throttle(fn, limit = 100) {
  let inThrottle;
  
  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Request Animation Frame wrapper for smooth animations
 * 
 * @param {Function} fn - Function to execute on next frame
 * @returns {Function} RAF-wrapped function
 * 
 * @example
 * const updateAnimation = raf(() => {
 *   element.style.transform = `translateX(${x}px)`;
 * });
 */
export function raf(fn) {
  let rafId;
  
  return function rafWrapped(...args) {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
    });
  };
}

/**
 * Memoize function results for performance
 * 
 * @param {Function} fn - Function to memoize
 * @param {Function} keyFn - Optional function to generate cache key
 * @returns {Function} Memoized function
 * 
 * @example
 * const expensiveCalc = memoize((n) => {
 *   return fibonacci(n);
 * });
 */
export function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  
  return function memoized(...args) {
    const key = keyFn(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Batch DOM reads and writes to prevent layout thrashing
 * 
 * @example
 * const batcher = new DOMBatcher();
 * 
 * // Schedule reads
 * batcher.read(() => {
 *   const height = element.offsetHeight;
 * });
 * 
 * // Schedule writes
 * batcher.write(() => {
 *   element.style.height = `${newHeight}px`;
 * });
 */
export class DOMBatcher {
  constructor() {
    this.readQueue = [];
    this.writeQueue = [];
    this.scheduled = false;
  }
  
  /**
   * Schedule a DOM read operation
   * @param {Function} fn - Read operation
   */
  read(fn) {
    this.readQueue.push(fn);
    this.schedule();
  }
  
  /**
   * Schedule a DOM write operation
   * @param {Function} fn - Write operation
   */
  write(fn) {
    this.writeQueue.push(fn);
    this.schedule();
  }
  
  /**
   * Schedule batch execution
   * @private
   */
  schedule() {
    if (this.scheduled) return;
    
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.flush();
    });
  }
  
  /**
   * Execute all queued operations
   * @private
   */
  flush() {
    // Execute all reads first
    while (this.readQueue.length > 0) {
      const fn = this.readQueue.shift();
      fn();
    }
    
    // Then execute all writes
    while (this.writeQueue.length > 0) {
      const fn = this.writeQueue.shift();
      fn();
    }
    
    this.scheduled = false;
  }
}

/**
 * Measure and log performance of a function
 * 
 * @param {string} label - Label for the measurement
 * @param {Function} fn - Function to measure
 * @returns {*} Result of the function
 * 
 * @example
 * const result = measurePerformance('render', () => {
 *   return view.render();
 * });
 */
export function measurePerformance(label, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (typeof result?.then === 'function') {
    return result.then((value) => {
      console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms (async)`);
      return value;
    });
  }
  
  console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  return result;
}

export default {
  debounce,
  throttle,
  raf,
  memoize,
  DOMBatcher,
  measurePerformance,
};
