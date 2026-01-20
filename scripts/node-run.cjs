#!/usr/bin/env node

/**
 * Node.js Blade Compiler Runner
 * This script can be used as a drop-in replacement for the Python compiler
 */

const path = require('path');
const NodeBuildScript = require('./node/build');

// Change to the project root directory
process.chdir(path.join(__dirname, '..'));

// Create and run the build script
const buildScript = new NodeBuildScript();

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--verbose') || args.includes('-v')) {
    buildScript.setVerbose(true);
}

// Run build
buildScript.run().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
});

