/**
 * ConfigHelper
 * Handles configuration processing
 */
import { __defineProps, __defineMethods } from '../../helpers/utils.js';

export default class ConfigHelper {
    static processDefinedProperties(controller, config) {
        let definedProps = {};
        let definedMethods = {};

        if (config.__props__ && config.__props__.length > 0) {
            config.__props__.forEach(prop => {
                if (typeof config[prop] === 'function') {
                    definedMethods[prop] = config[prop].bind(controller);
                }
                else if (typeof config[prop] !== 'undefined') {
                    definedProps[prop] = config[prop];
                }
            });
        }

        __defineProps(controller, definedProps, {
            writable: true,
            configurable: true,
            enumerable: true,
        });

        __defineMethods(controller, definedMethods);
    }

    static commitConstructorData(controller) {
        if (typeof controller.config.commitConstructorData === 'function') {
            controller.config.commitConstructorData.call(controller.view);
        }
    }
}
