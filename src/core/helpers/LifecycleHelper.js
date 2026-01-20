/**
 * LifecycleHelper
 * Handles lifecycle methods call
 */
import logger from '../services/LoggerService.js';

export default class LifecycleHelper {
    static callHook(controller, hookName) {
        if (typeof controller.view[hookName] === 'function') {
            try {
                controller.view[hookName]();
            } catch (e) {
                logger.error(`Error in lifecycle hook ${hookName} for ${controller.path}`, e);
            }
        }
    }
}
