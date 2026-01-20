/**
 * Main template processor that handles template content
 */

const { extractBalancedParentheses, splitByComma } = require('./utils');
const ConditionalHandlers = require('./conditional-handlers');
const LoopHandlers = require('./loop-handlers');
const SectionHandlers = require('./section-handlers');
const TemplateProcessors = require('./template-processors');
const DirectiveProcessor = require('./directive-processors');
const EventDirectiveProcessor = require('./event-directive-processor');

class TemplateProcessor {
    constructor() {
        this.conditionalHandlers = new ConditionalHandlers();
        this.loopHandlers = new LoopHandlers();
        this.sectionHandlers = new SectionHandlers();
        this.templateProcessors = new TemplateProcessors();
        this.directiveProcessors = new DirectiveProcessor();
        this.eventProcessor = new EventDirectiveProcessor();
    }

    processTemplate(bladeCode) {
        /** Process template content and extract sections */
        // Remove already processed directives
        let processedCode = bladeCode.replace(/@extends\s*\([^)]*\)/gs, '');
        processedCode = processedCode.replace(/@vars\s*\([^)]*\)/gs, '');
        
        // Remove @let directives with balanced parentheses
        const letPattern = /@let\s*\(/g;
        let match;
        while ((match = letPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @const directives with balanced parentheses
        const constPattern = /@const\s*\(/g;
        while ((match = constPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @useState directives with balanced parentheses
        const useStatePattern = /@useState\s*\(/g;
        while ((match = useStatePattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @onInit directives with balanced parentheses
        const onInitPattern = /@onInit\s*\(/gs;
        while ((match = onInitPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @register directives with balanced parentheses
        const registerPattern = /@register\s*\(/gs;
        while ((match = registerPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @wrapper directives with balanced parentheses
        const wrapperPattern = /@wrapper\s*\(/gs;
        while ((match = wrapperPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @viewType directives
        processedCode = processedCode.replace(/@viewType\s*\([^)]*\)/g, '');
        
        // Remove @await directives with balanced parentheses
        const awaitPattern = /@await\s*\(/gs;
        while ((match = awaitPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Remove @fetch directives with balanced parentheses
        const fetchPattern = /@fetch\s*\(/gs;
        while ((match = fetchPattern.exec(processedCode)) !== null) {
            const startPos = match.index + match[0].length - 1;
            const [content, endPos] = extractBalancedParentheses(processedCode, startPos);
            if (content !== null) {
                processedCode = processedCode.substring(0, match.index) + processedCode.substring(startPos + content.length + 2);
            } else {
                break;
            }
        }
        
        // Process the template content
        const lines = processedCode.split('\n');
        const output = [];
        const sections = [];
        const stack = [];
        let skipUntil = null;
        let removeDirectiveMarkers = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const originalLine = line;
            
            // Handle skip modes
            if (skipUntil) {
                if (skipUntil === '@endserverside') {
                    const endserversideAliases = [
                        '@endserverside', '@endServerSide', '@endSSR', '@endSsr', 
                        '@EndSSR', '@EndSsr', '@endssr'
                    ];
                    if (endserversideAliases.some(alias => line.trim().startsWith(alias))) {
                        skipUntil = null;
                        removeDirectiveMarkers = false;
                        i++; // Skip the end directive line
                        continue;
                    }
                } else if (skipUntil === '@endclientside') {
                    const endclientsideAliases = [
                        '@endclientside', '@endClientSide', '@endcsr', '@endCSR', 
                        '@endCsr', '@endusecsr', '@endUseCSR', '@endUseCsr'
                    ];
                    if (endclientsideAliases.some(alias => line.trim().startsWith(alias))) {
                        skipUntil = null;
                        removeDirectiveMarkers = false;
                        i++; // Skip the end directive line
                        continue;
                    } else if (removeDirectiveMarkers) {
                        // Process line normally (convert PHP to JS) but without adding directive markers
                        const processedLine = this.templateProcessors.processTemplateLine(line);
                        output.push(processedLine);
                    }
                }
                i++;
                continue;
            }
            
            // Skip empty lines
            if (!line.trim()) {
                output.push('');
                continue;
            }
            
            // Process line directives
            const processed = this._processLineDirectives(line, stack, output, sections);
            if (processed) {
                if (processed === 'skip_until_@endserverside') {
                    skipUntil = '@endserverside';
                    // Skip the @ssr line itself
                    i++;
                    continue;
                } else if (processed === 'remove_directive_markers_until_@endclientside') {
                    skipUntil = '@endclientside';
                    removeDirectiveMarkers = true;
                    // Skip the @csr line itself
                    i++;
                    continue;
                } else {
                    // Append the processed directive result
                    output.push(processed);
                }
                i++;
                continue;
            }
            
            // Check if we're inside a php block first
            if (stack.length > 0 && stack[stack.length - 1][0] === 'php') {
                // Convert PHP to JavaScript
                if (line.trim()) {
                    const jsLine = this.templateProcessors.processTemplateLine(line);
                    output.push(jsLine);
                } else {
                    output.push('');
                }
                continue;
            }
            
            // Process template line
            const processedLine = this.templateProcessors.processTemplateLine(line);
            output.push(processedLine);
        }
        
        const templateContent = output.filter(item => typeof item === 'string').join('\n');
        return { templateContent, sections };
    }

    _processLineDirectives(line, stack, output, sections) {
        /** Process line-level directives */
        // Check for section directives
        const sectionProcessed = this.sectionHandlers.processSectionDirective(line, stack, output, sections);
        if (sectionProcessed) {
            return sectionProcessed;
        }
        
        // Check for conditional directives
        const conditionalProcessed = this.conditionalHandlers.processConditionalDirective(line, stack, output);
        if (conditionalProcessed) {
            return conditionalProcessed;
        }
        
        // Check for loop directives
        const loopProcessed = this.loopHandlers.processLoopDirective(line, stack, output);
        if (loopProcessed) {
            return loopProcessed;
        }
        
        // Check for other directives
        const otherProcessed = this.directiveProcessors.processDirective(line, stack, output);
        if (otherProcessed) {
            return otherProcessed;
        }
        
        // Check for event directives
        const eventProcessed = this._processEventDirectives(line);
        if (eventProcessed) {
            return eventProcessed;
        }
        
        // Check for server/client side directives
        const serversideProcessed = this.templateProcessors.processServersideDirective(line);
        if (serversideProcessed) {
            return serversideProcessed;
        }
        
        const clientsideProcessed = this.templateProcessors.processClientsideDirective(line);
        if (clientsideProcessed) {
            return clientsideProcessed;
        }
        
        return null;
    }

    _processEventDirectives(line) {
        /** Process event directives (@click, @change, @submit, etc.) */
        // List of event types to check - comprehensive DOM events
        const eventTypes = [
            // Mouse Events
            'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove', 
            'mouseenter', 'mouseleave', 'wheel', 'auxclick',
            
            // Keyboard Events
            'keydown', 'keyup', 'keypress',
            
            // Form Events
            'input', 'change', 'submit', 'reset', 'invalid', 'search',
            
            // Focus Events
            'focus', 'blur', 'focusin', 'focusout',
            
            // Selection Events
            'select', 'selectstart', 'selectionchange',
            
            // Touch Events
            'touchstart', 'touchmove', 'touchend', 'touchcancel',
            
            // Drag & Drop Events
            'dragstart', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop',
            
            // Media Events
            'play', 'pause', 'ended', 'loadstart', 'loadeddata', 'loadedmetadata', 'canplay',
            'canplaythrough', 'waiting', 'seeking', 'seeked', 'ratechange', 'durationchange',
            'volumechange', 'suspend', 'stalled', 'progress', 'emptied', 'encrypted', 'wakeup',
            
            // Window Events
            'load', 'unload', 'beforeunload', 'resize', 'scroll', 'orientationchange',
            'visibilitychange', 'pagehide', 'pageshow', 'popstate', 'hashchange', 'online', 'offline',
            
            // Document Events
            'DOMContentLoaded', 'readystatechange',
            
            // Error Events
            'error', 'abort',
            
            // Context Menu
            'contextmenu',
            
            // Animation Events
            'animationstart', 'animationend', 'animationiteration',
            
            // Transition Events
            'transitionstart', 'transitionend', 'transitionrun', 'transitioncancel',
            
            // Pointer Events (Modern browsers)
            'pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerout',
            'pointerenter', 'pointerleave', 'pointercancel', 'gotpointercapture', 'lostpointercapture',
            
            // Fullscreen Events
            'fullscreenchange', 'fullscreenerror',
            
            // Clipboard Events
            'copy', 'cut', 'paste',
            
            // Gamepad Events
            'gamepadconnected', 'gamepaddisconnected',
            
            // Battery Events
            'batterychargingchange', 'batterylevelchange',
            
            // Device Orientation Events
            'deviceorientation', 'devicemotion', 'devicelight', 'deviceproximity',
            
            // WebGL Events
            'webglcontextlost', 'webglcontextrestored'
        ];
        
        let result = line;
        let changed = false;
        
        // Process all event directives in the line
        for (const eventType of eventTypes) {
            // Check for @eventType(...) pattern with balanced parentheses
            const pattern = new RegExp(`@${eventType}\\s*\\(`, 'i');
            const match = result.match(pattern);
            if (match) {
                // Extract content within balanced parentheses
                const startPos = match.index + match[0].length - 1; // Position of opening parenthesis
                const [content, endPos] = extractBalancedParentheses(result, startPos);
                if (content !== null) {
                    // Replace only the directive part, keep the rest of the HTML
                    const eventConfig = this.eventProcessor.processEventDirective(eventType, content);
                    // Replace @eventType(...) with event config using balanced parentheses
                    const startPos = match.index;
                    const endPos = startPos + match[0].length + content.length + 1; // +1 for closing )
                    result = result.substring(0, startPos) + eventConfig + result.substring(endPos);
                    changed = true;
                }
            }
        }
        
        return changed ? result : null;
    }
}

module.exports = TemplateProcessor;

