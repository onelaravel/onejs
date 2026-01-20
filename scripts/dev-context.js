#!/usr/bin/env node

/**
 * Development Script with Context Support (web/admin)
 * - Watch blade files and JS core files (auto-detect from build.config.json)
 * - Auto-compile templates when changed
 * - Auto-rebuild webpack when JS changed
 * - Run PHP artisan serve
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get context from command line argument
const context = process.argv[2] || 'web'; // Default to 'web'

if (!['web', 'admin'].includes(context)) {
    console.error('❌ Invalid context. Use: web or admin');
    process.exit(1);
}

// Load build config
const buildConfigPath = path.resolve(__dirname, '../build.config.json');
const buildConfig = JSON.parse(readFileSync(buildConfigPath, 'utf-8'));
const contextConfig = buildConfig.contexts[context];

if (!contextConfig) {
    console.error(`❌ Context "${context}" not found in build.config.json`);
    process.exit(1);
}

const config = {
    context: context,
    watchPaths: {
        blade: contextConfig.sources, // Array of blade source paths from config
        jsCore: 'resources/js/onejs', // Watch entire onejs directory
        jsViewsExclude: 'resources/js/onejs/views', // Exclude views directory
        compiler: 'scripts/compiler'
    },
    buildCommand: `npm run build:${context}`,
    phpServeCommand: 'php artisan serve',
    phpPort: context === 'admin' ? 8001 : 8000,
    wsPort: context === 'admin' ? 3301 : 3300
};

class ContextDevServer {
    constructor() {
        this.processes = {
            phpServe: null
        };
        this.wss = null;
        this.isBuilding = false;
        this.debounceTimer = null;
        this.debounceDelay = 300; // ms
    }

    async start() {
        console.log(`🚀 Starting Development Server for [${config.context.toUpperCase()}] context...\n`);
        
        // Initial build (templates + webpack)
        await this.runBuild();
        
        // Start PHP artisan serve
        this.startPhpServe();
        
        // Start WebSocket server for auto-reload
        this.startWebSocketServer();
        
        // Create reload script file
        this.createReloadScript();
        
        // Start file watcher for blade and compiler files
        this.startWatcher();
        
        console.log('\n✅ Development server started!');
        console.log(`📦 Context: ${config.context.toUpperCase()}`);
        console.log('📝 Watching:');
        console.log(`   - Blade files: ${config.watchPaths.blade.join(', ')}`);
        console.log(`   - JS Core: ${config.watchPaths.jsCore} (excluding views)`);
        console.log(`   - Compiler: ${config.watchPaths.compiler}`);
        console.log(`🌐 Laravel Server: http://localhost:${config.phpPort}`);
        console.log(`🔄 Auto-reload: Active (add script to your layout)`);
        console.log(`⚡ Auto-rebuild: npm run build:${config.context}`);
        console.log('\n💡 Add this to your blade layout:');
        console.log(`   <script src="/reload-dev.js"></script>`);
        console.log('\n💡 Press Ctrl+C to stop\n');
    }

    async runBuild() {
        if (this.isBuilding) {
            console.log('⏳ Build already in progress, skipping...');
            return;
        }
        
        this.isBuilding = true;
        console.log(`🔨 Building [${config.context}] (templates + webpack)...`);
        
        return new Promise((resolve, reject) => {
            const build = spawn('sh', ['-c', config.buildCommand], { 
                stdio: 'inherit',
                cwd: path.resolve(__dirname, '..')
            });
            
            build.on('close', (code) => {
                this.isBuilding = false;
                if (code === 0) {
                    console.log(`✅ Build completed for [${config.context}]`);
                    // Trigger browser reload via WebSocket
                    this.notifyReload();
                    resolve();
                } else {
                    console.error(`❌ Build failed with code ${code}\n`);
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
            
            build.on('error', (err) => {
                this.isBuilding = false;
                console.error('❌ Failed to start build process:', err);
                reject(err);
            });
        });
    }

    startWebSocketServer() {
        console.log(`🔄 Starting WebSocket server on port ${config.wsPort}...\n`);
        
        this.wss = new WebSocketServer({ port: config.wsPort });
        
        this.wss.on('connection', (ws) => {
            ws.on('error', console.error);
        });
    }

    notifyReload() {
        if (this.wss) {
            console.log('🔄 Reloading browser...\n');
            this.wss.clients.forEach((client) => {
                if (client.readyState === 1) { // OPEN
                    client.send('reload');
                }
            });
        }
    }

    createReloadScript() {
        const scriptContent = `
(function() {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return; // Only run on local development
    }
    
    const ws = new WebSocket('ws://localhost:${config.wsPort}');
    
    ws.onmessage = function(event) {
        if (event.data === 'reload') {
            console.log('[DEV] Reloading page...');
            window.location.reload();
        }
    };
    
    ws.onerror = function() {
        console.log('[DEV] WebSocket connection failed');
    };
    
    ws.onclose = function() {
        // Reconnect after 1 second
        setTimeout(function() {
            window.location.reload();
        }, 1000);
    };
})();
`;
        
        const publicPath = path.resolve(__dirname, '../public/reload-dev.js');
        writeFileSync(publicPath, scriptContent, 'utf-8');
        console.log(`✅ Created reload script at public/reload-dev.js\n`);
    }

    startPhpServe() {
        console.log(`🐘 Starting PHP server on port ${config.phpPort}...`);
        
        this.processes.phpServe = spawn('php', ['artisan', 'serve', `--port=${config.phpPort}`], {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '..')
        });

        this.processes.phpServe.on('error', (err) => {
            console.error('❌ PHP server error:', err);
        });

        this.processes.phpServe.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.error(`❌ PHP server exited with code ${code}`);
            }
        });
    }

    startWatcher() {
        // Watch blade files (multiple source directories from config)
        config.watchPaths.blade.forEach(bladePath => {
            console.log(`👀 Watching blade files in: ${bladePath}`);
            watch(bladePath, { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith('.blade.php')) {
                    this.handleFileChange('blade', path.join(bladePath, filename));
                }
            });
        });

        // Watch JS core files (entire onejs directory, excluding views)
        console.log(`👀 Watching JS core in: ${config.watchPaths.jsCore} (excluding views)`);
        watch(config.watchPaths.jsCore, { recursive: true }, (eventType, filename) => {
            if (filename && filename.endsWith('.js')) {
                const fullPath = path.join(config.watchPaths.jsCore, filename);
                // Skip if file is in views directory
                if (!fullPath.includes(path.sep + 'views' + path.sep) && !fullPath.endsWith(path.sep + 'views')) {
                    this.handleFileChange('js-core', filename);
                }
            }
        });

        // Watch compiler files
        console.log(`👀 Watching compiler in: ${config.watchPaths.compiler}`);
        watch(config.watchPaths.compiler, { recursive: true }, (eventType, filename) => {
            if (filename && (filename.endsWith('.py') || filename.endsWith('.js'))) {
                this.handleFileChange('compiler', filename);
            }
        });
    }

    handleFileChange(type, filename) {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce to avoid multiple rapid builds
        this.debounceTimer = setTimeout(() => {
            console.log(`\n📝 [${type.toUpperCase()}] File changed: ${filename}`);
            
            // Rebuild everything (templates + webpack) for any changes
            this.runBuild().catch(err => {
                console.error('Build error:', err);
            });
        }, this.debounceDelay);
    }

    stop() {
        console.log('\n🛑 Shutting down development server...');
        
        // Stop WebSocket Server
        if (this.wss) {
            console.log('   Stopping WebSocket server...');
            this.wss.close();
        }
        
        // Kill all processes
        Object.keys(this.processes).forEach(key => {
            const proc = this.processes[key];
            if (proc && !proc.killed) {
                console.log(`   Stopping ${key}...`);
                proc.kill('SIGTERM');
                
                // Force kill after 2 seconds if not terminated
                setTimeout(() => {
                    if (!proc.killed) {
                        proc.kill('SIGKILL');
                    }
                }, 2000);
            }
        });

        console.log('✅ Development server stopped');
        process.exit(0);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    if (devServer) {
        devServer.stop();
    }
});

process.on('SIGTERM', () => {
    if (devServer) {
        devServer.stop();
    }
});

// Catch unhandled errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    if (devServer) {
        devServer.stop();
    }
});

// Start development server
const devServer = new ContextDevServer();
devServer.start().catch(err => {
    console.error('❌ Failed to start dev server:', err);
    process.exit(1);
});
