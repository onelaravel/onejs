#!/usr/bin/env node

/**
 * Generate assets loading order for HTML
 * Reads webpack build output and creates ordered script tags
 * Supports context-based builds (web, admin, etc.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load build.config.json to get context paths
const buildConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../build.config.json'), 'utf-8'));

// Get context from environment variable
const buildContext = process.env.BUILD_CONTEXT || 'web';

// Determine static path based on context
const STATIC_PATH = buildConfig.contexts[buildContext] 
    ? path.join(__dirname, '..', path.dirname(buildConfig.contexts[buildContext].dist.bundle))
    : path.join(__dirname, '../public/static/app');

// Determine base URL path for assets
const BASE_URL = buildConfig.contexts[buildContext]
    ? `/static/${buildContext}/js/`
    : '/static/app/';

const OUTPUT_FILE = path.join(__dirname, '../resources/views/partials/assets-scripts.blade.php');

function getAssetsByCategory() {
    const assets = {
        runtime: [],
        framework: [],
        main: [],
        other: []
    };

    try {
        if (!fs.existsSync(STATIC_PATH)) {
            console.warn(`⚠️  Static path does not exist: ${STATIC_PATH}`);
            return assets;
        }

        const files = fs.readdirSync(STATIC_PATH);
        
        files.forEach(file => {
            if (!file.endsWith('.js') || file.endsWith('.map')) return;
            
            // Runtime chunk (must load first)
            if (file.startsWith('runtime')) {
                assets.runtime.push(file);
            }
            // Framework chunks (vendor, core libraries)
            else if (file.startsWith('framework-')) {
                assets.framework.push(file);
            }
            // Main chunks (application code)
            else if (file.startsWith('main')) {
                assets.main.push(file);
            }
            // Legacy or other chunks
            else {
                assets.other.push(file);
            }
        });

        // Sort by filename to ensure consistent order
        Object.keys(assets).forEach(key => {
            assets[key].sort();
        });

        return assets;
    } catch (error) {
        console.error('Error reading assets:', error);
        return assets;
    }
}

function generateBladeTemplate(assets) {
    const lines = [
        '{{-- Auto-generated webpack assets --}}',
        `{{-- Context: ${buildContext} --}}`,
        '{{-- Generated at: ' + new Date().toISOString() + ' --}}',
        '{{-- Load order: runtime → framework → main --}}',
        ''
    ];

    // Runtime chunk (must load first)
    if (assets.runtime.length > 0) {
        lines.push('{{-- Runtime chunk (webpack runtime) --}}');
        assets.runtime.forEach(file => {
            lines.push(`<script src="${BASE_URL}${file}" defer></script>`);
        });
        lines.push('');
    }

    // Framework chunks (vendor dependencies)
    if (assets.framework.length > 0) {
        lines.push('{{-- Framework chunks (vendor dependencies) --}}');
        assets.framework.forEach(file => {
            lines.push(`<script src="${BASE_URL}${file}" defer></script>`);
        });
        lines.push('');
    }

    // Main application chunks
    if (assets.main.length > 0) {
        lines.push('{{-- Main application chunks --}}');
        assets.main.forEach(file => {
            lines.push(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    // Other chunks (if any)
    if (assets.other.length > 0) {
        lines.push('');
        lines.push('{{-- Other chunks --}}');
        assets.other.forEach(file => {
            lines.push(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    return lines.join('\n');
}

function generateHTMLTemplate(assets) {
    console.log('\n📋 **HTML Script Tags (in loading order):**\n');
    
    if (assets.runtime.length > 0) {
        console.log('<!-- Runtime chunk (webpack runtime) -->');
        assets.runtime.forEach(file => {
            console.log(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    if (assets.framework.length > 0) {
        console.log('<!-- Framework chunks -->');
        assets.framework.forEach(file => {
            console.log(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    if (assets.main.length > 0) {
        console.log('<!-- Main chunks -->');
        assets.main.forEach(file => {
            console.log(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    if (assets.other.length > 0) {
        console.log('<!-- Other chunks -->');
        assets.other.forEach(file => {
            console.log(`<script src="${BASE_URL}${file}" defer></script>`);
        });
    }

    console.log('\n💡 **Usage in your layout:**');    console.log('');
}

function main() {
    console.log('🔍 Analyzing webpack assets...');
    
    const assets = getAssetsByCategory();
    
    const totalFiles = Object.values(assets).flat().length;
    
    console.log('📊 **Assets Summary:**');
    console.log(`- Runtime chunks: ${assets.runtime.length}`);
    console.log(`- Framework chunks: ${assets.framework.length}`);
    console.log(`- Main chunks: ${assets.main.length}`);
    console.log(`- Other chunks: ${assets.other.length}`);
    console.log(`- Total JS files: ${totalFiles}`);

    // Generate Blade template
    const bladeContent = generateBladeTemplate(assets);
    
    try {
        fs.writeFileSync(OUTPUT_FILE, bladeContent);
        console.log(`✅ Generated Blade template: ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('❌ Error writing Blade template:', error);
    }

    // Show HTML version
    generateHTMLTemplate(assets);
    
    console.log('💡 **Usage in your layout:**');
    console.log('@include("partials.assets-scripts")');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { getAssetsByCategory, generateBladeTemplate };
