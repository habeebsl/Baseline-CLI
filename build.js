const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  try {
        // Build the CLI entry point and all commands
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node14',
      outfile: 'dist/index.js',
      format: 'cjs',
      external: [
        // Keep these as peer dependencies, don't bundle them
        'typescript',
        'vscode-css-languageservice',
        'vscode-html-languageservice'
      ],
      banner: {
        js: '#!/usr/bin/env node\nconst import_meta = { url: require("url").pathToFileURL(__filename).href };'
      },
      sourcemap: false,
      minify: false,
      logLevel: 'info',
    });

    // Copy web-features data.json to dist directory
    const dataJsonSource = path.join(__dirname, 'node_modules/web-features/data.json');
    const dataJsonDest = path.join(__dirname, 'dist/data.json');
    
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    
    if (fs.existsSync(dataJsonSource)) {
      fs.copyFileSync(dataJsonSource, dataJsonDest);
      console.log('✅ Copied web-features data.json');
    } else {
      console.warn('⚠️  Warning: web-features data.json not found');
    }

    console.log('✅ Build completed successfully!');
    
    // Post-process: Remove duplicate import_meta declaration
    let distCode = fs.readFileSync('dist/index.js', 'utf-8');
    // Remove "var import_meta = {};" line
    distCode = distCode.replace(/^var import_meta = \{\};$/gm, '// var import_meta = {}; // removed - defined in banner');
    fs.writeFileSync('dist/index.js', distCode);
    console.log('✅ Post-processed dist/index.js');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
