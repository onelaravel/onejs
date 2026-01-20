/**
 * TemplateHelper
 * Handles template wrapping and block logic
 */
import { ATTR } from '../ViewConfig.js';

export default class TemplateHelper {
    static wrapperAttribute(controller) {
        return ` ${ATTR.KEYS.VIEW_WRAPPER}="${controller.id}"`;
    }
}
