#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the python script in the library
const scriptPath = path.resolve(__dirname, '../scripts/build.py');

// Get arguments passed to the CLI
const args = process.argv.slice(2);

console.log('🚀 OneJS Build System');
console.log('Script:', scriptPath);

// Spawn python process
const pythonProcess = spawn('python3', [scriptPath, ...args], {
    stdio: 'inherit',
    env: {
        ...process.env,
        // PASS THE PROJECT ROOT (Current Working Directory of the user)
        ONEJS_PROJECT_ROOT: process.cwd(),
        // PASS THE LIBRARY ROOT (Where the script lives)
        ONEJS_LIB_ROOT: path.resolve(__dirname, '..')
    }
});

pythonProcess.on('close', (code) => {
    process.exit(code);
});
