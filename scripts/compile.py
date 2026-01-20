#!/usr/bin/env python3
"""
Blade to JavaScript Compiler - Modular Architecture
Sử dụng kiến trúc modular mới để dễ dàng phát triển và maintain
"""

import sys
import os
from compiler import BladeCompiler
# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

blade_compiler = BladeCompiler()

def compile_blade_to_js(blade_code, view_name="view"):
    """
    Compile blade code to JavaScript
    """
    return blade_compiler.compile_blade_to_js(blade_code, view_name)

def compile_blade_to_js_legacy(blade_code, view_name="view"):
    """
    Legacy wrapper function để tương thích với code cũ
    """
    return blade_compiler.compile_blade_to_js(blade_code, view_name)


def test_compiler_legacy():
    """
    Legacy test function để tương thích với code cũ
    """
    # Simple test function
    test_code = '<h1>Hello World</h1>'
    result = blade_compiler.compile_blade_to_js(test_code, 'test_view')
    print("Test compilation successful!")
    print(f"Result length: {len(result)}")
    return result


def main_legacy():
    """
    Legacy main function để tương thích với code cũ
    """
    if len(sys.argv) < 3:
        print("Sử dụng: python compile.py <input.blade> <output.js>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            blade_code = f.read()
        
        js_code = blade_compiler.compile_blade_to_js(blade_code, input_file)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(js_code)
        
        print(f"Đã compile thành công từ {input_file} sang {output_file}")
    except Exception as e:
        print(f"Lỗi: {e}")
        sys.exit(1)


# Export functions for backward compatibility
__all__ = [
    'compile_blade_to_js',
    'compile_blade_to_js_legacy', 
    'test_compiler_legacy',
    'main_legacy'
]

# Legacy function aliases for backward compatibility
extract_balanced_parentheses = None
normalize_quotes = None
convert_php_array_to_json = None
php_to_js = None
format_js_output = None
parse_fetch_directive = None
convert_php_to_js = None
parse_array_value = None
analyze_section_variables = None
analyze_render_uses_vars = None
analyze_sections_info = None
analyze_has_section_preload = None
analyze_needs_prerender = None
generate_prerender = None

# All functions are now in main_compiler.py
# Legacy function aliases are set to None for backward compatibility


if __name__ == "__main__":
    # If command line arguments provided, run main function
    if len(sys.argv) > 1:
        main_legacy()
    else:
        # Run tests by default if no arguments
        test_compiler_legacy()
    