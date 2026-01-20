"""
Handlers cho các conditional directives (@if, @switch, etc.)
"""

from config import JS_FUNCTION_PREFIX
from php_converter import php_to_js
from utils import extract_balanced_parentheses
import re

class ConditionalHandlers:
    def __init__(self, state_variables=None, processor=None):
        self.state_variables = state_variables or set()
        self.processor = processor
    
    def _extract_variables(self, expr):
        """Extract variable names from expression, excluding method names after dot notation"""
        variables = set()
        
        # Remove method calls after dots (e.g., App.Helper.count -> remove count)
        # Replace .methodName( with .PLACEHOLDER( to avoid extracting method names
        expr_cleaned = re.sub(r'\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', '.METHODCALL(', expr)
        
        var_pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b'
        matches = re.findall(var_pattern, expr_cleaned)
        for var_name in matches:
            # Exclude JS keywords, common functions, and placeholder
            if var_name not in ['if', 'else', 'return', 'function', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined', 'Array', 'Object', 'String', 'Number', 'METHODCALL', 'App', 'View', 'Helper']:
                variables.add(var_name)
        return variables
    
    def process_if_directive(self, line, stack, output, is_attribute_context=False):
        """Process @if directive
        
        Args:
            is_attribute_context: True if directive is in tag attributes (e.g., <div @if(...)>)
                                 False if directive is in block/content (e.g., <div>@if(...))
        """
        if_pos = line.find('(')
        if if_pos != -1:
            condition_text, end_pos = extract_balanced_parentheses(line, if_pos)
            if condition_text is not None:
                condition_php = condition_text.strip()
                condition = php_to_js(condition_php)
                
                # Extract variables from condition
                variables = self._extract_variables(condition)
                state_vars_used = variables & self.state_variables
                
                # Store state vars for this if block (will be used in endif)
                watch_keys = list(state_vars_used) if state_vars_used else []
                
                # Check if inside a loop (for/while only, NOT foreach)
                # @foreach uses callback that returns template literal directly
                # Only @for and @while use __outputContent__ concatenation pattern
                parent_is_loop = False
                parent_concat_var = ""
                if stack:
                    parent_type = stack[-1][0]
                    if parent_type in ['for', 'while']:
                        parent_is_loop = True
                        parent_concat_var = f"__{parent_type}OutputContent__"
                
                # If inside a loop and has state vars, use concat += with __watch
                if parent_is_loop and watch_keys:
                    if self.processor:
                        self.processor.watch_counter += 1
                        watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}-${{__loop.index}}`"
                    else:
                        watch_id = "`${__VIEW_ID__}-watch-0-${__loop.index}`"
                    result = f"{parent_concat_var} += this.__watch({watch_id}, {watch_keys}, () => {{ if({condition}){{ return `"
                # If inside a loop but no state vars, use concat += with IIFE
                elif parent_is_loop:
                    result = f"{parent_concat_var} += (() => {{ if({condition}){{ return `"
                # Only wrap with __watch for block-level directives (not attributes, not in loops)
                elif is_attribute_context or not watch_keys:
                    # Attribute directive or no state vars - no watch wrapping
                    result = f"${{this.__execute(() => {{ if({condition}){{ return `"
                else:
                    # Block directive with state vars - wrap with __watch
                    if self.processor:
                        self.processor.watch_counter += 1
                        watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                    else:
                        watch_id = "`${__VIEW_ID__}-watch-0`"
                    result = f"${{this.__watch({watch_id}, {watch_keys}, () => {{ if({condition}){{ return `"
                
                output.append(result)
                stack.append(('if', len(output), watch_keys, is_attribute_context, parent_is_loop))
                return True
        return False
    
    def process_elseif_directive(self, line, stack, output):
        """Process @elseif directive"""
        elseif_pos = line.find('(')
        if elseif_pos != -1:
            condition_text, end_pos = extract_balanced_parentheses(line, elseif_pos)
            if condition_text is not None:
                condition_php = condition_text.strip()
                condition = php_to_js(condition_php)
                
                # Extract variables and merge with existing if block's watch keys
                variables = self._extract_variables(condition)
                state_vars_used = variables & self.state_variables
                
                # Update watch_keys in stack
                if stack and stack[-1][0] == 'if':
                    existing_keys = set(stack[-1][2]) if len(stack[-1]) > 2 else set()
                    new_keys = existing_keys | state_vars_used
                    stack[-1] = ('if', stack[-1][1], list(new_keys))
                
                result = f"`; }} else if({condition}){{ return `"
                output.append(result)
                return True
        return False
    
    def process_else_directive(self, line, stack, output):
        """Process @else directive"""
        # Check if we're inside a loop (need to escape backticks)
        parent_is_loop = False
        if stack and stack[-1][0] == 'if':
            parent_is_loop = stack[-1][4] if len(stack[-1]) > 4 else False
        
        result = f"`; }} else {{ return `"
        output.append(result)
        return True
    
    def process_endif_directive(self, stack, output):
        """Process @endif directive"""
        if stack and stack[-1][0] == 'if':
            is_attribute = stack[-1][3] if len(stack[-1]) > 3 else False
            parent_is_loop = stack[-1][4] if len(stack[-1]) > 4 else False
            watch_keys = stack[-1][2] if len(stack[-1]) > 2 else []
            stack.pop()
            
            output.append('`; }')
            output.append("return '';")
            
            if parent_is_loop and watch_keys:
                # Inside loop with state vars - close watch without template wrapper
                # Pattern: })); where } closes arrow func, )) closes watch call, ; ends statement
                output.append('});')
            elif parent_is_loop:
                # Inside loop without state vars - close IIFE with immediate execution
                output.append('})')
            else:
                # Normal block - close IIFE or watch
                output.append('})}')
        return True
    
    def process_switch_directive(self, line, stack, output, is_attribute_context=False):
        """Process @switch directive
        
        Args:
            is_attribute_context: True if directive is in tag attributes
                                 False if directive is in block/content
        """
        switch_pos = line.find('(')
        if switch_pos != -1:
            switch_content, end_pos = extract_balanced_parentheses(line, switch_pos)
            if switch_content is not None:
                condition_php = switch_content.strip()
                condition = php_to_js(condition_php)
                
                # Extract variables from condition
                variables = self._extract_variables(condition)
                state_vars_used = variables & self.state_variables
                watch_keys = list(state_vars_used) if state_vars_used else []
                
                # Check if parent is a loop using concatenation pattern
                parent_is_concat = False
                parent_type_name = None
                if stack:
                    parent_type = stack[-1][0]
                    if parent_type in ['for', 'foreach', 'while']:
                        parent_is_concat = True
                        parent_type_name = parent_type
                
                # Generate switch statement
                switch_logic = f"let __switchOutputContent__ = '';\nswitch({condition}) {{"
                
                # Determine output format based on parent context
                if parent_is_concat:
                    # Parent uses concatenation (+=), so add concat prefix and use this.__execute()
                    concat_var = f"__{parent_type_name}OutputContent__"
                    if is_attribute_context or not watch_keys:
                        result = f"{concat_var} += this.__execute(() => {{\n{switch_logic}"
                    else:
                        if self.processor:
                            self.processor.watch_counter += 1
                            watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                        else:
                            watch_id = "`${__VIEW_ID__}-watch-0`"
                        result = f"{concat_var} += this.__watch({watch_id}, {watch_keys}, () => {{\n{switch_logic}"
                else:
                    # Parent uses template literal, so output template expression
                    if is_attribute_context or not watch_keys:
                        result = f"${{this.__execute(() => {{\n{switch_logic}"
                    else:
                        if self.processor:
                            self.processor.watch_counter += 1
                            watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                        else:
                            watch_id = "`${__VIEW_ID__}-watch-0`"
                        result = f"${{this.__watch({watch_id}, {watch_keys}, () => {{\n{switch_logic}"
                
                output.append(result)
                stack.append(('switch', len(output), watch_keys, is_attribute_context, parent_is_concat))
                return True
        return False
    
    def process_case_directive(self, line, stack, output):
        """Process @case directive"""
        case_pos = line.find('(')
        if case_pos != -1:
            case_content, end_pos = extract_balanced_parentheses(line, case_pos)
            if case_content is not None:
                condition = php_to_js(case_content.strip())
                result = f"\ncase {condition}:\n__switchOutputContent__ += `"
                output.append(result)
                # Don't push to stack - case is part of switch
                return True
        return False
    
    def process_default_directive(self, line, stack, output):
        """Process @default directive"""
        result = f"\ndefault:\n__switchOutputContent__ += `"
        output.append(result)
        # Don't push to stack - default is part of switch
        return True
    
    def process_break_directive(self, line, stack, output):
        """Process @break directive"""
        result = f"`;\nbreak;"
        output.append(result)
        return True
    
    def process_endswitch_directive(self, stack, output):
        """Process @endswitch directive"""
        if stack and stack[-1][0] == 'switch':
            switch_info = stack.pop()
            parent_is_concat = switch_info[4] if len(switch_info) > 4 else False
            
            if parent_is_concat:
                # Parent uses concatenation, close with })
                result = "`;\n}\nreturn __switchOutputContent__;\n})"
            else:
                # Parent uses template literal, output template expression
                result = "`;\n}\nreturn __switchOutputContent__;\n})}"
            
            output.append(result)
            return True
        return False
