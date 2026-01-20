/**
 * Parsers for directives (@extends, @vars, @fetch, @onInit)
 */

const { extractBalancedParentheses } = require('./utils');
const { phpToJs, convertPhpArrayToJson } = require('./php-converter');

class DirectiveParsers {
    constructor() {
        // No initialization needed
    }

    _removeScriptTags(bladeCode) {
        /** Remove JavaScript code in <script> tags to avoid processing useState in JS */
        // Remove all content in <script> tags
        const filteredCode = bladeCode.replace(/<script[^>]*>.*?<\/script>/gis, '');
        return filteredCode;
    }

    parseExtends(bladeCode) {
        /** Parse @extends directive */
        const extendsMatch = bladeCode.match(/@extends\s*\(\s*([^)]+)\s*\)/s);
        if (!extendsMatch) {
            return { extendedView: null, extendsExpression: null, extendsData: null };
        }
            
        let extendsContent = extendsMatch[1].trim();
        
        // Check if there's a comma (indicating data parameter)
        const commaPos = extendsContent.indexOf(',');
        let viewExpr, dataExpr, extendsData;
        
        if (commaPos !== -1) {
            viewExpr = extendsContent.substring(0, commaPos).trim();
            dataExpr = extendsContent.substring(commaPos + 1).trim();
            extendsData = this._convertExtendsData(dataExpr);
        } else {
            viewExpr = extendsContent;
            extendsData = null;
        }
        
        // Check if it's a simple string literal (avoid $ issues)
        const dollarChar = '$';
        let extendedView, extendsExpression;
        
        if ((viewExpr.startsWith('"') && viewExpr.endsWith('"') && !viewExpr.includes(dollarChar)) || 
            (viewExpr.startsWith("'") && viewExpr.endsWith("'") && !viewExpr.includes(dollarChar))) {
            extendedView = viewExpr.slice(1, -1); // Remove quotes
            extendsExpression = null;
        } else {
            // Complex expression - need to evaluate at runtime
            if (viewExpr.startsWith('"') && viewExpr.endsWith('"')) {
                const innerContent = viewExpr.slice(1, -1);
                const processedContent = innerContent.replace(/\$(\w+)/g, '${$1}');
                extendsExpression = "`" + processedContent + "`";
            } else {
                extendsExpression = phpToJs(viewExpr);
            }
            extendedView = null;
        }
        
        return { extendedView, extendsExpression, extendsData };
    }

    parseVars(bladeCode) {
        /** Parse @vars directive - improved to handle complex arrays like Event directive */
        const varsMatch = bladeCode.match(/@vars\s*\(\s*(.*?)\s*\)/s);
        if (!varsMatch) {
            return '';
        }
            
        const varsContent = varsMatch[1];
        const varParts = [];
        
        // Special handling for object destructuring syntax {var1, var2}
        const trimmedContent = varsContent.trim();
        let parts;
        
        if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
            // Extract content inside braces
            const innerContent = trimmedContent.slice(1, -1);
            // Split by comma at level 0
            parts = this._splitVarsContentCorrect(innerContent);
        } else {
            // Use improved splitting logic (same as Event directive)
            parts = this._splitVarsContentCorrect(varsContent);
        }
        
        for (const varItem of parts) {
            const varStr = varItem.trim();
            if (varStr.includes('=')) {
                const equalsPos = this._findFirstEquals(varStr);
                if (equalsPos !== -1) {
                    const varName = varStr.substring(0, equalsPos).trim().replace(/^\$/, '');
                    const varValue = varStr.substring(equalsPos + 1).trim();
                    // Convert PHP array syntax to JavaScript
                    const convertedValue = this._convertPhpToJs(varValue);
                    varParts.push(`${varName} = ${convertedValue}`);
                } else {
                    const varName = varStr.trim().replace(/^\$/, '');
                    varParts.push(varName);
                }
            } else {
                const varName = varStr.trim().replace(/^\$/, '');
                varParts.push(varName);
            }
        }
        
        return `let {${varParts.join(', ')}} = $$$DATA$$$ || {};`;
    }

    parseLetDirectives(bladeCode) {
        /** Parse @let directives - only process Blade directives, not JavaScript code */
        // Remove JavaScript code in <script> tags before parsing
        const bladeCodeFiltered = this._removeScriptTags(bladeCode);
        
        // Use balanced parentheses to parse correctly
        const letMatches = [];
        const letPattern = /@let\s*\(/g;
        let match;
        
        while ((match = letPattern.exec(bladeCodeFiltered)) !== null) {
            const startPos = match.index + match[0].length - 1; // Position of opening parenthesis
            const [content, endPos] = extractBalancedParentheses(bladeCodeFiltered, startPos);
            
            if (content !== null) {
                letMatches.push(content);
            }
        }
        
        const letDeclarations = [];
        for (const match of letMatches) {
            const parts = this._splitVarsContentCorrect(match);
            for (const part of parts) {
                const trimmedPart = part.trim();
                if (trimmedPart) {
                    letDeclarations.push(`let ${trimmedPart};`);
                }
            }
        }
        
        return letDeclarations;
    }

    parseConstDirectives(bladeCode) {
        /** Parse @const directives */
        const constMatches = [];
        const constPattern = /@const\s*\(/g;
        let match;
        
        while ((match = constPattern.exec(bladeCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(bladeCode, startPos);
            
            if (content !== null) {
                constMatches.push(content);
            }
        }
        
        const constDeclarations = [];
        for (const match of constMatches) {
            const parts = this._splitVarsContentCorrect(match);
            for (const part of parts) {
                const trimmedPart = part.trim();
                if (trimmedPart) {
                    constDeclarations.push(`const ${trimmedPart};`);
                }
            }
        }
        
        return constDeclarations;
    }

    parseUseStateDirectives(bladeCode) {
        /** Parse @useState directives */
        const useStateMatches = [];
        const useStatePattern = /@useState\s*\(/g;
        let match;
        
        while ((match = useStatePattern.exec(bladeCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(bladeCode, startPos);
            
            if (content !== null) {
                useStateMatches.push(content);
            }
        }
        
        const useStateDeclarations = [];
        for (const match of useStateMatches) {
            const parts = this._splitVarsContentCorrect(match);
            for (const part of parts) {
                const trimmedPart = part.trim();
                if (trimmedPart) {
                    useStateDeclarations.push(`const [${trimmedPart}] = this.useState(${trimmedPart} || null);`);
                }
            }
        }
        
        return useStateDeclarations;
    }

    parseFetch(bladeCode) {
        /** Parse @fetch directive */
        const fetchMatch = bladeCode.match(/@fetch\s*\(\s*(.*?)\s*\)/s);
        if (!fetchMatch) {
            return null;
        }
        
        const fetchContent = fetchMatch[1];
        try {
            // Try to parse as JSON first
            return JSON.parse(fetchContent);
        } catch (e) {
            // If not valid JSON, treat as JavaScript expression
            return fetchContent;
        }
    }

    parseInit(bladeCode) {
        /** Parse @onInit directive */
        const initMatches = [];
        const initPattern = /@onInit\s*\(\s*(.*?)\s*\)/gs;
        let match;
        
        while ((match = initPattern.exec(bladeCode)) !== null) {
            initMatches.push(match[1]);
        }
        
        const initFunctions = [];
        const cssContent = [];
        
        for (const initContent of initMatches) {
            // Check if it contains CSS
            if (initContent.includes('addCSS') || initContent.includes('style')) {
                cssContent.push(initContent);
            } else {
                initFunctions.push(initContent);
            }
        }
        
        return { initFunctions, cssContent };
    }

    parseViewType(bladeCode) {
        /** Parse @viewType directive */
        const viewTypeMatch = bladeCode.match(/@viewType\s*\(\s*([^)]+)\s*\)/);
        if (!viewTypeMatch) {
            return { type: 'component' };
        }
        
        const viewTypeContent = viewTypeMatch[1].trim().replace(/['"]/g, '');
        return { type: viewTypeContent };
    }

    parseRegister(bladeCode) {
        /** Parse @register directive */
        const registerMatch = bladeCode.match(/@register\s*\(\s*(.*?)\s*\)/s);
        if (!registerMatch) {
            return '';
        }
        
        return registerMatch[1];
    }

    parseWrapper(bladeCode) {
        /** Parse @wrapper directive */
        const wrapperMatch = bladeCode.match(/@wrapper\s*\(\s*(.*?)\s*\)/s);
        if (!wrapperMatch) {
            return '';
        }
        
        return wrapperMatch[1];
    }

    _splitVarsContentCorrect(content) {
        /** Split content by comma, respecting nested parentheses and quotes */
        const result = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
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

    _findFirstEquals(str) {
        /** Find first equals sign not inside quotes or parentheses */
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            
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
            } else if (!inQuotes && depth === 0 && char === '=') {
                return i;
            }
        }
        
        return -1;
    }

    _convertPhpToJs(phpCode) {
        /** Convert PHP code to JavaScript */
        return phpToJs(phpCode);
    }

    _convertExtendsData(dataExpr) {
        /** Convert extends data expression */
        if (!dataExpr) return null;
        
        try {
            return JSON.parse(dataExpr);
        } catch (e) {
            return dataExpr;
        }
    }
}

module.exports = DirectiveParsers;

