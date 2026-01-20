#!/usr/bin/env node

/**
 * Development Script for Blade Compiler
 * Provides development workflow with hot reload
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';

const config = {
    watchPaths: [
        'resources/views',
        'resources/js/app',
        'scripts/compiler'
    ],
    buildCommand: 'cd scripts && python3 build.py',
    viteCommand: 'npm run dev'
};

class DevServer {
    constructor() {
        this.buildProcess = null;
        this.viteProcess = null;
        this.isBuilding = false;
    }

    async start() {
        console.log('🚀 Starting Blade Compiler Development Server...\n');
        
        // Initial build
        await this.runBuild();
        
        // Start Vite dev server
        this.startVite();
        
        // Start file watcher
        this.startWatcher();
        
        console.log('✅ Development server started!');
        console.log('📝 Watching for changes in:', config.watchPaths.join(', '));
        console.log('🌐 Vite dev server: http://localhost:5173');
        console.log('⚡ Blade compiler: Auto-rebuild on file changes\n');
    }

    async runBuild() {
        if (this.isBuilding) return;
        
        this.isBuilding = true;
        console.log('🔨 Building Blade templates...');
        
        return new Promise((resolve, reject) => {
            const build = spawn('sh', ['-c', 'cd scripts && python3 build.py'], { 
                stdio: 'inherit',
                cwd: process.cwd()
            });
            
            build.on('close', (code) => {
                this.isBuilding = false;
                if (code === 0) {
                    console.log('✅ Build completed successfully\n');
                    resolve();
                } else {
                    console.log('❌ Build failed\n');
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
        });
    }

    startVite() {
        this.viteProcess = spawn('npm', ['run', 'dev'], {
            stdio: 'inherit',
            cwd: process.cwd()
        });
    }

    startWatcher() {
        config.watchPaths.forEach(watchPath => {
            watch(watchPath, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.blade.php') || filename.endsWith('.js'))) {
                    console.log(`📝 File changed: ${filename}`);
                    this.runBuild().catch(console.error);
                }
            });
        });
    }

    stop() {
        if (this.buildProcess) {
            this.buildProcess.kill();
        }
        if (this.viteProcess) {
            this.viteProcess.kill();
        }
        console.log('🛑 Development server stopped');
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    process.exit(0);
});

// Start development server
const devServer = new DevServer();
devServer.start().catch(console.error);
