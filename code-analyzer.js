#!/usr/bin/env node

/**
 * Code Quality and Bug Detection Tool
 * Analyzes the codebase for potential issues, security vulnerabilities, and technical debt
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class CodeAnalyzer {
  constructor() {
    this.issues = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };
    this.stats = {
      filesAnalyzed: 0,
      linesOfCode: 0,
      totalIssues: 0
    };
  }

  addIssue(severity, file, line, issue, description) {
    const issueObj = {
      file,
      line,
      issue,
      description
    };
    
    this.issues[severity].push(issueObj);
    this.stats.totalIssues++;
  }

  analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      log('red', `File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    this.stats.filesAnalyzed++;
    this.stats.linesOfCode += lines.length;

    log('blue', `Analyzing: ${filePath}`);

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      this.checkSecurityIssues(filePath, lineNum, line);
      this.checkCodeQuality(filePath, lineNum, line);
      this.checkPerformanceIssues(filePath, lineNum, line);
    });

    // Check file-level issues
    this.checkFileStructure(filePath, content);
  }

  checkSecurityIssues(file, line, code) {
    // Check for hardcoded credentials
    if (/password.*[=:]\s*['"][^'"]+['"]|api[_-]?key.*[=:]\s*['"][^'"]+['"]/i.test(code)) {
      this.addIssue('critical', file, line, 'Hardcoded Credentials', 
        'Potential hardcoded password or API key found');
    }

    // Check for SQL injection patterns
    if (/\$\{.*\}.*query|query.*\+.*req\.|SELECT.*\+|INSERT.*\+/i.test(code)) {
      this.addIssue('high', file, line, 'SQL Injection Risk', 
        'Potential SQL injection vulnerability');
    }

    // Check for XSS vulnerabilities
    if (/innerHTML.*req\.|innerHTML.*\$\{|\.html\(.*req\./i.test(code)) {
      this.addIssue('high', file, line, 'XSS Vulnerability', 
        'Potential XSS vulnerability through innerHTML manipulation');
    }

    // Check for eval usage
    if (/\beval\s*\(|new\s+Function\s*\(/i.test(code)) {
      this.addIssue('critical', file, line, 'Code Injection', 
        'Use of eval() or Function() constructor can lead to code injection');
    }

    // Check for weak crypto
    if (/md5|sha1(?!256)|base64.*password/i.test(code)) {
      this.addIssue('medium', file, line, 'Weak Cryptography', 
        'Use of weak cryptographic algorithms');
    }

    // Check for console.log in production code
    if (/console\.log|console\.debug|console\.info/i.test(code) && !file.includes('test')) {
      this.addIssue('low', file, line, 'Debug Code', 
        'Console statements should be removed from production code');
    }

    // Check for TODO/FIXME comments
    if (/TODO|FIXME|HACK|XXX/i.test(code)) {
      this.addIssue('info', file, line, 'Technical Debt', 
        'Unfinished code or known issues marked with TODO/FIXME');
    }
  }

  checkCodeQuality(file, line, code) {
    // Check for long lines
    if (code.length > 120) {
      this.addIssue('low', file, line, 'Long Line', 
        `Line exceeds 120 characters (${code.length} chars)`);
    }

    // Check for magic numbers
    if (/\b\d{4,}\b/.test(code) && !/port|PORT|timeout|TIMEOUT/i.test(code)) {
      this.addIssue('medium', file, line, 'Magic Number', 
        'Large numeric literals should be named constants');
    }

    // Check for nested callbacks (callback hell)
    if ((code.match(/function\s*\(/g) || []).length > 2) {
      this.addIssue('medium', file, line, 'Callback Hell', 
        'Deeply nested callbacks detected');
    }

    // Check for unused variables
    if (/const\s+\w+\s*=.*require\(/.test(code) && !file.includes('test')) {
      const varName = code.match(/const\s+(\w+)\s*=/)?.[1];
      if (varName && !code.includes(`${varName}.`)) {
        this.addIssue('low', file, line, 'Unused Import', 
          `Potentially unused import: ${varName}`);
      }
    }

    // Check for synchronous operations in async context
    if (/fs\.readFileSync|fs\.writeFileSync/.test(code) && !file.includes('config')) {
      this.addIssue('medium', file, line, 'Blocking Operation', 
        'Synchronous file operations can block the event loop');
    }
  }

  checkPerformanceIssues(file, line, code) {
    // Check for inefficient loops
    if (/for.*\.length/.test(code)) {
      this.addIssue('low', file, line, 'Inefficient Loop', 
        'Consider caching array length in loop condition');
    }

    // Check for memory leaks (global variables)
    if (/var\s+\w+\s*=.*global|global\.\w+\s*=/.test(code)) {
      this.addIssue('medium', file, line, 'Memory Leak Risk', 
        'Global variable assignment may cause memory leaks');
    }

    // Check for inefficient string concatenation
    if (/\+.*\+.*\+/.test(code) && /string|String/.test(code)) {
      this.addIssue('low', file, line, 'String Concatenation', 
        'Consider using template literals for multiple string concatenations');
    }

    // Check for blocking operations
    if (/sleep\(|delay\(|setTimeout.*await/.test(code)) {
      this.addIssue('medium', file, line, 'Blocking Code', 
        'Potential blocking operation that could affect performance');
    }
  }

  checkFileStructure(file, content) {
    // Check file size
    const lines = content.split('\n').length;
    if (lines > 500) {
      this.addIssue('medium', file, 0, 'Large File', 
        `File has ${lines} lines. Consider breaking into smaller modules`);
    }

    // Check for missing error handling
    if (content.includes('async ') && !content.includes('try') && !content.includes('catch')) {
      this.addIssue('high', file, 0, 'Missing Error Handling', 
        'Async functions should have proper error handling');
    }

    // Check for missing JSDoc
    if (content.includes('function ') && !content.includes('/**')) {
      this.addIssue('low', file, 0, 'Missing Documentation', 
        'Functions should have JSDoc documentation');
    }

    // Check for proper module exports
    if (file.endsWith('.js') && !content.includes('module.exports') && !content.includes('export')) {
      this.addIssue('medium', file, 0, 'No Module Export', 
        'JavaScript modules should export functionality');
    }
  }

  analyzePackageJson() {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      this.addIssue('high', 'package.json', 0, 'Missing Package File', 
        'package.json file not found');
      return;
    }

    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check for outdated dependencies (simplified check)
    if (packageContent.dependencies) {
      Object.entries(packageContent.dependencies).forEach(([dep, version]) => {
        if (version.includes('^') || version.includes('~')) {
          // This is good - allows updates
        } else if (version.match(/^\d+\.\d+\.\d+$/)) {
          this.addIssue('low', 'package.json', 0, 'Fixed Version', 
            `Dependency ${dep} is pinned to exact version`);
        }
      });
    }

    // Check for security scripts
    if (!packageContent.scripts?.audit) {
      this.addIssue('medium', 'package.json', 0, 'Missing Security Audit', 
        'Consider adding npm audit script');
    }

    // Check for test scripts
    if (!packageContent.scripts?.test) {
      this.addIssue('medium', 'package.json', 0, 'Missing Test Script', 
        'No test script defined');
    }
  }

  generateReport() {
    log('cyan', '\n🔍 Code Analysis Report');
    log('cyan', '========================\n');

    // File statistics
    log('white', `📊 Statistics:`);
    log('white', `   Files analyzed: ${this.stats.filesAnalyzed}`);
    log('white', `   Lines of code: ${this.stats.linesOfCode}`);
    log('white', `   Total issues: ${this.stats.totalIssues}\n`);

    // Issue breakdown
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    const severityColors = ['red', 'red', 'yellow', 'blue', 'white'];
    const severityIcons = ['🔴', '🟠', '🟡', '🔵', 'ℹ️'];

    severities.forEach((severity, index) => {
      const count = this.issues[severity].length;
      if (count > 0) {
        log(severityColors[index], `${severityIcons[index]} ${severity.toUpperCase()}: ${count} issues`);
        
        if (count <= 10) {
          this.issues[severity].forEach(issue => {
            log(severityColors[index], 
              `   ${issue.file}:${issue.line} - ${issue.issue}: ${issue.description}`);
          });
        } else {
          this.issues[severity].slice(0, 5).forEach(issue => {
            log(severityColors[index], 
              `   ${issue.file}:${issue.line} - ${issue.issue}: ${issue.description}`);
          });
          log(severityColors[index], `   ... and ${count - 5} more`);
        }
        console.log();
      }
    });

    // Security score calculation
    const criticalWeight = this.issues.critical.length * 10;
    const highWeight = this.issues.high.length * 5;
    const mediumWeight = this.issues.medium.length * 2;
    const lowWeight = this.issues.low.length * 1;
    
    const totalWeight = criticalWeight + highWeight + mediumWeight + lowWeight;
    const maxPossibleScore = 100;
    const score = Math.max(0, maxPossibleScore - totalWeight);

    log('cyan', '🏆 Code Quality Score');
    log('cyan', '====================');
    
    if (score >= 90) {
      log('green', `✅ Score: ${score}/100 - EXCELLENT`);
    } else if (score >= 80) {
      log('yellow', `🥈 Score: ${score}/100 - GOOD`);
    } else if (score >= 70) {
      log('yellow', `🥉 Score: ${score}/100 - FAIR`);
    } else {
      log('red', `⚠️ Score: ${score}/100 - NEEDS IMPROVEMENT`);
    }

    // Recommendations
    if (this.issues.critical.length > 0) {
      log('red', '\n🚨 URGENT: Fix critical security issues immediately!');
    }
    if (this.issues.high.length > 0) {
      log('yellow', '\n⚠️ HIGH PRIORITY: Address high-severity issues soon');
    }
    if (this.issues.medium.length > 5) {
      log('blue', '\n💡 RECOMMENDATION: Consider refactoring to reduce medium-priority issues');
    }
  }

  async analyzeProject() {
    log('cyan', '🔍 Starting Code Quality Analysis');
    log('cyan', '=================================\n');

    // Core files to analyze
    const filesToAnalyze = [
      'server.js',
      'app.js',
      'package.json',
      'middleware/auth.js',
      'middleware/security.js',
      'middleware/validation.js',
      'models/User.js',
      'models/Post.js',
      'models/Message.js',
      'models/Friend.js',
      'models/Notification.js'
    ];

    // Analyze package.json first
    this.analyzePackageJson();

    // Analyze each file
    for (const file of filesToAnalyze) {
      if (fs.existsSync(file)) {
        this.analyzeFile(file);
      }
    }

    // Analyze all JavaScript files in specific directories
    const directories = ['middleware', 'models', 'utils'];
    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.filter(file => file.endsWith('.js')).forEach(file => {
          this.analyzeFile(path.join(dir, file));
        });
      }
    }

    this.generateReport();
  }
}

// Run analysis if this file is executed directly
if (require.main === module) {
  const analyzer = new CodeAnalyzer();
  analyzer.analyzeProject().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = CodeAnalyzer;
