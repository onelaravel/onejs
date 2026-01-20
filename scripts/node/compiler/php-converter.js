/**
 * Convert PHP expressions to JavaScript
 */

const { JS_FUNCTION_PREFIX } = require('./config');
const { normalizeQuotes } = require('./utils');

function convertPhpArrayToJson(expr) {
    /** Convert PHP array syntax to JSON object/array syntax */
    if (!expr || !expr.includes('[')) {
        return expr;
    }
    
    // Find all array patterns and convert them
    function replaceArray(match) {
        const inner = match[1].trim();
        if (!inner) {
            return '[]';
        }
        
        // Check if this is array access vs array literal
        if ((("'" in inner && (inner.match(/'/g) || []).length === 2 && !inner.includes('=>')) || 
            ('"' in inner && (inner.match(/"/g) || []).length === 2 && !inner.includes('=>')) || 
            (inner.replace(/[_\.]/g, '').match(/^\w+$/) && !inner.includes('=>')))) {
            return '[' + inner + ']'; // Keep as array access
        }
        
        // Process array elements
        const elements = [];
        let currentElement = '';
        let parenCount = 0;
        let bracketCount = 0;
        let inQuotes = false;
        let quoteChar = '';
        let i = 0;
        
        while (i < inner.length) {
            const char = inner[i];
            
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (!inQuotes) {
                if (char === '(') {
                    parenCount += 1;
                } else if (char === ')') {
                    parenCount -= 1;
                } else if (char === '[') {
                    bracketCount += 1;
                } else if (char === ']') {
                    bracketCount -= 1;
                } else if (char === ',' && parenCount === 0 && bracketCount === 0) {
                    elements.push(currentElement.trim());
                    currentElement = '';
                    i++;
                    continue;
                }
            }
            
            currentElement += char;
            i++;
        }
        
        if (currentElement.trim()) {
            elements.push(currentElement.trim());
        }
        
        // Process each element
        const processedElements = elements.map(element => {
            element = element.trim();
            
            // Check if it's a key => value pair
            if (element.includes('=>')) {
                const arrowIndex = element.indexOf('=>');
                const key = element.substring(0, arrowIndex).trim();
                const value = element.substring(arrowIndex + 2).trim();
                
                // Process key
                let processedKey = key;
                if ((key.startsWith("'") && key.endsWith("'")) || 
                    (key.startsWith('"') && key.endsWith('"'))) {
                    processedKey = key; // Keep as string literal
                } else if (key.match(/^\d+$/)) {
                    processedKey = key; // Keep as number
                } else {
                    processedKey = `"${key}"`; // Convert to string
                }
                
                // Process value
                const processedValue = convertPhpArrayToJson(value);
                
                return `${processedKey}: ${processedValue}`;
            } else {
                return convertPhpArrayToJson(element);
            }
        });
        
        // Check if all elements are key-value pairs
        const hasKeyValuePairs = elements.some(element => element.includes('=>'));
        
        if (hasKeyValuePairs) {
            return `{${processedElements.join(', ')}}`;
        } else {
            return `[${processedElements.join(', ')}]`;
        }
    }
    
    // Replace array patterns
    return expr.replace(/\[(.*?)\]/g, replaceArray);
}

function phpToJs(phpCode) {
    /** Convert PHP code to JavaScript */
    if (!phpCode) return phpCode;
    
    let jsCode = phpCode;
    
    // Convert PHP variables ($var -> var)
    jsCode = jsCode.replace(/\$(\w+)/g, '$1');
    
    // Convert PHP array syntax to JavaScript
    jsCode = convertPhpArrayToJson(jsCode);
    
    // Convert PHP function calls to JavaScript
    jsCode = jsCode.replace(/App\.Helper\.(\w+)/g, `${JS_FUNCTION_PREFIX}.Helper.$1`);
    
    // Convert PHP string concatenation
    jsCode = jsCode.replace(/\s*\.\s*/g, ' + ');
    
    // Normalize quotes
    jsCode = normalizeQuotes(jsCode);
    
    return jsCode;
}

function phpToJsAdvanced(phpCode) {
    /** Advanced PHP to JavaScript conversion */
    if (!phpCode) return phpCode;
    
    let jsCode = phpCode;
    
    // Convert PHP variables
    jsCode = jsCode.replace(/\$(\w+)/g, '$1');
    
    // Convert PHP array syntax
    jsCode = convertPhpArrayToJson(jsCode);
    
    // Convert PHP operators
    jsCode = jsCode.replace(/===/g, '===');
    jsCode = jsCode.replace(/!==/g, '!==');
    jsCode = jsCode.replace(/&&/g, '&&');
    jsCode = jsCode.replace(/\|\|/g, '||');
    
    // Convert PHP function calls
    jsCode = jsCode.replace(/App\.Helper\.(\w+)/g, `${JS_FUNCTION_PREFIX}.Helper.$1`);
    jsCode = jsCode.replace(/App\.View\.(\w+)/g, `${JS_FUNCTION_PREFIX}.$1`);
    
    // Convert string concatenation
    jsCode = jsCode.replace(/\s*\.\s*/g, ' + ');
    
    // Convert PHP null coalescing operator
    jsCode = jsCode.replace(/\?\?/g, '||');
    
    // Convert PHP ternary operator
    jsCode = jsCode.replace(/\?\s*([^:]+)\s*:\s*([^;]+)/g, '? $1 : $2');
    
    // Normalize quotes
    jsCode = normalizeQuotes(jsCode);
    
    return jsCode;
}

function convertPhpExpression(expr) {
    /** Convert PHP expression to JavaScript expression */
    if (!expr) return expr;
    
    // Handle different types of expressions
    if (expr.includes('[') && expr.includes(']')) {
        // Array expression
        return convertPhpArrayToJson(expr);
    } else if (expr.includes('$')) {
        // Variable expression
        return phpToJs(expr);
    } else {
        // Simple expression
        return expr;
    }
}

function isPhpExpression(expr) {
    /** Check if expression contains PHP syntax */
    return expr.includes('$') || expr.includes('[') || expr.includes('=>');
}

function escapePhpString(str) {
    /** Escape PHP string for JavaScript */
    return str.replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
}

function unescapePhpString(str) {
    /** Unescape PHP string */
    return str.replace(/\\\\/g, '\\')
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
}

module.exports = {
    convertPhpArrayToJson,
    phpToJs,
    phpToJsAdvanced,
    convertPhpExpression,
    isPhpExpression,
    escapePhpString,
    unescapePhpString
};

