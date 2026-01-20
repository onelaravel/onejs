/**
 * Conditional handlers for @if, @unless, etc.
 */

class ConditionalHandlers {
    constructor() {
        // No initialization needed
    }

    processConditionalDirective(line, stack, output) {
        /** Process conditional directives */
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('@if')) {
            stack.push(['if', trimmedLine]);
            return null;
        } else if (trimmedLine.startsWith('@elseif')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'if') {
                return '} else if (';
            }
        } else if (trimmedLine.startsWith('@else')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'if') {
                return '} else {';
            }
        } else if (trimmedLine.startsWith('@endif')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'if') {
                stack.pop();
                return '}';
            }
        } else if (trimmedLine.startsWith('@unless')) {
            stack.push(['unless', trimmedLine]);
            return null;
        } else if (trimmedLine.startsWith('@endunless')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'unless') {
                stack.pop();
                return '}';
            }
        }
        
        return null;
    }
}

module.exports = ConditionalHandlers;

