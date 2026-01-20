"""
Handlers cho các loop directives (@foreach, @for, etc.)
"""

from config import JS_FUNCTION_PREFIX
from php_converter import php_to_js
from utils import extract_balanced_parentheses
import re

class LoopHandlers:
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
    
    def process_foreach_directive(self, line, stack, output, is_attribute_context=False):
        """Process @foreach directive
        
        Args:
            is_attribute_context: True if directive is in tag attributes
                                 False if directive is in block/content
        """
        foreach_pos = line.find('(')
        if foreach_pos != -1:
            foreach_content, end_pos = extract_balanced_parentheses(line, foreach_pos)
            if foreach_content is not None:
                as_match = re.match(r'\s*(.*?)\s+as\s+\$?(\w+)(\s*=>\s*\$?(\w+))?\s*$', foreach_content)
                if as_match:
                    array_expr_php = as_match.group(1)
                    array_expr = php_to_js(array_expr_php)
                    first_var = as_match.group(2)
                    
                    if as_match.group(3):  # Has key => value
                        key_var = first_var
                        value_var = as_match.group(4)
                        callback = f'({value_var}, {key_var}, __loopIndex, __loop) => `'
                    else:  # Only value
                        value_var = first_var
                        callback = f'({value_var}, __loopKey, __loopIndex, __loop) => `'
                    
                    # Extract variables from array expression
                    variables = self._extract_variables(array_expr)
                    state_vars_used = variables & self.state_variables
                    watch_keys = list(state_vars_used) if state_vars_used else []
                    
                    # Use this.__foreach for instance method
                    foreach_call = f"this.__foreach({array_expr}, {callback}"
                    
                    # Only wrap with __watch for block-level directives (not attributes)
                    if is_attribute_context:
                        # Attribute directive - no watch wrapping
                        result = f"${{{foreach_call}"
                    else:
                        # Block directive - wrap with __watch
                        if self.processor:
                            self.processor.watch_counter += 1
                            watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                        else:
                            watch_id = "`${__VIEW_ID__}-watch-0`"
                        result = f"${{this.__watch({watch_id}, {watch_keys}, () => {foreach_call}"
                    
                    output.append(result)
                    stack.append(('foreach', len(output), is_attribute_context))
                    return True
        return False
    
    def process_endforeach_directive(self, stack, output):
        """Process @endforeach directive"""
        if stack and stack[-1][0] == 'foreach':
            is_attribute = stack[-1][2] if len(stack[-1]) > 2 else False
            stack.pop()
            if is_attribute:
                # Attribute directive - no watch wrapper
                output.append('`)}')
            else:
                # Block directive - close watch wrapper
                output.append('`))}') 
        return True
    
    def process_for_directive(self, line, stack, output, is_attribute_context=False):
        """Process @for directive
        
        Args:
            is_attribute_context: True if directive is in tag attributes
                                 False if directive is in block/content
        """
        for_pos = line.find('(')
        if for_pos != -1:
            for_content, end_pos = extract_balanced_parentheses(line, for_pos)
            if for_content is not None:
                # Parse @for($i = 0; $i < 10; $i++)
                for_match = re.match(r'\s*\$?(\w+)\s*=\s*(.*?);\s*\$?\1\s*([<>=!]+)\s*(.*?);\s*\$?\1\s*\+\+\s*$', for_content)
                if for_match:
                    var_name = for_match.group(1)
                    start_value_php = for_match.group(2)
                    start_value = php_to_js(start_value_php)
                    operator = for_match.group(3)
                    end_value_php = for_match.group(4)
                    end_value = php_to_js(end_value_php)
                    
                    # Extract variables from start and end values
                    variables = self._extract_variables(start_value) | self._extract_variables(end_value)
                    state_vars_used = variables & self.state_variables
                    watch_keys = list(state_vars_used) if state_vars_used else []
                    
                    # Generate for loop with __for() wrapper
                    for_logic = f"let __forOutputContent__ = ``;\nfor (let {var_name} = {start_value}; {var_name} {operator} {end_value}; {var_name}++) {{__loop.setCurrentTimes({var_name});"
                    
                    # Wrap in __for() with __loop parameter
                    for_call = f"this.__for('increment', {start_value}, {end_value}, (__loop) => {{\n{for_logic}"
                    
                    # Only wrap with __watch for block-level directives (not attributes)
                    has_watch = not is_attribute_context and watch_keys
                    if is_attribute_context or not watch_keys:
                        result = f"${{{for_call}"
                    else:
                        if self.processor:
                            self.processor.watch_counter += 1
                            watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                        else:
                            watch_id = "`${__VIEW_ID__}-watch-0`"
                        result = f"${{this.__watch({watch_id}, {watch_keys}, () => {{ return {for_call}"
                    
                    output.append(result)
                    stack.append(('for', len(output), is_attribute_context, has_watch))
                    return True
        return False
    
    def process_endfor_directive(self, stack, output):
        """Process @endfor directive"""
        if stack and stack[-1][0] == 'for':
            is_attribute = stack[-1][2] if len(stack[-1]) > 2 else False
            has_watch = stack[-1][3] if len(stack[-1]) > 3 else False
            stack.pop()
            
            if is_attribute:
                # Attribute directive - close __for
                result = "\n}\nreturn __forOutputContent__;\n})\n}"
            elif has_watch:
                # Block directive with watch - close __for, watch callback, and watch wrapper
                # Pattern:
                # } closes for loop body
                # return __forOutputContent__;
                # }) closes for arrow body and params
                # ); closes __for call and ends return statement
                # } closes watch callback arrow body
                # ) closes __watch call
                # } closes ${}
                result = "\n}\nreturn __forOutputContent__;\n})\n})}}"
            else:
                # Block directive without watch - close __for only
                result = "\n}\nreturn __forOutputContent__;\n})\n}"
            
            output.append(result)
        return True
    
    def process_while_directive(self, line, stack, output, is_attribute_context=False):
        """Process @while directive
        
        Args:
            is_attribute_context: True if directive is in tag attributes
                                 False if directive is in block/content
        """
        while_pos = line.find('(')
        if while_pos != -1:
            while_content, end_pos = extract_balanced_parentheses(line, while_pos)
            if while_content is not None:
                condition_php = while_content
                condition = php_to_js(condition_php)
                
                # Extract variables from condition
                variables = self._extract_variables(condition)
                state_vars_used = variables & self.state_variables
                watch_keys = list(state_vars_used) if state_vars_used else []
                
                # Generate while loop
                while_logic = f"let __whileOutputContent__ = ``;\nwhile({condition}) {{"
                
                # Only wrap with __watch for block-level directives (not attributes)
                if is_attribute_context or not watch_keys:
                    result = f"${{this.__execute(() => {{\n{while_logic}"
                else:
                    if self.processor:
                        self.processor.watch_counter += 1
                        watch_id = f"`${{__VIEW_ID__}}-watch-{self.processor.watch_counter}`"
                    else:
                        watch_id = "`${__VIEW_ID__}-watch-0`"
                    result = f"${{this.__watch({watch_id}, {watch_keys}, () => {{\n{while_logic}"
                
                output.append(result)
                stack.append(('while', len(output), is_attribute_context))
                return True
        return False
    
    def process_endwhile_directive(self, stack, output):
        """Process @endwhile directive"""
        if stack and stack[-1][0] == 'while':
            is_attribute = stack[-1][2] if len(stack[-1]) > 2 else False
            stack.pop()
            
            if is_attribute:
                # Attribute directive - close IIFE only
                result = "\n}\nreturn __whileOutputContent__;\n})}"
            else:
                # Block directive - close watch wrapper
                result = "\n}\nreturn __whileOutputContent__;\n})}"
            
            output.append(result)
        return True
