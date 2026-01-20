"""
Phân tích việc sử dụng biến trong template
"""

import re
from config import JS_FUNCTION_PREFIX

def analyze_section_variables(section_content, vars_declaration):
    """Analyze if a section uses variables from @vars directive"""
    if not vars_declaration:
        return False
    
    # Extract variable names from vars_declaration
    vars_match = re.search(r'let\s*\{\s*([^}]+)\s*\}', vars_declaration)
    if not vars_match:
        return False
    
    vars_content = vars_match.group(1)
    var_names = []
    for var_part in vars_content.split(','):
        var_name = var_part.split('=')[0].strip()
        var_names.append(var_name)
    
    # Check if section content uses any of these variables
    for var_name in var_names:
        patterns = [
            f'${{{var_name}}}',
            f'${{{JS_FUNCTION_PREFIX}.escString({var_name})}}',
            f'${{{JS_FUNCTION_PREFIX}.foreach({var_name}',
            f', {var_name})',
            f'({var_name})',
            f', {var_name}',
            f' {var_name}',
        ]
        
        for pattern in patterns:
            if pattern in section_content:
                return True
    
    return False

def analyze_render_uses_vars(sections_code, template_content, vars_declaration):
    """Analyze if render function uses variables from @vars directive"""
    if not vars_declaration:
        return False
    
    # Extract variable names from vars_declaration
    vars_match = re.search(r'let\s*\{\s*([^}]+)\s*\}', vars_declaration)
    if not vars_match:
        return False
    
    vars_content = vars_match.group(1)
    var_names = []
    for var_part in vars_content.split(','):
        var_name = var_part.split('=')[0].strip()
        var_names.append(var_name)
    
    # Combine all render content
    render_content = sections_code + template_content
    
    # Check if any variable is used in render content
    for var_name in var_names:
        patterns = [
            f'${{{var_name}}}',
            f'${{{JS_FUNCTION_PREFIX}.escString({var_name})}}',
            f'${{{JS_FUNCTION_PREFIX}.foreach({var_name}',
            f', {var_name})',
            f'({var_name})',
            f', {var_name}',
            f' {var_name}',
        ]
        
        for pattern in patterns:
            if pattern in render_content:
                return True
    
    return False

def analyze_sections_info(sections_code, vars_declaration, has_await=False, has_fetch=False):
    """Analyze sections and return detailed information about each section"""
    sections_info = {}
    
    if not sections_code:
        return sections_info
    
    # Extract variable names from vars_declaration
    var_names = []
    if vars_declaration:
        vars_match = re.search(r'let\s*\{\s*([^}]+)\s*\}', vars_declaration)
        if vars_match:
            vars_content = vars_match.group(1)
            for var_part in vars_content.split(','):
                var_name = var_part.split('=')[0].strip()
                var_names.append(var_name)
    
    # Find all APP.View.section() calls in the sections_code
    section_matches = re.findall(fr'{JS_FUNCTION_PREFIX}\.section\([^)]+\)', sections_code, re.DOTALL)
    
    for section_call in section_matches:
        # Extract section name and content
        if ',' in section_call:
            name_match = re.search(fr"{JS_FUNCTION_PREFIX}\.section\(['\"]([^'\"]+)['\"]", section_call)
            if name_match:
                section_name = name_match.group(1)
                
                # Find the content part after the first comma
                comma_pos = section_call.find(',')
                section_content = section_call[comma_pos + 1:].strip()
                section_content = section_content.rstrip(');').strip()
                
                # Check if this is a long section
                is_long_section = False
                if section_content.startswith('`') and section_content.endswith('`'):
                    inner_content = section_content[1:-1]
                    is_long_section = ('\n' in inner_content or 
                                     '<' in inner_content or 
                                     len(inner_content.strip()) > 50)
                elif section_content.startswith('`') and not section_content.endswith('`'):
                    is_long_section = True
                
                # Check if section uses variables
                has_variables = analyze_section_variables(section_content, vars_declaration)
                
                # Determine section type and preload status
                section_type = "long" if is_long_section else "short"
                use_vars = has_variables
                preloader = has_variables and (has_await or has_fetch)
                
                sections_info[section_name] = {
                    "type": section_type,
                    "preloader": preloader,
                    "useVars": use_vars
                }
    
    return sections_info
