"""
View Identifier Generator for Blade Compiler
Generates view identification attributes for server-rendered content
"""

import re
from utils import extract_balanced_parentheses

class ViewIdentifierGenerator:
    def __init__(self):
        self.view_id_counter = 0
        self.view_hierarchy = {}
    
    def generate_view_attributes(self, view_name, view_type='view', parent_view=None):
        """Generate view identification attributes"""
        view_id = self.generate_view_id(view_name)
        
        attributes = {
            'data-spa-view': self.extract_view_scope(view_name),
            'data-spa-view-name': view_name,
            'data-spa-view-path': view_name,
            'data-spa-view-id': view_id,
            'data-spa-view-type': view_type
        }
        
        if parent_view:
            attributes['data-spa-view-parent'] = parent_view
        
        return attributes
    
    def generate_view_id(self, view_name):
        """Generate unique view ID"""
        self.view_id_counter += 1
        # Convert view name to ID format
        clean_name = re.sub(r'[^a-zA-Z0-9]', '-', view_name)
        return f"{clean_name}-{self.view_id_counter}"
    
    def extract_view_scope(self, view_name):
        """Extract view scope from view name"""
        parts = view_name.split('.')
        if len(parts) > 1:
            return parts[-1]  # Last part as scope
        return 'main'
    
    def process_template_with_identifiers(self, blade_code, view_name, view_type='view'):
        """Process template and add view identification attributes"""
        
        # Generate attributes for main container
        main_attributes = self.generate_view_attributes(view_name, view_type)
        
        # Add attributes to main container elements
        blade_code = self.add_attributes_to_containers(blade_code, main_attributes)
        
        # Process sections with identifiers
        blade_code = self.process_sections_with_identifiers(blade_code, view_name)
        
        # Process conditional blocks with identifiers
        blade_code = self.process_conditionals_with_identifiers(blade_code, view_name)
        
        return blade_code
    
    def add_attributes_to_containers(self, blade_code, attributes):
        """Add view identification attributes to container elements"""
        
        # Find main container elements (div, section, main, article, etc.)
        container_patterns = [
            r'<div([^>]*)>',
            r'<section([^>]*)>',
            r'<main([^>]*)>',
            r'<article([^>]*)>',
            r'<aside([^>]*)>',
            r'<header([^>]*)>',
            r'<footer([^>]*)>'
        ]
        
        for pattern in container_patterns:
            def add_attributes(match):
                existing_attrs = match.group(1)
                new_attrs = ' '.join([f'{k}="{v}"' for k, v in attributes.items()])
                
                if existing_attrs.strip():
                    return f'<{match.group(0)[1:-1]} {new_attrs}>'
                else:
                    return f'<{match.group(0)[1:-1]} {new_attrs}>'
            
            blade_code = re.sub(pattern, add_attributes, blade_code)
        
        return blade_code
    
    def process_sections_with_identifiers(self, blade_code, view_name):
        """Process @section directives with view identifiers"""
        
        # Find @section directives
        section_pattern = r'@section\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
        
        def process_section(match):
            section_name = match.group(1)
            section_id = f"{view_name}.{section_name}"
            section_attributes = self.generate_view_attributes(section_id, 'section', view_name)
            
            # Add attributes to the section content
            attrs_str = ' '.join([f'{k}="{v}"' for k, v in section_attributes.items()])
            
            return f'@section(\'{section_name}\')\n<div {attrs_str}>'
        
        blade_code = re.sub(section_pattern, process_section, blade_code)
        
        # Find @endsection directives
        endsection_pattern = r'@endsection'
        blade_code = re.sub(endsection_pattern, '</div>\n@endsection', blade_code)
        
        return blade_code
    
    def process_conditionals_with_identifiers(self, blade_code, view_name):
        """Process conditional blocks with view identifiers"""
        
        # Find @if directives
        if_pattern = r'@if\s*\([^)]+\)'
        
        def process_if(match):
            if_content = match.group(0)
            if_id = f"{view_name}.if-{self.view_id_counter}"
            if_attributes = self.generate_view_attributes(if_id, 'conditional', view_name)
            
            attrs_str = ' '.join([f'{k}="{v}"' for k, v in if_attributes.items()])
            
            return f'{if_content}\n<div {attrs_str}>'
        
        blade_code = re.sub(if_pattern, process_if, blade_code)
        
        # Find @endif directives
        endif_pattern = r'@endif'
        blade_code = re.sub(endif_pattern, '</div>\n@endif', blade_code)
        
        return blade_code
    
    def generate_server_side_attributes(self, view_name, view_type='view'):
        """Generate attributes for server-side rendering"""
        
        attributes = self.generate_view_attributes(view_name, view_type)
        
        # Add server-side specific attributes
        attributes.update({
            'data-server-rendered': 'true',
            'data-hydration-ready': 'false'
        })
        
        return attributes
    
    def generate_meta_tags(self, view_name, view_type='view'):
        """Generate meta tags for view identification"""
        
        view_id = self.generate_view_id(view_name)
        
        meta_tags = f"""
    <!-- View Identification Meta Tags -->
    <meta name="spa-view-name" content="{view_name}">
    <meta name="spa-view-path" content="{view_name}">
    <meta name="spa-view-id" content="{view_id}">
    <meta name="spa-view-type" content="{view_type}">
"""
        
        return meta_tags
    
    def process_yield_directives(self, blade_code, view_name):
        """Process @yield directives with view identifiers"""
        
        # Find @yield directives
        yield_pattern = r'@yield\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
        
        def process_yield(match):
            yield_name = match.group(1)
            yield_id = f"{view_name}.yield-{yield_name}"
            yield_attributes = self.generate_view_attributes(yield_id, 'yield', view_name)
            
            attrs_str = ' '.join([f'{k}="{v}"' for k, v in yield_attributes.items()])
            
            return f'<div {attrs_str}>@yield(\'{yield_name}\')</div>'
        
        blade_code = re.sub(yield_pattern, process_yield, blade_code)
        
        return blade_code
    
    def generate_view_boundary_comments(self, view_name, view_type='view'):
        """Generate HTML comments for view boundaries"""
        
        view_id = self.generate_view_id(view_name)
        
        start_comment = f"<!-- SPA VIEW START: {view_name} (ID: {view_id}, Type: {view_type}) -->"
        end_comment = f"<!-- SPA VIEW END: {view_name} -->"
        
        return start_comment, end_comment
    
    def process_loop_directives(self, blade_code, view_name):
        """Process loop directives with view identifiers"""
        
        # Find @foreach directives
        foreach_pattern = r'@foreach\s*\([^)]+\)'
        
        def process_foreach(match):
            foreach_content = match.group(0)
            loop_id = f"{view_name}.loop-{self.view_id_counter}"
            loop_attributes = self.generate_view_attributes(loop_id, 'loop', view_name)
            
            attrs_str = ' '.join([f'{k}="{v}"' for k, v in loop_attributes.items()])
            
            return f'{foreach_content}\n<div {attrs_str}>'
        
        blade_code = re.sub(foreach_pattern, process_foreach, blade_code)
        
        # Find @endforeach directives
        endforeach_pattern = r'@endforeach'
        blade_code = re.sub(endforeach_pattern, '</div>\n@endforeach', blade_code)
        
        return blade_code
    
    def generate_debug_attributes(self, view_name, debug_mode=False):
        """Generate debug attributes for development"""
        
        if not debug_mode:
            return {}
        
        return {
            'data-debug-view': view_name,
            'data-debug-timestamp': str(int(__import__('time').time())),
            'data-debug-version': '1.0.0'
        }
    
    def process_complete_template(self, blade_code, view_name, view_type='view', debug_mode=False):
        """Process complete template with all view identifiers"""
        
        # Add meta tags
        meta_tags = self.generate_meta_tags(view_name, view_type)
        blade_code = self.insert_meta_tags(blade_code, meta_tags)
        
        # Process template with identifiers
        blade_code = self.process_template_with_identifiers(blade_code, view_name, view_type)
        
        # Process yield directives
        blade_code = self.process_yield_directives(blade_code, view_name)
        
        # Process loop directives
        blade_code = self.process_loop_directives(blade_code, view_name)
        
        # Add debug attributes if enabled
        if debug_mode:
            debug_attrs = self.generate_debug_attributes(view_name, debug_mode)
            blade_code = self.add_debug_attributes(blade_code, debug_attrs)
        
        return blade_code
    
    def insert_meta_tags(self, blade_code, meta_tags):
        """Insert meta tags into head section"""
        
        # Find head tag
        head_pattern = r'(<head[^>]*>)'
        
        def insert_meta(match):
            return f"{match.group(1)}\n{meta_tags}"
        
        blade_code = re.sub(head_pattern, insert_meta, blade_code, flags=re.IGNORECASE)
        
        return blade_code
    
    def add_debug_attributes(self, blade_code, debug_attrs):
        """Add debug attributes to elements"""
        
        # Add debug attributes to main containers
        container_pattern = r'<div([^>]*data-spa-view[^>]*)>'
        
        def add_debug(match):
            existing_attrs = match.group(1)
            debug_str = ' '.join([f'{k}="{v}"' for k, v in debug_attrs.items()])
            return f'<div {existing_attrs} {debug_str}>'
        
        blade_code = re.sub(container_pattern, add_debug, blade_code)
        
        return blade_code
