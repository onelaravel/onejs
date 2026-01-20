/**
 * Event directive processor
 */

class EventDirectiveProcessor {
    constructor() {
        // No initialization needed
    }

    processEventDirective(eventType, expression) {
        /** Process event directive */
        try {
            // Parse expression to extract handlers
            const handlers = this.parseEventHandlers(expression);
            
            if (!handlers || handlers.length === 0) {
                return '';
            }
            
            // Build event config
            const eventConfig = this.buildEventConfig(eventType, handlers);
            
            // Return event config with template string wrapper
            return `\${${eventConfig}}`;
                   
        } catch (error) {
            console.error(`Event directive error: ${error.message}`);
            return '';
        }
    }

    parseEventHandlers(expression) {
        /** Parse multiple event handlers from expression */
        const handlers = [];
        
        // Split by comma, respecting nested parentheses
        const handlerStrings = this.splitByComma(expression);
        
        for (const handlerString of handlerStrings) {
            const trimmed = handlerString.trim();
            if (!trimmed) {
                continue;
            }
                
            // Parse handler name and parameters
            const handler = this.parseHandler(trimmed);
            if (handler) {
                handlers.push(handler);
            }
        }
        
        return handlers;
    }

    parseHandler(handlerString) {
        /** Parse handler name and parameters */
        const parenIndex = handlerString.indexOf('(');
        
        if (parenIndex === -1) {
            // No parameters
            return {
                handler: handlerString.trim(),
                params: []
            };
        }
        
        const handlerName = handlerString.substring(0, parenIndex).trim();
        const paramsString = handlerString.substring(parenIndex + 1, handlerString.lastIndexOf(')'));
        
        const params = this.parseHandlerParameters(paramsString);
        
        return {
            handler: handlerName,
            params: params
        };
    }

    parseHandlerParameters(paramsString) {
        /** Parse handler parameters */
        if (!paramsString.trim()) {
            return [];
        }
        
        const params = this.splitByComma(paramsString);
        const processedParams = [];
        
        for (const param of params) {
            const processedParam = this.processParameter(param.trim());
            processedParams.push(processedParam);
        }
        
        return processedParams;
    }

    processParameter(param) {
        /** Process individual parameter */
        // Handle Event parameters in all contexts first
        param = this.processEventInString(param);
        
        // Handle @attr(...) -> "#ATTR:..."
        param = this.processAttrPropInString(param, '@attr', '#ATTR');
        
        // Handle @prop(...) -> "#PROP:..."
        param = this.processAttrPropInString(param, '@prop', '#PROP');
        
        // Handle @val(...) -> "#VALUE:..."
        param = this.processAttrPropInString(param, '@val', '#VALUE');
        
        // Handle @value(...) -> "#VALUE:..."
        param = this.processAttrPropInString(param, '@value', '#VALUE');
        
        // Convert PHP array syntax to JavaScript object syntax
        param = this.convertPhpArrayToJsObject(param);
        
        return param;
    }

    processEventInString(str) {
        /** Process Event parameters */
        return str.replace(/Event/g, '@EVENT');
    }

    processAttrPropInString(str, prefix, replacement) {
        /** Process @attr/@prop/@val/@value parameters */
        const regex = new RegExp(`${prefix}\\(([^)]+)\\)`, 'g');
        return str.replace(regex, (match, content) => {
            return `${replacement}:${content}`;
        });
    }

    convertPhpArrayToJsObject(phpCode) {
        /** Convert PHP array syntax to JavaScript object syntax */
        // Simple conversion for now
        return phpCode.replace(/\$(\w+)/g, '$1');
    }

    splitByComma(text) {
        /** Split text by comma, respecting nested parentheses and quotes */
        const result = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            } else if (!inQuotes && char === '(') {
                depth++;
            } else if (!inQuotes && char === ')') {
                depth--;
            } else if (!inQuotes && depth === 0 && char === ',') {
                result.push(current.trim());
                current = '';
                continue;
            }
            
            current += char;
        }
        
        if (current.trim()) {
            result.push(current.trim());
        }
        
        return result;
    }

    buildEventConfig(eventType, handlers) {
        /** Build event config */
        const handlersJson = JSON.stringify(handlers);
        return `self.addEventConfig("${eventType}", ${handlersJson})`;
    }
}

module.exports = EventDirectiveProcessor;

