"""
Generator cho JavaScript code output
"""

import json
import re
from config import JS_FUNCTION_PREFIX, HTML_ATTR_PREFIX
from variables_analyzer import analyze_render_uses_vars, analyze_sections_info

def generate_prerender(has_await, has_fetch, extended_view, sections_code, template_content, vars_line, view_id_line, output_content_line="", uses_vars=True, sections_info=None):
    """Generate prerender function based on @await or @fetch directive presence"""
    if sections_info is None:
        sections_info = {}
    
    if not has_await and not has_fetch and not sections_code:
        return "function(__$spaViewData$__ = {}) {\n    return null;\n}"
    
    if not uses_vars and not sections_info:
        return "function(__$spaViewData$__ = {}) {\n    return null;\n}"
    
    if not has_await and not has_fetch and not vars_line:
        return "function(__$spaViewData$__ = {}) {\n    return null;\n}"
    
    # Initialize prerender_sections
    prerender_sections = []
    
    if sections_info:
        # Process sections based on their configuration
        for section_name, section_info in sections_info.items():
            section_type = section_info.get("type", "short")
            preloader = section_info.get("preloader", False)
            use_vars = section_info.get("useVars", False)
            
            if section_type == "long" and not use_vars:
                # Long section không dùng biến - render trực tiếp trong prerender
                # Không cần đợi fetch/await vì không dùng dynamic data
                section_pattern = f'{JS_FUNCTION_PREFIX}\.section\(\'{section_name}\',[^)]+\)'
                section_match = re.search(section_pattern, sections_code, re.DOTALL)
                if section_match:
                    prerender_sections.append("${" + section_match.group(0) + "}")
            elif section_type == "short" and not use_vars:
                # Short section không dùng biến - render trực tiếp trong prerender
                section_pattern = f'{JS_FUNCTION_PREFIX}\.section\(\'{section_name}\',[^)]+\)'
                section_match = re.search(section_pattern, sections_code, re.DOTALL)
                if section_match:
                    prerender_sections.append("${" + section_match.group(0) + "}")
            elif preloader:
                # Section có preloader (dùng biến + có fetch/await) - tạo section preloader
                prerender_sections.append("${" + JS_FUNCTION_PREFIX + ".section('" + section_name + "', `<div class=\"" + HTML_ATTR_PREFIX + "preloader\" ref=\"${__VIEW_ID__}\" data-section-name=\"" + section_name + "\">${" + JS_FUNCTION_PREFIX + ".text('loading')}</div>`)}")
    
    # Generate function based on context
    if extended_view:
        if has_await or has_fetch:
            return f"""function(__$spaViewData$__ = {{}}) {{
                {vars_line}{view_id_line}    let __outputRenderedContent__ = '';
                try {{
                    __outputRenderedContent__ = `{chr(10).join(prerender_sections) if prerender_sections else sections_code}`;
                }} catch(e) {{
                    __outputRenderedContent__ = this.showError(e.message);
                    console.warn(e);
                }}
                return this.__extends('{extended_view}');
                }}"""
        else:
            return f"""function(__$spaViewData$__ = {{}}) {{
                {view_id_line}    let __outputRenderedContent__ = '';
                try {{
                    __outputRenderedContent__ = `{chr(10).join(prerender_sections) if prerender_sections else sections_code}`;
                }} catch(e) {{
                    __outputRenderedContent__ = this.showError(e.message);
                    console.warn(e);
                }}
                return this.__extends('{extended_view}');
                }}"""
    else:
        if has_await or has_fetch:
            return f"""function(__$spaViewData$__ = {{}}) {{
                {vars_line}{view_id_line}    let __outputRenderedContent__ = '';
                try {{
                    __outputRenderedContent__ = `<div class="{HTML_ATTR_PREFIX}preloader" ref="${{__VIEW_ID__}}" data-view-name="${{__VIEW_PATH__}}">${{{JS_FUNCTION_PREFIX}.text('loading')}}</div>`;
                }} catch(e) {{
                    __outputRenderedContent__ = this.showError(e.message);
                    console.warn(e);
                }}
                return __outputRenderedContent__;
                }}"""
        else:
            static_content = sections_code if sections_code else template_content
            return f"""function(__$spaViewData$__ = {{}}) {{
                {vars_line}{view_id_line}    let __outputRenderedContent__ = '';
                try {{
                    __outputRenderedContent__ = `{static_content}`;
                }} catch(e) {{
                    __outputRenderedContent__ = this.showError(e.message);
                    console.warn(e);
                }}
                return __outputRenderedContent__;
                }}"""

def generate_view_engine(view_name, extended_view, sections_info, has_await, has_fetch, fetch_config, uses_vars, has_sections, has_section_preload, has_prerender, prerender_func, render_func, init_func, css_functions, wrapper_config=None):
    """Generate complete view engine code"""
    
    sections_json = json.dumps(sections_info, ensure_ascii=False, separators=(',', ':'))
    
    if extended_view:
        super_view_config = f"'{extended_view}'"
        has_super_view = "true"
    else:
        super_view_config = "null"
        has_super_view = "false"
    
    # Add wrapper config to view engine object
    wrapper_config_line = ""
    if wrapper_config:
        wrapper_config_line = f",\n        wrapperConfig: {wrapper_config}"
    
    return f"""function(data = {{}}) {{
    onst __VIEW_PATH__ = '{view_name}';
    const __VIEW_ID__ = {JS_FUNCTION_PREFIX}.generateViewId();
    const self = new {JS_FUNCTION_PREFIX}.Engine('{view_name}', {{
        superView: {super_view_config},
        hasSuperView: {has_super_view},
        sections: {sections_json}{wrapper_config_line},
        hasAwaitData: {str(has_await).lower()},
        hasFetchData: {str(has_fetch).lower()},
        fetch: {json.dumps(fetch_config, ensure_ascii=False).replace('"`', '`').replace('`"', '`') if fetch_config else 'null'},
        data: data,
        viewId: __VIEW_ID__,
        path: __VIEW_PATH__,
        usesVars: {str(uses_vars).lower()},
        hasSections: {str(has_sections).lower()},
        hasSectionPreload: {str(has_section_preload).lower()},
        hasPrerender: {str(has_prerender).lower()},
        prerender: {prerender_func},
        render: {render_func}{css_functions}
    }});
    return self;
    function onStateChange(state) {{
        self.data = state;
    }}
        }}"""
