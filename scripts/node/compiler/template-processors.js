/**
 * Template Processors
 * Handles template line processing and directives
 */

class TemplateProcessors {
    constructor() {
        // Initialize processors
    }

    /**
     * Process template line
     * Handles @serverside and @clientside directives
     */
    processTemplateLine(line) {
        if (!line || typeof line !== 'string') {
            return line;
        }

        // Process server-side content
        let processed = this.processServersideDirective(line);
        
        // Process client-side content
        processed = this.processClientsideDirective(processed);
        
        return processed;
    }

    /**
     * Process @serverside directive
     * Replaces @serverside(...) with its content
     */
    processServersideDirective(line) {
        const pattern = /@serverside\s*\(/g;
        let match;
        let result = line;
        
        while ((match = pattern.exec(result)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const content = this._extractBalancedParentheses(result, startPos);
            
            if (content !== null) {
                // Replace @serverside(...) with just the content
                const fullMatch = result.substring(match.index, startPos + content.length + 2);
                result = result.replace(fullMatch, content);
                pattern.lastIndex = 0; // Reset regex
            } else {
                break;
            }
        }
        
        return result;
    }

    /**
     * Process @clientside directive
     * Replaces @clientside(...) with empty string (client-only content)
     */
    processClientsideDirective(line) {
        const pattern = /@clientside\s*\(/g;
        let match;
        let result = line;
        
        while ((match = pattern.exec(result)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const content = this._extractBalancedParentheses(result, startPos);
            
            if (content !== null) {
                // Remove @clientside(...) entirely for SSR
                const fullMatch = result.substring(match.index, startPos + content.length + 2);
                result = result.replace(fullMatch, '');
                pattern.lastIndex = 0; // Reset regex
            } else {
                break;
            }
        }
        
        return result;
    }

    /**
     * Extract content within balanced parentheses
     * Returns the content without outer parentheses
     */
    _extractBalancedParentheses(str, startPos) {
        if (str[startPos] !== '(') {
            return null;
        }

        let depth = 0;
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;

        for (let i = startPos; i < str.length; i++) {
            const char = str[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (!inSingleQuote && !inDoubleQuote) {
                if (char === '(') {
                    depth++;
                } else if (char === ')') {
                    depth--;
                    if (depth === 0) {
                        // Found matching closing parenthesis
                        return str.substring(startPos + 1, i);
                    }
                }
            }
        }

        return null; // Unbalanced parentheses
    }

    /**
     * Split string by delimiter at top level only
     * Ignores delimiters inside parentheses, brackets, braces, and quotes
     */
    _splitTopLevel(str, delimiter) {
        const parts = [];
        let buffer = '';
        let depthParen = 0;
        let depthBracket = 0;
        let depthBrace = 0;
        let inSingleQuote = false;
        let inDoubleQuote = false;
        
        let i = 0;
        const delimLen = delimiter.length;
        
        while (i < str.length) {
            const char = str[i];
            
            // Handle escape sequences
            if (char === '\\' && i + 1 < str.length) {
                buffer += char + str[i + 1];
                i += 2;
                continue;
            }
            
            // Handle quotes
            if (inSingleQuote) {
                buffer += char;
                if (char === "'") inSingleQuote = false;
                i++;
                continue;
            }
            
            if (inDoubleQuote) {
                buffer += char;
                if (char === '"') inDoubleQuote = false;
                i++;
                continue;
            }
            
            if (char === "'") {
                inSingleQuote = true;
                buffer += char;
                i++;
                continue;
            }
            
            if (char === '"') {
                inDoubleQuote = true;
                buffer += char;
                i++;
                continue;
            }
            
            // Track nesting depth
            if (char === '(') depthParen++;
            else if (char === ')') depthParen = Math.max(0, depthParen - 1);
            else if (char === '[') depthBracket++;
            else if (char === ']') depthBracket = Math.max(0, depthBracket - 1);
            else if (char === '{') depthBrace++;
            else if (char === '}') depthBrace = Math.max(0, depthBrace - 1);
            
            // Check for delimiter at top level
            if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
                if (str.substring(i, i + delimLen) === delimiter) {
                    parts.push(buffer);
                    buffer = '';
                    i += delimLen;
                    continue;
                }
            }
            
            buffer += char;
            i++;
        }
        
        if (buffer !== '') {
            parts.push(buffer);
        }
        
        return parts;
    }
}

module.exports = TemplateProcessors;
