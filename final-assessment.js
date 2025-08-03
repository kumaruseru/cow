#!/usr/bin/env node

/**
 * Final Assessment & Summary Generator
 * Tạo báo cáo đánh giá tổng thể cho dự án Cow Social Network
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
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class FinalAssessment {
  constructor() {
    this.projectPath = process.cwd();
    this.assessment = {
      overview: {},
      security: {},
      performance: {},
      codeQuality: {},
      architecture: {},
      recommendations: []
    };
  }

  // Analyze project structure
  analyzeProjectStructure() {
    log('blue', '🔍 Analyzing Project Structure...');
    
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    let packageInfo = {};
    
    if (fs.existsSync(packageJsonPath)) {
      packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    }

    // Count files by type
    const fileStats = this.countFiles(this.projectPath);
    
    // Analyze dependencies
    const dependencies = Object.keys(packageInfo.dependencies || {}).length;
    const devDependencies = Object.keys(packageInfo.devDependencies || {}).length;
    
    this.assessment.overview = {
      name: packageInfo.name || 'Unknown',
      version: packageInfo.version || '1.0.0',
      description: packageInfo.description || '',
      totalFiles: fileStats.total,
      jsFiles: fileStats.js,
      htmlFiles: fileStats.html,
      dependencies: dependencies,
      devDependencies: devDependencies,
      mainEntry: packageInfo.main || 'server.js'
    };

    log('green', `✅ Project: ${this.assessment.overview.name} v${this.assessment.overview.version}`);
    log('white', `   Files: ${fileStats.total} total (${fileStats.js} JS, ${fileStats.html} HTML)`);
    log('white', `   Dependencies: ${dependencies} production, ${devDependencies} development`);
  }

  countFiles(dir) {
    const stats = { total: 0, js: 0, html: 0, css: 0, json: 0 };
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;
        
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const subStats = this.countFiles(fullPath);
          stats.total += subStats.total;
          stats.js += subStats.js;
          stats.html += subStats.html;
          stats.css += subStats.css;
          stats.json += subStats.json;
        } else {
          stats.total++;
          const ext = path.extname(item).toLowerCase();
          if (ext === '.js') stats.js++;
          else if (ext === '.html') stats.html++;
          else if (ext === '.css') stats.css++;
          else if (ext === '.json') stats.json++;
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return stats;
  }

  // Assess security measures
  assessSecurity() {
    log('blue', '🔐 Assessing Security Measures...');
    
    const securityFeatures = {
      jwt: this.checkFileContains('middleware/auth.js', 'jwt'),
      bcrypt: this.checkFileContains(['server.js', 'middleware/auth.js'], 'bcrypt'),
      helmet: this.checkFileContains('server.js', 'helmet'),
      rateLimit: this.checkFileContains(['server.js', 'middleware/security.js'], 'rate'),
      validation: this.checkFileContains('middleware/validation.js', 'validator'),
      xssProtection: this.checkFileContains(['server.js', 'middleware/validation.js'], 'xss'),
      cors: this.checkFileContains('server.js', 'cors'),
      logging: this.checkFileContains(['server.js', 'utils/logger.js'], 'winston')
    };

    const securityScore = Object.values(securityFeatures).filter(Boolean).length;
    const maxScore = Object.keys(securityFeatures).length;
    
    this.assessment.security = {
      features: securityFeatures,
      score: ((securityScore / maxScore) * 10).toFixed(1),
      implemented: securityScore,
      total: maxScore
    };

    log('green', `✅ Security Score: ${this.assessment.security.score}/10`);
    log('white', `   Implemented: ${securityScore}/${maxScore} security measures`);
  }

  // Check code quality indicators
  assessCodeQuality() {
    log('blue', '📊 Assessing Code Quality...');
    
    const qualityIndicators = {
      eslint: fs.existsSync('.eslintrc.json') || fs.existsSync('.eslintrc.js'),
      prettier: fs.existsSync('.prettierrc.json') || fs.existsSync('.prettierrc'),
      gitignore: fs.existsSync('.gitignore'),
      packageLock: fs.existsSync('package-lock.json'),
      env: fs.existsSync('.env.example'),
      readme: fs.existsSync('README.md'),
      tests: fs.existsSync('tests') || this.checkFileContains('package.json', 'test'),
      middleware: fs.existsSync('middleware'),
      models: fs.existsSync('models'),
      config: fs.existsSync('config')
    };

    const qualityScore = Object.values(qualityIndicators).filter(Boolean).length;
    const maxQualityScore = Object.keys(qualityIndicators).length;
    
    this.assessment.codeQuality = {
      indicators: qualityIndicators,
      score: ((qualityScore / maxQualityScore) * 10).toFixed(1),
      implemented: qualityScore,
      total: maxQualityScore
    };

    log('green', `✅ Code Quality Score: ${this.assessment.codeQuality.score}/10`);
    log('white', `   Quality indicators: ${qualityScore}/${maxQualityScore}`);
  }

  // Assess architecture
  assessArchitecture() {
    log('blue', '🏗️ Assessing Architecture...');
    
    const architectureFeatures = {
      separation: fs.existsSync('middleware') && fs.existsSync('models'),
      database: this.checkFileContains(['config/database.js', 'server.js'], 'mongoose'),
      errorHandling: fs.existsSync('middleware/errorHandler.js'),
      logging: fs.existsSync('utils/logger.js') || this.checkFileContains('server.js', 'winston'),
      validation: fs.existsSync('middleware/validation.js'),
      authentication: fs.existsSync('middleware/auth.js'),
      fileStructure: fs.existsSync('uploads') && fs.existsSync('logs'),
      envConfig: fs.existsSync('.env.example')
    };

    const archScore = Object.values(architectureFeatures).filter(Boolean).length;
    const maxArchScore = Object.keys(architectureFeatures).length;
    
    this.assessment.architecture = {
      features: architectureFeatures,
      score: ((archScore / maxArchScore) * 10).toFixed(1),
      implemented: archScore,
      total: maxArchScore
    };

    log('green', `✅ Architecture Score: ${this.assessment.architecture.score}/10`);
    log('white', `   Architecture features: ${archScore}/${maxArchScore}`);
  }

  // Generate recommendations
  generateRecommendations() {
    log('blue', '💡 Generating Recommendations...');
    
    const recommendations = [];

    // Security recommendations
    if (parseFloat(this.assessment.security.score) < 8) {
      recommendations.push({
        priority: 'High',
        category: 'Security',
        action: 'Implement missing security measures (JWT, rate limiting, input validation)',
        impact: 'Critical for production readiness'
      });
    }

    // Code quality recommendations
    if (!this.assessment.codeQuality.indicators.tests) {
      recommendations.push({
        priority: 'Medium',
        category: 'Testing',
        action: 'Add comprehensive test suite (unit, integration, security tests)',
        impact: 'Improves reliability and maintenance'
      });
    }

    if (!this.assessment.codeQuality.indicators.eslint) {
      recommendations.push({
        priority: 'Medium',
        category: 'Code Quality',
        action: 'Setup ESLint and Prettier for code formatting',
        impact: 'Improves code consistency and reduces bugs'
      });
    }

    // Architecture recommendations
    if (!this.assessment.architecture.features.errorHandling) {
      recommendations.push({
        priority: 'High',
        category: 'Architecture',
        action: 'Implement centralized error handling middleware',
        impact: 'Better error management and debugging'
      });
    }

    // Performance recommendations
    recommendations.push({
      priority: 'Medium',
      category: 'Performance',
      action: 'Add caching layer (Redis) and database optimization',
      impact: 'Improves response times and scalability'
    });

    // Documentation recommendations
    if (!this.assessment.codeQuality.indicators.readme) {
      recommendations.push({
        priority: 'Low',
        category: 'Documentation',
        action: 'Create comprehensive README and API documentation',
        impact: 'Improves developer experience and onboarding'
      });
    }

    this.assessment.recommendations = recommendations;
    log('green', `✅ Generated ${recommendations.length} recommendations`);
  }

  // Calculate overall score
  calculateOverallScore() {
    const securityWeight = 0.35;
    const qualityWeight = 0.25;
    const architectureWeight = 0.25;
    const completenessWeight = 0.15;

    const securityScore = parseFloat(this.assessment.security.score);
    const qualityScore = parseFloat(this.assessment.codeQuality.score);
    const architectureScore = parseFloat(this.assessment.architecture.score);
    
    // Completeness based on file structure
    const completenessScore = Math.min(10, (this.assessment.overview.totalFiles / 50) * 10);

    const overallScore = (
      securityScore * securityWeight +
      qualityScore * qualityWeight +
      architectureScore * architectureWeight +
      completenessScore * completenessWeight
    ).toFixed(1);

    return {
      overall: overallScore,
      security: securityScore,
      quality: qualityScore,
      architecture: architectureScore,
      completeness: completenessScore.toFixed(1)
    };
  }

  // Helper function to check if file contains text
  checkFileContains(filePaths, searchText) {
    if (!Array.isArray(filePaths)) {
      filePaths = [filePaths];
    }

    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.toLowerCase().includes(searchText.toLowerCase())) {
            return true;
          }
        }
      } catch (error) {
        // Ignore read errors
      }
    }
    return false;
  }

  // Generate final report
  generateReport() {
    const scores = this.calculateOverallScore();
    
    log('cyan', '\n' + '='.repeat(60));
    log('cyan', '📋 COW SOCIAL NETWORK - FINAL ASSESSMENT REPORT');
    log('cyan', '='.repeat(60));

    // Overall Score
    log('\n');
    log('bold', '🏆 OVERALL SCORE');
    log('cyan', `   ${scores.overall}/10`);
    
    if (scores.overall >= 8) {
      log('green', '   Status: ✅ EXCELLENT - Production Ready');
    } else if (scores.overall >= 7) {
      log('yellow', '   Status: 🟢 GOOD - Minor fixes needed');
    } else if (scores.overall >= 6) {
      log('yellow', '   Status: 🟡 FAIR - Some improvements required');
    } else {
      log('red', '   Status: 🔴 NEEDS WORK - Major improvements needed');
    }

    // Detailed Scores
    log('\n');
    log('bold', '📊 DETAILED SCORES');
    log('white', `   🔐 Security:     ${scores.security}/10`);
    log('white', `   📊 Code Quality: ${scores.quality}/10`);
    log('white', `   🏗️ Architecture: ${scores.architecture}/10`);
    log('white', `   📁 Completeness: ${scores.completeness}/10`);

    // Project Overview
    log('\n');
    log('bold', '📋 PROJECT OVERVIEW');
    log('white', `   Name: ${this.assessment.overview.name}`);
    log('white', `   Version: ${this.assessment.overview.version}`);
    log('white', `   Files: ${this.assessment.overview.totalFiles} total`);
    log('white', `   Dependencies: ${this.assessment.overview.dependencies} production`);

    // Security Assessment
    log('\n');
    log('bold', '🔐 SECURITY ASSESSMENT');
    const securityFeatures = this.assessment.security.features;
    Object.entries(securityFeatures).forEach(([feature, implemented]) => {
      const status = implemented ? '✅' : '❌';
      log('white', `   ${status} ${feature}`);
    });

    // Recommendations
    log('\n');
    log('bold', '💡 TOP RECOMMENDATIONS');
    const topRecommendations = this.assessment.recommendations.slice(0, 5);
    topRecommendations.forEach((rec, index) => {
      const priority = rec.priority === 'High' ? '🔴' : rec.priority === 'Medium' ? '🟡' : '🟢';
      log('white', `   ${index + 1}. ${priority} ${rec.category}: ${rec.action}`);
    });

    // Conclusion
    log('\n');
    log('bold', '🎯 CONCLUSION');
    if (scores.overall >= 7.5) {
      log('green', '   The Cow Social Network project shows excellent progress with strong');
      log('green', '   security foundations and good architecture. Ready for production');
      log('green', '   deployment with minor optimizations.');
    } else if (scores.overall >= 6.5) {
      log('yellow', '   The project is on the right track with solid foundations. Some');
      log('yellow', '   improvements in security and code quality are recommended before');
      log('yellow', '   production deployment.');
    } else {
      log('red', '   The project needs significant improvements in security, code quality,');
      log('red', '   and architecture before it can be considered production-ready.');
    }

    log('\n');
    log('cyan', '='.repeat(60));
    log('cyan', '📅 Report generated on: ' + new Date().toLocaleString());
    log('cyan', '🤖 Generated by: GitHub Copilot Assessment Tool');
    log('cyan', '='.repeat(60));

    return scores;
  }

  // Run complete assessment
  async runAssessment() {
    log('cyan', '🚀 Starting Final Project Assessment');
    log('cyan', '===================================\n');

    this.analyzeProjectStructure();
    this.assessSecurity();
    this.assessCodeQuality();
    this.assessArchitecture();
    this.generateRecommendations();

    const scores = this.generateReport();
    
    // Save assessment to file
    const assessmentData = {
      timestamp: new Date().toISOString(),
      scores: scores,
      assessment: this.assessment
    };

    try {
      fs.writeFileSync('assessment-results.json', JSON.stringify(assessmentData, null, 2));
      log('\n');
      log('green', '✅ Assessment results saved to assessment-results.json');
    } catch (error) {
      log('red', `❌ Failed to save assessment results: ${error.message}`);
    }

    return scores;
  }
}

// Run assessment if this file is executed directly
if (require.main === module) {
  const assessment = new FinalAssessment();
  assessment.runAssessment().catch(error => {
    console.error('Assessment failed:', error);
    process.exit(1);
  });
}

module.exports = FinalAssessment;
