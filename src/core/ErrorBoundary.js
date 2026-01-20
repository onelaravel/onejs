/**
 * Error Boundary System
 * Provides error handling and fallback UI for views
 * 
 * @module core/ErrorBoundary
 * @author OneLaravel Team
 * @since 2025-12-29
 */

import logger from './services/LoggerService.js';

/**
 * Error Boundary for Views
 * Catches errors during view lifecycle and provides fallback UI
 * 
 * @class ViewErrorBoundary
 * 
 * @example
 * const errorBoundary = new ViewErrorBoundary(view);
 * const result = errorBoundary.wrap(() => view.render());
 */
export class ViewErrorBoundary {
  /**
   * Create error boundary
   * @param {ViewController} controller - View controller instance
   */
  constructor(controller) {
    this.controller = controller;
    this.view = controller.view;
    this.hasError = false;
    this.error = null;
    this.errorInfo = null;
  }

  /**
   * Wrap a function with error handling
   * 
   * @param {Function} fn - Function to wrap
   * @param {string} phase - Lifecycle phase name
   * @returns {*} Function result or error fallback
   * 
   * @example
   * const html = errorBoundary.wrap(() => view.render(), 'render');
   */
  wrap(fn, phase = 'execution') {
    try {
      const result = fn();
      
      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.catch(error => {
          return this.handleError(error, { phase, async: true });
        });
      }
      
      return result;
    } catch (error) {
      return this.handleError(error, { phase, async: false });
    }
  }

  /**
   * Handle caught error
   * 
   * @param {Error} error - The error object
   * @param {Object} errorInfo - Additional error information
   * @returns {string} Error fallback HTML
   * 
   * @private
   */
  handleError(error, errorInfo = {}) {
    this.hasError = true;
    this.error = error;
    this.errorInfo = errorInfo;

    // Log error
    logger.error('View Error Boundary:', {
      view: this.controller.path,
      viewId: this.controller.id,
      phase: errorInfo.phase,
      error: error.message,
      stack: error.stack,
      ...errorInfo
    });

    // Call error lifecycle hook if exists
    if (typeof this.controller.onError === 'function') {
      try {
        this.controller.onError(error, errorInfo);
      } catch (hookError) {
        logger.error('Error in onError hook:', hookError);
      }
    }

    // Return fallback UI
    return this.renderErrorFallback(error, errorInfo);
  }

  /**
   * Render error fallback UI
   * 
   * @param {Error} error - The error object
   * @param {Object} errorInfo - Additional error information
   * @returns {string} Error HTML
   * 
   * @private
   */
  renderErrorFallback(error, errorInfo) {
    const isDev = this.controller.App?.env?.debug || false;
    const viewPath = this.controller.path || 'unknown';
    const phase = errorInfo.phase || 'unknown';

    if (isDev) {
      // Development mode - show detailed error
      return `
        <div class="error-boundary dev-error" style="
          padding: 20px;
          margin: 20px 0;
          background: #fee;
          border: 2px solid #c33;
          border-radius: 8px;
          font-family: monospace;
        ">
          <h3 style="color: #c33; margin: 0 0 10px 0;">
            ⚠️ Error in View: ${viewPath}
          </h3>
          <p style="margin: 5px 0;"><strong>Phase:</strong> ${phase}</p>
          <p style="margin: 5px 0;"><strong>Message:</strong> ${error.message}</p>
          ${error.stack ? `
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #c33;">
                Stack Trace
              </summary>
              <pre style="
                background: #f5f5f5;
                padding: 10px;
                overflow-x: auto;
                margin-top: 10px;
              ">${error.stack}</pre>
            </details>
          ` : ''}
          <p style="margin-top: 15px; color: #666; font-size: 0.9em;">
            This detailed error is only visible in development mode.
          </p>
        </div>
      `;
    } else {
      // Production mode - show generic error
      return `
        <div class="error-boundary prod-error" style="
          padding: 20px;
          margin: 20px 0;
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
          text-align: center;
        ">
          <h3 style="color: #666; margin: 0 0 10px 0;">
            Something went wrong
          </h3>
          <p style="color: #999;">
            We're sorry, but something went wrong while loading this content.
            Please try refreshing the page.
          </p>
        </div>
      `;
    }
  }

  /**
   * Reset error boundary state
   */
  reset() {
    this.hasError = false;
    this.error = null;
    this.errorInfo = null;
  }

  /**
   * Check if boundary has caught an error
   * @returns {boolean}
   */
  get hasCaughtError() {
    return this.hasError;
  }
}

/**
 * Global error handler for uncaught errors
 * 
 * @param {Application} App - App instance
 * @param {Function} customHandler - Custom error handler
 */
export function setupGlobalErrorHandler(App, customHandler = null) {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logger.error('Uncaught Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });

    if (customHandler) {
      customHandler(event.error, { type: 'uncaught', event });
    }
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: event.reason,
      promise: event.promise
    });

    if (customHandler) {
      customHandler(event.reason, { type: 'rejection', event });
    }
  });
}

export default {
  ViewErrorBoundary,
  setupGlobalErrorHandler,
};
