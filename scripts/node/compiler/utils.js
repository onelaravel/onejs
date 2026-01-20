/**
 * Utility functions for the compiler
 */

function extractBalancedParentheses(text, startPos) {
    /** Extract content inside balanced parentheses starting from startPos */
    if (startPos >= text.length || text[startPos] !== '(') {
        return [null, startPos];
    }
    
    let parenCount = 0;
    const contentStart = startPos + 1;
    let i = startPos;
    
    while (i < text.length) {
        if (text[i] === '(') {
            parenCount += 1;
        } else if (text[i] === ')') {
            parenCount -= 1;
            if (parenCount === 0) {
                const content = text.substring(contentStart, i);
                return [content, i + 1];
            }
        }
        i += 1;
    }
    
    // Unbalanced parentheses
    return [text.substring(contentStart), text.length];
}

function formatAttrs(attrsDict) {
    /** Format attributes dictionary to JavaScript object string */
    return JSON.stringify(attrsDict);
}

function normalizeQuotes(expr) {
    /** Normalize single quotes to double quotes in JSON */
    if (!expr) {
        return expr;
    }
    
    // Replace single quotes with double quotes, but be careful with nested quotes
    return expr.replace(/'([^']*)'/g, '"$1"');
}

function formatJsOutput(content, indentLevel = 0) {
    /** Format JavaScript output with proper indentation */
    const lines = content.split('\n');
    const formattedLines = [];
    
    for (const line of lines) {
        if (line.trim()) {
            formattedLines.push('    '.repeat(indentLevel) + line.trim());
        } else {
            formattedLines.push('');
        }
    }
    
    return formattedLines.join('\n');
}

function splitByComma(text) {
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

function escapeRegex(string) {
    /** Escape special regex characters */
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function camelCase(str) {
    /** Convert string to camelCase */
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

function kebabCase(str) {
    /** Convert string to kebab-case */
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function snakeCase(str) {
    /** Convert string to snake_case */
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function pascalCase(str) {
    /** Convert string to PascalCase */
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
        return word.toUpperCase();
    }).replace(/\s+/g, '');
}

function indent(text, level = 1, char = '    ') {
    /** Add indentation to text */
    const indentStr = char.repeat(level);
    return text.split('\n').map(line => line ? indentStr + line : line).join('\n');
}

function dedent(text) {
    /** Remove common leading whitespace from text */
    const lines = text.split('\n');
    const minIndent = lines
        .filter(line => line.trim())
        .reduce((min, line) => Math.min(min, line.match(/^\s*/)[0].length), Infinity);
    
    return lines.map(line => line.substring(minIndent)).join('\n');
}

function replaceAll(str, replacements, startDelim = '{', endDelim = '}') {
    /** Replace all placeholders in string with values from object */
    if (typeof replacements !== 'object' || replacements === null) {
        return str;
    }
    
    let result = str;
    const regex = new RegExp(`${escapeRegex(startDelim)}([^${escapeRegex(endDelim)}]+)${escapeRegex(endDelim)}`, 'g');
    
    return result.replace(regex, (match, key) => {
        const trimmedKey = key.trim();
        return replacements.hasOwnProperty(trimmedKey) ? replacements[trimmedKey] : match;
    });
}

function isString(value) {
    /** Check if value is string */
    return typeof value === 'string';
}

function isObject(value) {
    /** Check if value is object (but not null or array) */
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isArray(value) {
    /** Check if value is array */
    return Array.isArray(value);
}

function isEmpty(value) {
    /** Check if value is empty */
    if (value === null || value === undefined) return true;
    if (isString(value)) return value.length === 0;
    if (isArray(value)) return value.length === 0;
    if (isObject(value)) return Object.keys(value).length === 0;
    return false;
}

module.exports = {
    extractBalancedParentheses,
    formatAttrs,
    normalizeQuotes,
    formatJsOutput,
    splitByComma,
    escapeRegex,
    camelCase,
    kebabCase,
    snakeCase,
    pascalCase,
    indent,
    dedent,
    replaceAll,
    isString,
    isObject,
    isArray,
    isEmpty
};

