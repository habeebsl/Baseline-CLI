# Baseline CLI

A command-line tool that analyzes HTML, CSS, and JavaScript files to detect web platform features and check their compatibility against the Web Platform Baseline. Identifies features that aren't widely supported across browsers and helps maintain cross-browser compatibility.

## Installation

```bash
npm install -g @habeebsl/baseline-cli
```

## Quick Start

Initialize a configuration file in your project:

```bash
baseline init
```

Check your files for baseline compatibility:

```bash
baseline check
```

## Commands

### `baseline init`

Creates a `.baseline.config.json` file in the current directory with preset configuration options.

**Options:**

- `--preset <type>` - Choose a configuration preset: `strict`, `balanced`, or `legacy` (default: `balanced`)
- `--force` - Overwrite existing configuration file

**Presets:**

- **strict**: Fails on any feature not in the high baseline. Enables auto-fix. Recommended for projects targeting modern browsers.
- **balanced**: Warns on newer features, ignores widely-supported ones. Suitable for most projects.
- **legacy**: Permissive mode targeting the low baseline. Useful for projects supporting older browsers.

**Example:**

```bash
baseline init --preset strict
```

### `baseline check`

Scans files for web platform features and reports compatibility issues.

**Usage:**

```bash
baseline check [files/directories] [options]
```

**Options:**

- `--config <path>` - Path to configuration file (default: `.baseline.config.json`)
- `--format <type>` - Output format: `console`, `html`, `text`, or `json` (default: `console`)
- `--output <path>` - Write output to file (required for html/text/json formats)
- `--strict` - Fail on warnings, not just errors
- `--baseline <level>` - Override target baseline: `high` or `low`

**Examples:**

```bash
# Check all files using config patterns
baseline check

# Check specific directory
baseline check src/

# Check specific files
baseline check src/app.js src/styles.css

# Generate HTML report
baseline check --format html --output report.html

# Use strict mode with low baseline
baseline check --strict --baseline low
```

### `baseline config`

View or modify the current configuration interactively.

```bash
baseline config
```

### `baseline fix`

Fix baseline compatibility issues in CSS files using AI. Analyzes CSS code and generates modern equivalents for outdated syntax.

**Usage:**

```bash
baseline fix <file> [options]
```

**Options:**

- `--lines <start-end>` - Fix only specific lines (e.g., `--lines 30-60`)
- `--config <path>` - Path to configuration file
- `--provider <openai|anthropic>` - AI provider to use (default: `openai`)
- `--api-key <key>` - API key (overrides config and environment variables)

**Examples:**

```bash
# Fix entire CSS file
baseline fix src/styles.css

# Fix specific line range
baseline fix src/styles.css --lines 30-60

# Use Anthropic instead of OpenAI
baseline fix src/styles.css --provider anthropic

# Provide API key directly
baseline fix src/styles.css --api-key sk-your-key-here
```

**API Key Configuration:**

The fix command requires an AI API key. Configure it in one of three ways:

1. **Config file** (`.baseline.config.json`):
```json
{
  "ai": {
    "defaultProvider": "openai",
    "providers": {
      "openai": {
        "apiKey": "sk-your-openai-key"
      },
      "anthropic": {
        "apiKey": "sk-ant-your-anthropic-key"
      }
    }
  }
}
```
Then switch providers with `--provider anthropic` flag.

**You can also use environment variable expansion in the config file:**
```json
{
  "ai": {
    "defaultProvider": "openai",
    "providers": {
      "openai": {
        "apiKey": "${MY_OPENAI_KEY}"
      },
      "anthropic": {
        "apiKey": "${MY_ANTHROPIC_KEY}"
      }
    }
  }
}
```

2. **Environment variable**:
```bash
export OPENAI_API_KEY=sk-your-key-here
# or
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Or use a `.env` file** (automatically loaded if present):
```bash
# .env
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Or custom variable names
MY_OPENAI_KEY=sk-your-key-here
```
# or
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

3. **Command line flag**:
```bash
baseline fix file.css --api-key sk-your-key-here
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

## Configuration

The `.baseline.config.json` file controls how the CLI analyzes your code. Example configuration:

```json
{
  "strict": false,
  "targets": {
    "baseline": "high"
  },
  "rules": {
    "css-grid": "warn",
    "flexbox": "off",
    "async-functions": "off",
    "fetch": "off",
    "custom-elements": "warn"
  },
  "ignore": [
    "node_modules/**",
    "dist/**",
    "*.min.js"
  ],
  "include": [
    "src/**",
    "*.html",
    "*.css",
    "*.js"
  ],
  "outputFormat": "console",
  "ai": {
    "defaultProvider": "openai",
    "providers": {
      "openai": {
        "apiKey": "sk-your-openai-key"
      },
      "anthropic": {
        "apiKey": "sk-ant-your-anthropic-key"
      }
    }
  }
}
```

**Configuration Options:**

- `strict` - Treat warnings as errors
- `targets.baseline` - Target baseline level: `high` (widely available) or `low` (newly available)
- `rules` - Override severity for specific features: `error`, `warn`, or `off`
- `ignore` - Glob patterns for files to exclude
- `include` - Glob patterns for files to check
- `outputFormat` - Default output format: `console`, `html`, `text`, or `json`
- `ai.defaultProvider` - Default AI provider for fix command: `openai` or `anthropic`
- `ai.providers.openai.apiKey` - OpenAI API key (optional, can use environment variables)
- `ai.providers.anthropic.apiKey` - Anthropic API key (optional, can use environment variables)

## Output Formats

### Console (default)

Displays results in the terminal with color-coded severity levels.

### HTML

Generates a styled HTML report with interactive features. Includes:
- Summary statistics
- Sortable/filterable issue list
- Feature details with baseline status
- File-by-file breakdown

### Text

Plain text format suitable for CI/CD logs or documentation.

### JSON

Machine-readable format for integration with other tools. Structure:

```json
{
  "summary": {
    "totalFiles": 5,
    "totalIssues": 12,
    "errors": 7,
    "warnings": 5
  },
  "files": [
    {
      "path": "src/app.js",
      "issues": [
        {
          "feature": "async-await",
          "severity": "error",
          "message": "Feature not in target baseline",
          "line": 42,
          "baselineStatus": false
        }
      ]
    }
  ]
}
```

## Detected Features

The CLI analyzes the following:

**JavaScript:**
- Modern syntax (async/await, classes, arrow functions, destructuring)
- APIs (Fetch, WebSockets, Service Workers, IndexedDB)
- Built-in objects (Map, Set, Promise, Proxy)
- Array/Object methods (forEach, map, filter, Object.assign)
- Operators (optional chaining, nullish coalescing, spread)

**CSS:**
- Layout (Grid, Flexbox, Multi-column)
- Properties (custom properties, transforms, animations)
- Selectors (pseudo-classes, attribute selectors)
- Functions (calc, clamp, var)
- Media queries and container queries

**HTML:**
- Semantic elements (article, section, nav)
- Form elements (input types, validation)
- Media elements (video, audio, picture)
- Custom elements and web components
- Dialog, details, and other modern elements

## Exit Codes

- `0` - No errors found (or only warnings in non-strict mode)
- `1` - Errors found or command failed

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Baseline Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g baseline-cli
      - run: baseline check --format json --output baseline-report.json
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: baseline-report
          path: baseline-report.json
```

## Development

Build from source:

```bash
git clone https://github.com/habeebsl/Baseline-CLI.git
cd Baseline-CLI
npm install
npm run build
npm link
```

The CLI uses:
- TypeScript Compiler API for JavaScript/TypeScript parsing
- VS Code CSS Language Service for CSS analysis
- VS Code HTML Language Service for HTML analysis
- web-features dataset for baseline compatibility data

## License

MIT