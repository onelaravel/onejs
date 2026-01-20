# Node.js Blade Compiler

This is a Node.js implementation of the Blade compiler for One Laravel, converted from Python to provide better integration with the Node.js ecosystem.

## Features

- ✅ **Full Blade Template Support**: All Blade directives (@extends, @vars, @if, @foreach, etc.)
- ✅ **Event Directives**: Complete DOM events support (80+ events)
- ✅ **Server/Client Side Rendering**: @serverside/@clientside with aliases
- ✅ **View Functions**: render, prerender, loadServerData, init, destroy
- ✅ **CSS Support**: Dynamic CSS injection and removal
- ✅ **Error Handling**: Try-catch blocks in generated functions
- ✅ **Source Maps**: Debugging support
- ✅ **Modular Architecture**: Clean, maintainable code structure

## Installation

```bash
cd scripts/node
npm install
```

## Usage

### Basic Build
```bash
npm run build
```

### Verbose Build
```bash
npm run build:verbose
```

### Direct Node.js Usage
```bash
node build.js
node build.js --verbose
```

## Architecture

### Core Components

1. **Main Compiler** (`main-compiler.js`)
   - Orchestrates the entire compilation process
   - Converts Blade templates to JavaScript view functions

2. **Template Processor** (`template-processor.js`)
   - Processes Blade directives and template content
   - Handles server/client side rendering
   - Manages event directives

3. **Parsers** (`parsers.js`)
   - Parse various Blade directives (@extends, @vars, @fetch, etc.)
   - Handle PHP to JavaScript conversion

4. **Function Generators** (`function-generators.js`)
   - Generate render, prerender, loadServerData functions
   - Handle CSS functions and error handling

5. **Event Processor** (`event-directive-processor.js`)
   - Process event directives (@click, @change, etc.)
   - Support for 80+ DOM events

### File Structure

```
scripts/node/
├── build.js                          # Main build script
├── package.json                      # Dependencies
├── README.md                         # This file
└── compiler/
    ├── config.js                     # Configuration
    ├── utils.js                      # Utility functions
    ├── main-compiler.js              # Main compiler class
    ├── parsers.js                    # Directive parsers
    ├── template-processor.js         # Template processing
    ├── template-analyzer.js          # Template analysis
    ├── function-generators.js        # Function generation
    ├── compiler-utils.js             # Compiler utilities
    ├── template-processors.js        # Template processors
    ├── conditional-handlers.js       # Conditional logic
    ├── loop-handlers.js              # Loop handling
    ├── section-handlers.js           # Section handling
    ├── directive-processors.js       # Directive processing
    ├── event-directive-processor.js  # Event processing
    ├── php-converter.js              # PHP to JS conversion
    ├── wrapper-parser.js             # Wrapper parsing
    └── register-parser.js            # Register parsing
```

## Configuration

The compiler uses the same configuration as the Python version:

```json
{
  "paths": {
    "views_input": "resources/views",
    "js_input": "resources/js/app",
    "build_output": "resources/js/build",
    "app_output": "public/static/app"
  },
  "build_directories": [
    "web",
    "admin", 
    "layouts",
    "partials",
    "custom",
    "base"
  ]
}
```

## Supported Directives

### Core Directives
- `@extends('layout')` - Extend a layout
- `@vars({user, posts})` - Declare variables
- `@let(variable = value)` - Declare local variables
- `@const(CONSTANT = value)` - Declare constants
- `@useState(stateKey)` - State management
- `@viewType('component')` - Set view type

### Control Structures
- `@if/@elseif/@else/@endif` - Conditional statements
- `@unless/@endunless` - Negative conditionals
- `@foreach/@endforeach` - Loop through arrays
- `@for/@endfor` - For loops
- `@while/@endwhile` - While loops

### Template Directives
- `@section/@endsection` - Define sections
- `@yield('section')` - Yield section content
- `@include('view')` - Include other views
- `@csrf` - CSRF token
- `@method('PUT')` - HTTP method override

### Event Directives
- `@click(handler)` - Click events
- `@change(handler)` - Change events
- `@submit(handler)` - Submit events
- And 80+ other DOM events

### Server/Client Side
- `@serverside/@endserverside` - Server-side only content
- `@clientside/@endclientside` - Client-side only content
- Aliases: `@ssr/@endssr`, `@csr/@endcsr`, etc.

### Lifecycle
- `@onInit(code)` - Initialization code
- `@register({...})` - Register components/resources
- `@wrapper(content)` - Wrapper content

## Generated Output

The compiler generates:

1. **Individual View Files** (`resources/js/app/views/`)
   - One file per Blade template
   - ES6 module exports
   - Complete view configuration

2. **ViewTemplate.js** (`resources/js/app/core/ViewTemplate.js`)
   - Centralized view registry
   - Import/export management

## Example Output

```javascript
// WebHome.js
export function WebHome(data = {}) {
    const {App, View} = data;
    const __VIEW_PATH__ = 'web.home';
    const __VIEW_ID__ = data.__SSR_VIEW_ID__ || App.View.generateViewId();
    const __VIEW_TYPE__ = 'component';
    
    self.setup('web.home', {
        superView: 'layouts.base',
        hasSuperView: true,
        viewType: 'component',
        sections: {...},
        hasAwaitData: false,
        hasFetchData: false,
        fetch: null,
        data: data,
        viewId: __VIEW_ID__,
        path: __VIEW_PATH__,
        usesVars: true,
        hasSections: true,
        hasSectionPreload: false,
        hasPrerender: false,
        prerender: function(__$spaViewData$__ = {}) { ... },
        render: function(__$spaViewData$__ = {}) {
            let {user, posts} = __$spaViewData__ || {};
            let __outputRenderedContent__ = '';
            try {
                __outputRenderedContent__ = `<div>Welcome ${user.name}</div>`;
            } catch(e) {
                __outputRenderedContent__ = this.showError(e.message);
            }
            return App.View.extendView('layouts.base');
        },
        loadServerData: function(__$spaViewData$__ = {}) {
            let {user, posts} = __$spaViewData__ || {};
            // Load server data - no template content needed
        },
        init: function(__$spaViewData$__ = {}) { },
        destroy: function() {},
        addCSS: function() { ... },
        removeCSS: function() { ... }
    });
    return self;
}
```

## Development

### Adding New Directives

1. Add parser logic in `parsers.js`
2. Add processor logic in `template-processor.js`
3. Update function generators if needed
4. Test with sample templates

### Adding New Events

1. Add event type to `template-processor.js` eventTypes array
2. Ensure event processor handles the new event type
3. Update ViewConfig.js constants if needed

## Performance

The Node.js compiler provides:
- **Fast compilation**: Native JavaScript processing
- **Memory efficient**: No Python interpreter overhead
- **Better integration**: Direct Node.js ecosystem access
- **Source maps**: Full debugging support

## Migration from Python

The Node.js compiler is a complete rewrite that maintains 100% compatibility with the Python version:

- ✅ Same configuration format
- ✅ Same directive syntax
- ✅ Same output format
- ✅ Same build process
- ✅ Same error handling

## Troubleshooting

### Common Issues

1. **Module not found**: Ensure all dependencies are installed with `npm install`
2. **Syntax errors**: Check Blade template syntax
3. **Import errors**: Verify file paths and exports

### Debug Mode

Use verbose mode for detailed output:
```bash
npm run build:verbose
```

## License

MIT License - Same as the main One Laravel project.

