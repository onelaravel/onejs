/**
 * Directive processors for various Blade directives
 */

class DirectiveProcessor {
    constructor() {
        // No initialization needed
    }

    processDirective(line, stack, output) {
        /** Process various directives */
        const trimmedLine = line.trim();
        
        // Handle @include
        if (trimmedLine.startsWith('@include')) {
            const match = trimmedLine.match(/@include\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                const viewName = match[1];
                return `\${App.View.include('${viewName}')}`;
            }
        }
        
        // Handle @csrf
        if (trimmedLine.startsWith('@csrf')) {
            return `\${App.View.csrfToken()}`;
        }
        
        // Handle @method
        if (trimmedLine.startsWith('@method')) {
            const match = trimmedLine.match(/@method\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                const method = match[1];
                return `<input type="hidden" name="_method" value="${method}">`;
            }
        }
        
        // Handle @error
        if (trimmedLine.startsWith('@error')) {
            const match = trimmedLine.match(/@error\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                const field = match[1];
                return `\${App.View.hasError('${field}') ? App.View.firstError('${field}') : ''}`;
            }
        }
        
        return null;
    }
}

module.exports = DirectiveProcessor;

