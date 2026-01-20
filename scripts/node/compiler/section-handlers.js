/**
 * Section handlers for @section, @yield, etc.
 */

class SectionHandlers {
    constructor() {
        // No initialization needed
    }

    processSectionDirective(line, stack, output, sections) {
        /** Process section directives */
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('@section')) {
            const match = trimmedLine.match(/@section\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                const sectionName = match[1];
                sections.push({
                    name: sectionName,
                    type: 'long',
                    preloader: false,
                    useVars: false,
                    script: {}
                });
                stack.push(['section', sectionName]);
            }
            return null;
        } else if (trimmedLine.startsWith('@endsection')) {
            if (stack.length > 0 && stack[stack.length - 1][0] === 'section') {
                stack.pop();
            }
            return null;
        } else if (trimmedLine.startsWith('@yield')) {
            const match = trimmedLine.match(/@yield\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (match) {
                const sectionName = match[1];
                return `\${App.View.yield('${sectionName}')}`;
            }
        }
        
        return null;
    }
}

module.exports = SectionHandlers;

