#!/usr/bin/env python3
"""
Blade Template Builder
Usage: python3 build.py [context]
  context: web, admin, or all (default: all)
Examples:
  python3 build.py        # Build all contexts
  python3 build.py web    # Build web context only
  python3 build.py admin  # Build admin context only
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path

# Import the compiler from the modular architecture
# Using the new modular compiler
try:
    from compile import compile_blade_to_js
    from compiler.config import CompilerConfig
    config = CompilerConfig()
    print("✓ Using modular Blade compiler")
except ImportError as e:
    print(f"Error: compiler module not found: {e}")
    print("Please ensure the compiler directory exists.")
    sys.exit(1)

def convert_path_to_view_name(file_path, views_root_path):
    """
    Convert file path to view name format
    Example: resources/views/web/abc.blade.php -> web.abc
    """
    # Get relative path from resources/views
    relative_path = os.path.relpath(file_path, views_root_path)
    
    # Remove .blade.php extension
    if relative_path.endswith('.blade.php'):
        relative_path = relative_path[:-10]  # Remove .blade.php
    
    # Replace path separators with dots
    view_name = relative_path.replace(os.path.sep, '.').replace('/', '.')
    
    return view_name

def scan_directory(root_path):
    """
    Recursively scan directory for .blade.php files
    Returns list of blade file paths (excluding files starting with *)
    """
    blade_files = []
    
    for root, dirs, files in os.walk(root_path):
        for file in files:
            if file.endswith('.blade.php'):
                # Skip files starting with asterisk (special files)
                # Files starting with underscore (_) will be compiled
                if file.startswith('*'):
                    print(f"Skipping special file: {file}")
                    continue
                    
                file_path = os.path.join(root, file)
                blade_files.append(file_path)
    
    return blade_files

def compile_blade_file(file_path, root_path):
    """
    Compile a single blade file to JavaScript
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            blade_content = f.read()
        
        view_name = convert_path_to_view_name(file_path, root_path)
        result = compile_blade_to_js(blade_content, view_name)
        return result
    
    except Exception as e:
        print(f"Error compiling {file_path}: {str(e)}")
        return None

def build_scope_file(scope, compiled_views, scopes_dir):
    """
    Build a single scope file with new object structure
    """
    # Create scopes directory if it doesn't exist
    os.makedirs(scopes_dir, exist_ok=True)
    
    # Build scope content
    js_content = f"App.View.templates['{scope}'] = {{\n"
    
    for view_name, view_function in compiled_views.items():
        # view_function is now a complete function that returns an object
        js_content += f"    '{view_name}': {view_function},\n"
    
    # Remove last comma and close the scope
    if compiled_views:
        js_content = js_content.rstrip(',\n') + '\n'
    
    js_content += "};\n"
    
    # Write to scope file (build location)
    scope_file = config.get_build_scope_output_path(scope)
    try:
        with open(scope_file, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"Successfully built scope file: {scope_file}")
        return True
    except Exception as e:
        print(f"Error writing to {scope_file}: {str(e)}")
        return False

def build_individual_view_files(compiled_views, blade_files_data, context='all'):
    """
    Build individual view files for each compiled view
    """
    # Always use flat views directory (don't use context subdirectories)
    views_dir = os.path.join(config.js_input_path, 'views')
    
    # Clean views directory before building
    if os.path.exists(views_dir):
        shutil.rmtree(views_dir)
        print(f"✓ Cleaned views directory: {views_dir}")
    
    os.makedirs(views_dir, exist_ok=True)
    
    created_files = []
    
    for view_name, view_function in compiled_views.items():
        # Convert view name to function name (e.g., web.home -> WebHome)
        function_name = convert_view_name_to_function_name(view_name)
        
        # Create individual view file
        view_file_path = os.path.join(views_dir, f'{function_name}.js')
        
        # Build file content
        file_content = ""
        
        # Check if view_function starts with setup script (import statements)
        if view_function.strip().startswith('import '):
            # Split setup script and function
            lines = view_function.split('\n')
            setup_lines = []
            function_lines = []
            in_function = False
            
            for line in lines:
                if line.strip().startswith('export function ') and not in_function:
                    in_function = True
                    # Keep the export function line as is
                    function_lines.append(line)
                elif in_function:
                    function_lines.append(line)
                else:
                    # Only add non-empty lines to setup
                    if line.strip():
                        setup_lines.append(line)
            
            # Add setup script first (without export)
            if setup_lines:
                file_content += '\n'.join(setup_lines) + '\n\n'
            
            # Add function (already has export)
            function_content = '\n'.join(function_lines)
            file_content += function_content
        else:
            # Handle files without setup script - use as is (already has export)
            file_content += view_function
        
        # Write file
        try:
            with open(view_file_path, 'w', encoding='utf-8') as f:
                f.write(file_content)
            created_files.append((view_name, function_name, view_file_path))
            print(f"Created view file: {function_name}.js")
        except Exception as e:
            print(f"Error writing {view_file_path}: {str(e)}")
            return False
    
    return created_files

def convert_view_name_to_function_name(view_name):
    """
    Convert view name to function name
    Example: web.home -> WebHome, admin.dashboard -> AdminDashboard, web.user-detail -> WebUserDetail, web.layouts-base_a1 -> WebLayoutsBaseA1
    """
    # Split by dot and process each part
    parts = view_name.split('.')
    function_parts = []
    
    for part in parts:
        # Remove both - and _ and capitalize after each removal
        # First split by - and _, then capitalize each segment
        segments = []
        for separator in ['-', '_']:
            if separator in part:
                part = part.replace(separator, ' ')
        
        # Split by space and capitalize each word
        words = part.split()
        for word in words:
            if word:
                segments.append(word.capitalize())
        
        if segments:
            function_parts.append(''.join(segments))
    
    return ''.join(function_parts)



def build_view_template_importer(created_files, output_path, context='all'):
    """
    Build ViewTemplate.js that imports all individual view files
    """
    # Get registry output path from build.config.json if context is specified
    build_config = load_build_config()
    
    if build_config and context != 'all' and context in build_config['contexts']:
        # Use context-specific registry file
        output_path = os.path.join(Path(__file__).parent.parent, build_config['contexts'][context]['output']['register'])
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Build import statements
    imports = []
    template_assignments = []
    
    for view_name, function_name, file_path in created_files:
        # Extract actual function name from the compiled file
        actual_function_name = function_name  # Default to converted name
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline()
                # Extract function name from: export function _systemPageEnd(...
                if 'export function ' in first_line:
                    start = first_line.index('export function ') + len('export function ')
                    end = first_line.index('(', start)
                    actual_function_name = first_line[start:end].strip()
        except Exception as e:
            print(f"Warning: Could not extract function name from {file_path}: {e}")
        
        # Calculate relative path from output to view file
        relative_path = os.path.relpath(file_path, os.path.dirname(output_path))
        relative_path = relative_path.replace('\\', '/')  # Normalize path separators
        
        imports.append(f"import {{ {actual_function_name} }} from './{relative_path}';")
        template_assignments.append(f"    '{view_name}': {actual_function_name},")
    
    # Build file content
    file_content = "// Auto-generated ViewTemplate.js\n"
    file_content += "// This file imports all view functions and assigns them to templates\n\n"
    
    # Add imports
    file_content += "\n".join(imports) + "\n\n"
    
    # Add template assignment
    file_content += "export const ViewTemplates = {\n"
    file_content += "\n".join(template_assignments)
    file_content += "\n};\n"
    
    # Write file
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(file_content)
        print(f"Successfully built ViewTemplate.js: {output_path}")
        return True
    except Exception as e:
        print(f"Error writing to {output_path}: {str(e)}")
        return False

def copy_essential_files_to_build():
    """
    Copy view.templates.js to resources/js/app/views/templates.js
    """
    print("\n=== Copying view.templates.js to app/views ===")
    
    # Create views directory if it doesn't exist
    views_dir = os.path.join(config.js_input_path, 'views')
    
    # Clean views directory before copying templates
    if os.path.exists(views_dir):
        shutil.rmtree(views_dir)
        print(f"✓ Cleaned views directory before copying templates: {views_dir}")
    
    os.makedirs(views_dir, exist_ok=True)
    
    # Copy view.templates.js to resources/js/app/views/templates.js
    build_templates = config.get_build_view_templates_output_path()
    app_templates = os.path.join(views_dir, 'templates.js')
    
    if os.path.exists(build_templates):
        shutil.copy2(build_templates, app_templates)
        print(f"✓ Copied view.templates.js: {build_templates} -> {app_templates}")
    else:
        print(f"✗ Build view.templates.js not found: {build_templates}")
        return False
    
    print("=== Copy completed ===")
    return True

def copy_build_to_public():
    """
    Copy only main.js from resources/build to public/static/app
    Keep original files in resources/build intact
    """
    print("\n=== Copying main.js to public ===")
    
    # Copy only main.js
    build_main = config.get_build_main_output_path()
    public_main = config.get_main_output_path()
    
    if os.path.exists(build_main):
        os.makedirs(os.path.dirname(public_main), exist_ok=True)
        shutil.copy2(build_main, public_main)
        print(f"✓ Copied main.js: {build_main} -> {public_main}")
    else:
        print(f"✗ Build main.js not found: {build_main}")
        return False
    
    print("=== Copy completed ===")
    return True

def build_main_spa_file():
    """
    Build the main spa file by combining all modules according to auto-generated build.config.json
    """
    config_path = os.path.join(config.js_input_path, 'build.config.json')
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            build_config = json.load(f)
        
        # Check if config was auto-generated
        if build_config.get('auto_discovery'):
            print(f"📦 Using auto-discovered modules ({len(build_config['modules'])} modules)")
        else:
            print(f"📦 Using manual module configuration ({len(build_config['modules'])} modules)")
            
    except Exception as e:
        print(f"Error reading build config {config_path}: {str(e)}")
        print("💡 Run 'npm run discover' to auto-generate module configuration")
        return False
    
    output_file = build_config.get('output', 'main.js')
    modules = build_config.get('modules', [])
    
    if not modules:
        print("No modules specified in build config")
        return False
    
    # Build the combined content
    combined_content = ""
    app_dir = config.js_input_path
    
    for module in modules:
        module_path = os.path.join(app_dir, module)
        if os.path.exists(module_path):
            try:
                with open(module_path, 'r', encoding='utf-8') as f:
                    module_content = f.read()
                combined_content += f"/* === {module} === */\n"
                combined_content += module_content + "\n\n"
                print(f"Added module: {module}")
            except Exception as e:
                print(f"Error reading module {module}: {str(e)}")
                return False
        else:
            print(f"Warning: Module file not found: {module_path}")
    
    # Write the combined file
    output_path = config.get_build_main_output_path()
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(combined_content)
        print(f"Successfully built main spa file: {output_path}")
        return True
    except Exception as e:
        print(f"Error writing to {output_path}: {str(e)}")
        return False

def load_build_config():
    """Load build.config.json"""
    config_path = Path(__file__).parent.parent / 'build.config.json'
    if not config_path.exists():
        return None
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_contexts_to_build(requested_context='all'):
    """Get list of contexts to build based on request"""
    build_config = load_build_config()
    
    if not build_config or 'contexts' not in build_config:
        return None
    
    if requested_context == 'all':
        return build_config['contexts'].keys()
    elif requested_context in build_config['contexts']:
        return [requested_context]
    else:
        print(f"Error: Unknown context '{requested_context}'")
        print(f"Available contexts: {', '.join(build_config['contexts'].keys())}")
        sys.exit(1)

def get_source_directories(context_name=None):
    """Get source directories for a specific context or all"""
    # Try to load from build.config.json first
    build_config = load_build_config()
    
    if build_config and context_name and context_name in build_config['contexts']:
        # Return sources for specific context
        sources = build_config['contexts'][context_name]['sources']
        # Convert relative paths to absolute
        base_path = Path(__file__).parent.parent
        return [str(base_path / src) for src in sources]
    elif build_config and context_name == 'all':
        # Return all sources from all contexts
        base_path = Path(__file__).parent.parent
        all_sources = set()
        for ctx in build_config['contexts'].values():
            for src in ctx['sources']:
                all_sources.add(str(base_path / src))
        return list(all_sources)
    else:
        # Fallback to config.get_build_directories()
        return config.get_build_directories()

def main():
    """
    Main build function
    """
    # Parse arguments
    parser = argparse.ArgumentParser(description='Build blade templates for specific context')
    parser.add_argument('context', nargs='?', default='all', 
                       help='Context to build: web, admin, or all (default: all)')
    args = parser.parse_args()
    
    print("Starting build script...")
    print(f"Context: {args.context}")
    
    # Get build directories based on context
    build_directories = get_source_directories(args.context)
    
    if not build_directories:
        print("Error: No build directories configured")
        print("Please add 'build_directories' to compiler.config.json or contexts to build.config.json")
        sys.exit(1)
    
    print(f"Build directories: {len(build_directories)} directories")
    for i, dir_path in enumerate(build_directories, 1):
        print(f"  {i}. {dir_path}")
    
    # Compile all directories
    all_compiled_views = {}
    all_blade_files_data = {}
    total_success = 0
    total_files = 0
    
    for dir_path in build_directories:
        print(f"\n=== Building directory: {dir_path} ===")
        
        # Validate directory
        if not os.path.exists(dir_path):
            print(f"Warning: Directory '{dir_path}' does not exist, skipping...")
            continue
        
        if not os.path.isdir(dir_path):
            print(f"Warning: '{dir_path}' is not a directory, skipping...")
            continue
        
        # Scan for blade files in this directory
        blade_files = scan_directory(dir_path)
    
        if not blade_files:
            print(f"No .blade.php files found in {dir_path}")
            continue
        
        print(f"Found {len(blade_files)} blade files")
        total_files += len(blade_files)
        
        # Compile all blade files in this directory
        compiled_views = {}
        success_count = 0
        
        for file_path in blade_files:
            print(f"Compiling: {file_path}")
            
            try:
                # Convert file path to view name (relative to resources/views)
                view_name = convert_path_to_view_name(file_path, config.views_input_path)
                
                # Read blade code for script extraction
                with open(file_path, 'r', encoding='utf-8') as f:
                    blade_code = f.read()
                
                # Compile the blade file
                view_data = compile_blade_file(file_path, config.views_input_path)
                
                if view_data:
                    compiled_views[view_name] = view_data
                    all_compiled_views[view_name] = view_data
                    all_blade_files_data[view_name] = blade_code
                    success_count += 1
                    total_success += 1
                    print(f"  -> {view_name} [SUCCESS]")
                else:
                    print(f"  -> Failed to compile [ERROR]")
            except Exception as e:
                print(f"  -> Exception: {str(e)} [ERROR]")
        
        print(f"Directory completed: {success_count}/{len(blade_files)} files successfully")
    
    print(f"\n=== Overall Results ===")
    print(f"Total compiled: {total_success}/{total_files} files successfully")
    
    if all_compiled_views:
        # Build individual view files
        print(f"\n=== Building individual view files ===")
        created_files = build_individual_view_files(all_compiled_views, all_blade_files_data, args.context)
        
        if created_files:
            # Build context-specific registry (templates.web.js, templates.admin.js)
            view_template_path = os.path.join(config.js_input_path, 'core', 'ViewTemplate.js')
            if build_view_template_importer(created_files, view_template_path, args.context):
                # Get the actual registry path that was created
                build_config = load_build_config()
                if build_config and args.context != 'all' and args.context in build_config['contexts']:
                    registry_path = build_config['contexts'][args.context]['output']['register']
                    registry_filename = os.path.basename(registry_path)
                    
                    # Create a proxy ViewTemplate.js in core/ that re-exports from context registry
                    core_template_path = os.path.join(config.js_input_path, 'core', 'ViewTemplate.js')
                    relative_to_registry = os.path.relpath(
                        os.path.join(Path(__file__).parent.parent, registry_path),
                        os.path.dirname(core_template_path)
                    ).replace('\\', '/')
                    
                    proxy_content = f"""// Auto-generated proxy to context-specific registry
// This file re-exports from {registry_filename}

export {{ ViewTemplates }} from '{relative_to_registry}';
"""
                    
                    with open(core_template_path, 'w', encoding='utf-8') as f:
                        f.write(proxy_content)
                    
                    print(f"Created proxy ViewTemplate.js: {core_template_path}")
                    print(f"  -> Points to: {registry_filename}")
                
                print(f"\n✅ Python build completed successfully!")
                print(f"📦 Total views: {len(all_compiled_views)}")
                print(f"📄 Views: {list(all_compiled_views.keys())}")
                print(f"📁 Registry: {view_template_path}")
                print(f"📁 Individual view files: {os.path.join(config.js_input_path, 'views')}")
                print(f"\n💡 Next step: Run 'npm run compile' to build main.js")
            else:
                print(f"Failed to build ViewTemplate.js!")
                sys.exit(1)
        else:
            print(f"Failed to build individual view files!")
            sys.exit(1)
    else:
        print("No files were successfully compiled!")
        sys.exit(1)

if __name__ == "__main__":
    main()