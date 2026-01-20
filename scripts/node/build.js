/**
 * Node.js Build Script - Main entry point
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { CompilerConfig } = require('./compiler/config');
const BladeCompiler = require('./compiler/main-compiler');

class NodeBuildScript {
    constructor() {
        this.config = new CompilerConfig();
        this.compiler = new BladeCompiler();
        this.verbose = false;
    }

    async run() {
        /** Main build function */
        console.log('✓ Using Node.js Blade compiler');
        console.log('Starting build script...');
        
        if (this.verbose) {
            this.config.printConfig();
        }
        
        const buildDirectories = this.config.get('build_directories');
        console.log(`Build directories: ${buildDirectories.length} directories`);
        
        for (let i = 0; i < buildDirectories.length; i++) {
            const dir = buildDirectories[i];
            const dirPath = path.join(this.config.get('paths.views_input'), dir);
            console.log(`  ${i + 1}. ${dirPath}`);
        }
        
        let totalCompiled = 0;
        let totalViews = [];
        
        // Build each directory
        for (const dir of buildDirectories) {
            const result = await this.buildDirectory(dir);
            totalCompiled += result.compiled;
            totalViews.push(...result.views);
        }
        
        console.log('\n=== Overall Results ===');
        console.log(`Total compiled: ${totalCompiled}/${totalCompiled} files successfully`);
        
        // Build individual view files
        await this.buildIndividualViews(totalViews);
        
        console.log('\n✅ Node.js build completed successfully!');
        console.log(`📦 Total views: ${totalViews.length}`);
        console.log(`📄 Views: [${totalViews.map(v => `'${v}'`).join(', ')}]`);
        console.log(`📁 ViewTemplate.js: ${path.join(this.config.get('paths.js_input'), 'core', 'ViewTemplate.js')}`);
        console.log(`📁 Individual view files: ${path.join(this.config.get('paths.js_input'), 'views')}`);
        console.log('\n💡 Next step: Run \'npm run compile\' to build main.js');
    }

    async buildDirectory(dirName) {
        /** Build a single directory */
        const dirPath = path.join(this.config.get('paths.views_input'), dirName);
        
        if (!fs.existsSync(dirPath)) {
            console.log(`\n=== Building directory: ${dirPath} ===`);
            console.log(`Directory not found: ${dirPath}`);
            return { compiled: 0, views: [] };
        }
        
        console.log(`\n=== Building directory: ${dirPath} ===`);
        
        // Find all blade files
        const pattern = path.join(dirPath, '**/*.blade.php');
        const files = glob.sync(pattern);
        
        console.log(`Found ${files.length} blade files`);
        
        let compiled = 0;
        const views = [];
        
        for (const file of files) {
            const relativePath = path.relative(this.config.get('paths.views_input'), file);
            const viewName = relativePath.replace(/\.blade\.php$/, '').replace(/\//g, '.');
            
            try {
                const bladeCode = fs.readFileSync(file, 'utf8');
                const jsCode = this.compiler.compileBladeToJs(bladeCode, viewName);
                
                // Generate function name
                const functionName = this.compiler.convertViewPathToFunctionName(viewName);
                
                console.log(`Compiling: ${file}`);
                console.log(`  -> ${viewName} [SUCCESS]`);
                
                // Store for later processing
                views.push({
                    name: viewName,
                    functionName: functionName,
                    code: jsCode
                });
                
                compiled++;
            } catch (error) {
                console.log(`Compiling: ${file}`);
                console.log(`  -> ${viewName} [ERROR: ${error.message}]`);
            }
        }
        
        console.log(`Directory completed: ${compiled}/${files.length} files successfully`);
        return { compiled, views };
    }

    async buildIndividualViews(views) {
        /** Build individual view files */
        const viewsDir = path.join(this.config.get('paths.js_input'), 'views');
        
        // Clean views directory
        if (fs.existsSync(viewsDir)) {
            const files = fs.readdirSync(viewsDir);
            for (const file of files) {
                if (file.endsWith('.js')) {
                    fs.unlinkSync(path.join(viewsDir, file));
                }
            }
        } else {
            fs.mkdirSync(viewsDir, { recursive: true });
        }
        
        console.log(`✓ Cleaned views directory: ${viewsDir}`);
        
        // Write individual view files
        for (const view of views) {
            const fileName = `${view.functionName}.js`;
            const filePath = path.join(viewsDir, fileName);
            
            fs.writeFileSync(filePath, view.code);
            console.log(`Created view file: ${fileName}`);
        }
        
        // Build ViewTemplate.js
        await this.buildViewTemplate(views);
        
        console.log(`Successfully built ViewTemplate.js: ${path.join(this.config.get('paths.js_input'), 'core', 'ViewTemplate.js')}`);
        console.log(`ViewTemplate.js built successfully: ${path.join(this.config.get('paths.js_input'), 'core', 'ViewTemplate.js')}`);
    }

    async buildViewTemplate(views) {
        /** Build ViewTemplate.js file */
        const viewTemplateContent = this.generateViewTemplateContent(views);
        const viewTemplatePath = path.join(this.config.get('paths.js_input'), 'core', 'ViewTemplate.js');
        
        // Ensure core directory exists
        const coreDir = path.dirname(viewTemplatePath);
        if (!fs.existsSync(coreDir)) {
            fs.mkdirSync(coreDir, { recursive: true });
        }
        
        fs.writeFileSync(viewTemplatePath, viewTemplateContent);
    }

    generateViewTemplateContent(views) {
        /** Generate ViewTemplate.js content */
        const imports = views.map(view => 
            `import { ${view.functionName} } from '../views/${view.functionName}.js';`
        ).join('\n');
        
        const viewObjects = views.map(view => 
            `    '${view.name}': ${view.functionName}`
        ).join(',\n');
        
        return `// Auto-generated ViewTemplate.js
// Generated by Node.js Blade Compiler

${imports}

const ViewTemplate = {
${viewObjects}
};

export default ViewTemplate;
`;
    }

    setVerbose(verbose) {
        /** Set verbose mode */
        this.verbose = verbose;
    }
}

// CLI interface
if (require.main === module) {
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
}

module.exports = NodeBuildScript;

