/**
 * Loop handlers for @foreach, @for, etc.
 */

class LoopHandlers {
    constructor() {
        // No initialization needed
    }

    processLoopDirective(line, stack, output) {
        /** Process loop directives */
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('@foreach')) {
            stack.push(['foreach', trimmedLine]);
            return null;
        } else if (trimmedLine.startsWith('@endforeach')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'foreach') {
                stack.pop();
                return '}';
            }
        } else if (trimmedLine.startsWith('@for')) {
            stack.push(['for', trimmedLine]);
            return null;
        } else if (trimmedLine.startsWith('@endfor')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'for') {
                stack.pop();
                return '}';
            }
        } else if (trimmedLine.startsWith('@while')) {
            stack.push(['while', trimmedLine]);
            return null;
        } else if (trimmedLine.startsWith('@endwhile')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'while') {
                stack.pop();
                return '}';
            }
        }
        
        return null;
    }
}

module.exports = LoopHandlers;

