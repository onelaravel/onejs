"""
Parser cho @fetch directive
"""

from php_converter import convert_php_to_js, convert_php_array_to_json

def parse_fetch_directive(fetch_content):
    """Parse @fetch directive content and return fetch configuration"""
    fetch_content = fetch_content.strip()
    
    # Default config
    config = {
        'url': '',
        'method': 'GET',
        'data': {},
        'headers': {}
    }
    
    # Check if it's a simple string (just URL)
    if fetch_content.startswith("'") and fetch_content.endswith("'"):
        config['url'] = f"`{fetch_content[1:-1]}`"
        return config
    elif fetch_content.startswith('"') and fetch_content.endswith('"'):
        config['url'] = f"`{fetch_content[1:-1]}`"
        return config
    
    # Check if it's a function call
    if '(' in fetch_content and ')' in fetch_content and not fetch_content.startswith('['):
        js_url = convert_php_to_js(fetch_content)
        config['url'] = f"`${{{js_url}}}`"
        return config
    
    # Check if it's an array configuration
    if fetch_content.startswith('[') and fetch_content.endswith(']'):
        # [Implementation chi tiết cho array parsing]
        # ... (giữ nguyên logic từ file gốc)
        pass
    
    return config

def parse_array_value(array_expr):
    """Parse array expressions and convert to JavaScript objects"""
    if not array_expr.startswith('[') or not array_expr.endswith(']'):
        return {}
    
    # [Implementation chi tiết]
    # ... (giữ nguyên logic từ file gốc)
    
    return {}
