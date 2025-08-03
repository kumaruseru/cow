const crypto = require('crypto');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class DeviceFingerprintingService {
  constructor() {
    this.deviceCache = new Map();
    this.suspiciousDevices = new Set();
    this.trustedDevices = new Set();
    this.deviceAnalytics = {
      totalDevices: 0,
      suspiciousCount: 0,
      trustedCount: 0,
      newDevicesDaily: 0
    };
  }

  /**
   * Initialize device fingerprinting service
   */
  async initialize() {
    try {
      // Load trusted devices from cache
      await this.loadTrustedDevices();

      // Setup periodic cleanup
      setInterval(
        () => {
          this.cleanupOldFingerprints();
        },
        60 * 60 * 1000
      ); // Every hour

      logger.info('Device fingerprinting service initialized');
    } catch (error) {
      logger.error('Device fingerprinting initialization failed:', error);
    }
  }

  /**
   * Generate device fingerprint from request
   */
  generateFingerprint(req) {
    const fingerprintData = {
      userAgent: req.get('User-Agent') || '',
      acceptLanguage: req.get('Accept-Language') || '',
      acceptEncoding: req.get('Accept-Encoding') || '',
      ip: req.ip || '',
      xForwardedFor: req.get('X-Forwarded-For') || '',
      connection: req.get('Connection') || '',
      dnt: req.get('DNT') || '',
      acceptCharset: req.get('Accept-Charset') || '',
      cacheControl: req.get('Cache-Control') || '',
      pragma: req.get('Pragma') || '',
      upgradeInsecureRequests: req.get('Upgrade-Insecure-Requests') || '',
      secFetchSite: req.get('Sec-Fetch-Site') || '',
      secFetchMode: req.get('Sec-Fetch-Mode') || '',
      secFetchUser: req.get('Sec-Fetch-User') || '',
      secFetchDest: req.get('Sec-Fetch-Dest') || ''
    };

    // Create stable fingerprint hash
    const fingerprintString = JSON.stringify(fingerprintData);
    const fingerprint = crypto.createHash('sha256').update(fingerprintString).digest('hex');

    return {
      fingerprint,
      data: fingerprintData,
      timestamp: Date.now()
    };
  }

  /**
   * Enhanced device analysis
   */
  analyzeDevice(req, fingerprint) {
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || '';

    const analysis = {
      fingerprint: fingerprint.fingerprint,
      timestamp: fingerprint.timestamp,
      riskScore: 0,
      flags: [],
      deviceInfo: this.parseUserAgent(userAgent),
      networkInfo: this.analyzeNetwork(req),
      behaviorScore: 0
    };

    // Risk assessment
    analysis.riskScore += this.assessBrowserRisk(userAgent);
    analysis.riskScore += this.assessNetworkRisk(req);
    analysis.riskScore += this.assessHeaderRisk(req);

    // Add flags based on analysis
    if (analysis.riskScore > 70) {
      analysis.flags.push('HIGH_RISK');
    }

    if (this.isAutomatedRequest(req)) {
      analysis.flags.push('AUTOMATED');
      analysis.riskScore += 30;
    }

    if (this.isTorOrVPN(ip)) {
      analysis.flags.push('TOR_VPN');
      analysis.riskScore += 20;
    }

    if (this.hasInconsistentHeaders(req)) {
      analysis.flags.push('INCONSISTENT_HEADERS');
      analysis.riskScore += 15;
    }

    if (this.isObfuscatedUserAgent(userAgent)) {
      analysis.flags.push('OBFUSCATED_UA');
      analysis.riskScore += 25;
    }

    return analysis;
  }

  /**
   * Parse User-Agent string
   */
  parseUserAgent(userAgent) {
    const deviceInfo = {
      browser: 'Unknown',
      version: 'Unknown',
      os: 'Unknown',
      platform: 'Unknown',
      mobile: false,
      bot: false
    };

    if (!userAgent) return deviceInfo;

    // Detect browser
    if (userAgent.includes('Chrome')) {
      deviceInfo.browser = 'Chrome';
      const match = userAgent.match(/Chrome\/([0-9.]+)/);
      if (match) deviceInfo.version = match[1];
    } else if (userAgent.includes('Firefox')) {
      deviceInfo.browser = 'Firefox';
      const match = userAgent.match(/Firefox\/([0-9.]+)/);
      if (match) deviceInfo.version = match[1];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      deviceInfo.browser = 'Safari';
      const match = userAgent.match(/Version\/([0-9.]+)/);
      if (match) deviceInfo.version = match[1];
    } else if (userAgent.includes('Edge')) {
      deviceInfo.browser = 'Edge';
      const match = userAgent.match(/Edge\/([0-9.]+)/);
      if (match) deviceInfo.version = match[1];
    }

    // Detect OS
    if (userAgent.includes('Windows')) {
      deviceInfo.os = 'Windows';
      if (userAgent.includes('Windows NT 10.0')) deviceInfo.platform = 'Windows 10';
      else if (userAgent.includes('Windows NT 6.1')) deviceInfo.platform = 'Windows 7';
    } else if (userAgent.includes('Mac OS X')) {
      deviceInfo.os = 'macOS';
      const match = userAgent.match(/Mac OS X ([0-9_]+)/);
      if (match) deviceInfo.platform = `macOS ${match[1].replace(/_/g, '.')}`;
    } else if (userAgent.includes('Linux')) {
      deviceInfo.os = 'Linux';
    } else if (userAgent.includes('Android')) {
      deviceInfo.os = 'Android';
      deviceInfo.mobile = true;
      const match = userAgent.match(/Android ([0-9.]+)/);
      if (match) deviceInfo.platform = `Android ${match[1]}`;
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      deviceInfo.os = 'iOS';
      deviceInfo.mobile = userAgent.includes('iPhone');
      const match = userAgent.match(/OS ([0-9_]+)/);
      if (match) deviceInfo.platform = `iOS ${match[1].replace(/_/g, '.')}`;
    }

    // Detect bots
    const botPatterns = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'curl',
      'wget',
      'python',
      'java',
      'googlebot',
      'bingbot',
      'slackbot',
      'facebookexternalhit'
    ];

    deviceInfo.bot = botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern));

    return deviceInfo;
  }

  /**
   * Analyze network information
   */
  analyzeNetwork(req) {
    return {
      ip: req.ip,
      xForwardedFor: req.get('X-Forwarded-For'),
      realIp: req.get('X-Real-IP'),
      cfConnectingIp: req.get('CF-Connecting-IP'),
      proxyHeaders: this.detectProxyHeaders(req),
      suspicious: this.isNetworkSuspicious(req)
    };
  }

  /**
   * Detect proxy headers
   */
  detectProxyHeaders(req) {
    const proxyHeaders = [
      'X-Forwarded-For',
      'X-Real-IP',
      'X-Originating-IP',
      'X-Forwarded',
      'X-Cluster-Client-IP',
      'Via',
      'Forwarded'
    ];

    return proxyHeaders.filter(header => req.get(header));
  }

  /**
   * Check if network is suspicious
   */
  isNetworkSuspicious(req) {
    const suspiciousIndicators = [];

    // Multiple proxy headers (chain of proxies)
    const proxyHeaders = this.detectProxyHeaders(req);
    if (proxyHeaders.length > 2) {
      suspiciousIndicators.push('MULTIPLE_PROXIES');
    }

    // Inconsistent IP information
    const xForwardedFor = req.get('X-Forwarded-For');
    if (xForwardedFor && xForwardedFor.split(',').length > 3) {
      suspiciousIndicators.push('LONG_PROXY_CHAIN');
    }

    return suspiciousIndicators;
  }

  /**
   * Assess browser risk score
   */
  assessBrowserRisk(userAgent) {
    let risk = 0;

    if (!userAgent) {
      risk += 50; // No User-Agent is suspicious
    }

    // Very old browsers
    if (userAgent.includes('MSIE')) {
      risk += 30;
    }

    // Suspicious patterns
    if (userAgent.length < 20 || userAgent.length > 500) {
      risk += 20;
    }

    // Common bot indicators
    const suspiciousPatterns = ['bot', 'curl', 'wget', 'python', 'java'];
    if (suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern))) {
      risk += 40;
    }

    return Math.min(risk, 100);
  }

  /**
   * Assess network risk score
   */
  assessNetworkRisk(req) {
    let risk = 0;

    // Multiple forwarded headers
    const proxyHeaders = this.detectProxyHeaders(req);
    risk += Math.min(proxyHeaders.length * 10, 30);

    // TOR/VPN detection (simplified)
    if (this.isTorOrVPN(req.ip)) {
      risk += 30;
    }

    return Math.min(risk, 100);
  }

  /**
   * Assess header risk score
   */
  assessHeaderRisk(req) {
    let risk = 0;

    // Missing common headers
    const expectedHeaders = ['Accept', 'Accept-Language', 'Accept-Encoding'];
    const missingHeaders = expectedHeaders.filter(header => !req.get(header));
    risk += missingHeaders.length * 15;

    // Unusual header values
    const acceptLanguage = req.get('Accept-Language');
    if (acceptLanguage && acceptLanguage.split(',').length > 10) {
      risk += 10; // Too many languages
    }

    return Math.min(risk, 100);
  }

  /**
   * Check if request is automated
   */
  isAutomatedRequest(req) {
    const userAgent = req.get('User-Agent') || '';

    // Check for headless browser indicators
    const headlessIndicators = [
      'headless',
      'phantom',
      'selenium',
      'webdriver',
      'puppeteer',
      'playwright'
    ];

    // Check for missing browser headers
    const browserHeaders = ['Accept', 'Accept-Language', 'Accept-Encoding'];
    const missingHeaders = browserHeaders.filter(header => !req.get(header));

    return (
      headlessIndicators.some(indicator => userAgent.toLowerCase().includes(indicator)) ||
      missingHeaders.length >= 2
    );
  }

  /**
   * Simple TOR/VPN detection
   */
  isTorOrVPN(ip) {
    // This is a simplified check - in production, you'd use a proper service
    const suspiciousRanges = [
      '10.',
      '172.16.',
      '192.168.', // Private ranges often used by VPNs
      '127.' // Localhost
    ];

    return suspiciousRanges.some(range => ip.startsWith(range));
  }

  /**
   * Check for inconsistent headers
   */
  hasInconsistentHeaders(req) {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';

    // Example: Windows user agent with non-English language might be suspicious
    // This is a simplified check
    if (userAgent.includes('Windows') && !acceptLanguage.includes('en')) {
      // This could be legitimate, so only minor risk
      return false;
    }

    // Check for contradictory information
    if (userAgent.includes('Mobile') && userAgent.includes('Desktop')) {
      return true;
    }

    return false;
  }

  /**
   * Check for obfuscated User-Agent
   */
  isObfuscatedUserAgent(userAgent) {
    if (!userAgent) return true;

    // Too generic
    if (userAgent === 'Mozilla' || userAgent.length < 10) {
      return true;
    }

    // Contains unusual characters
    if (/[^\w\s\/.();,:-]/.test(userAgent)) {
      return true;
    }

    // Malformed structure
    if (!userAgent.includes('Mozilla') && !userAgent.includes('Bot')) {
      return true;
    }

    return false;
  }

  /**
   * Store device fingerprint
   */
  async storeFingerprint(userId, deviceAnalysis) {
    try {
      const deviceKey = `device:${userId}:${deviceAnalysis.fingerprint}`;

      const deviceRecord = {
        ...deviceAnalysis,
        userId,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        accessCount: 1,
        trusted: false
      };

      // Check if device exists
      const existingDevice = await cacheService.get(deviceKey);
      if (existingDevice) {
        deviceRecord.firstSeen = existingDevice.firstSeen;
        deviceRecord.accessCount = existingDevice.accessCount + 1;
        deviceRecord.trusted = existingDevice.trusted;
      } else {
        this.deviceAnalytics.totalDevices++;
        this.deviceAnalytics.newDevicesDaily++;
      }

      // Store device record
      await cacheService.set(deviceKey, deviceRecord, 30 * 24 * 3600); // 30 days

      // Update user's device list
      await this.updateUserDeviceList(userId, deviceAnalysis.fingerprint);

      // Check if device should be flagged
      if (deviceAnalysis.riskScore > 70) {
        await this.flagSuspiciousDevice(deviceAnalysis.fingerprint, deviceAnalysis);
      }

      logger.debug('Device fingerprint stored', {
        userId,
        fingerprint: deviceAnalysis.fingerprint.substring(0, 16) + '...',
        riskScore: deviceAnalysis.riskScore,
        flags: deviceAnalysis.flags
      });

      return deviceRecord;
    } catch (error) {
      logger.error('Failed to store device fingerprint:', error);
      return null;
    }
  }

  /**
   * Update user's device list
   */
  async updateUserDeviceList(userId, fingerprint) {
    try {
      const userDevicesKey = `user_devices:${userId}`;
      const userDevices = (await cacheService.get(userDevicesKey)) || [];

      if (!userDevices.includes(fingerprint)) {
        userDevices.push(fingerprint);
        // Keep only recent devices (max 10)
        if (userDevices.length > 10) {
          userDevices.shift();
        }
        await cacheService.set(userDevicesKey, userDevices, 30 * 24 * 3600);
      }
    } catch (error) {
      logger.error('Failed to update user device list:', error);
    }
  }

  /**
   * Flag suspicious device
   */
  async flagSuspiciousDevice(fingerprint, analysis) {
    try {
      this.suspiciousDevices.add(fingerprint);
      this.deviceAnalytics.suspiciousCount++;

      const suspiciousKey = `suspicious_device:${fingerprint}`;
      await cacheService.set(
        suspiciousKey,
        {
          fingerprint,
          analysis,
          flaggedAt: Date.now(),
          reason: analysis.flags.join(', ')
        },
        7 * 24 * 3600
      ); // 7 days

      logger.security('Suspicious device flagged', {
        type: 'SUSPICIOUS_DEVICE',
        severity: 'medium',
        fingerprint: fingerprint.substring(0, 16) + '...',
        riskScore: analysis.riskScore,
        flags: analysis.flags
      });
    } catch (error) {
      logger.error('Failed to flag suspicious device:', error);
    }
  }

  /**
   * Trust device
   */
  async trustDevice(userId, fingerprint) {
    try {
      const deviceKey = `device:${userId}:${fingerprint}`;
      const device = await cacheService.get(deviceKey);

      if (device) {
        device.trusted = true;
        device.trustedAt = Date.now();
        await cacheService.set(deviceKey, device, 30 * 24 * 3600);

        this.trustedDevices.add(fingerprint);
        this.suspiciousDevices.delete(fingerprint);
        this.deviceAnalytics.trustedCount++;

        logger.info('Device trusted', {
          userId,
          fingerprint: fingerprint.substring(0, 16) + '...'
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to trust device:', error);
      return false;
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId, fingerprint) {
    try {
      if (this.trustedDevices.has(fingerprint)) {
        return true;
      }

      const deviceKey = `device:${userId}:${fingerprint}`;
      const device = await cacheService.get(deviceKey);

      return device && device.trusted;
    } catch (error) {
      logger.error('Failed to check device trust:', error);
      return false;
    }
  }

  /**
   * Get device history for user
   */
  async getUserDeviceHistory(userId) {
    try {
      const userDevicesKey = `user_devices:${userId}`;
      const deviceFingerprints = (await cacheService.get(userDevicesKey)) || [];

      const devices = [];
      for (const fingerprint of deviceFingerprints) {
        const deviceKey = `device:${userId}:${fingerprint}`;
        const device = await cacheService.get(deviceKey);
        if (device) {
          // Sanitize device data for response
          devices.push({
            fingerprint: fingerprint.substring(0, 16) + '...',
            deviceInfo: device.deviceInfo,
            firstSeen: new Date(device.firstSeen).toISOString(),
            lastSeen: new Date(device.lastSeen).toISOString(),
            accessCount: device.accessCount,
            trusted: device.trusted,
            riskScore: device.riskScore,
            flags: device.flags
          });
        }
      }

      return devices.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    } catch (error) {
      logger.error('Failed to get user device history:', error);
      return [];
    }
  }

  /**
   * Load trusted devices from cache
   */
  async loadTrustedDevices() {
    try {
      const trustedDevicesData = (await cacheService.get('trusted_devices')) || [];
      trustedDevicesData.forEach(fingerprint => {
        this.trustedDevices.add(fingerprint);
      });

      logger.debug(`Loaded ${trustedDevicesData.length} trusted devices`);
    } catch (error) {
      logger.error('Failed to load trusted devices:', error);
    }
  }

  /**
   * Cleanup old fingerprints
   */
  cleanupOldFingerprints() {
    // Reset daily counters
    this.deviceAnalytics.newDevicesDaily = 0;

    logger.debug('Device fingerprint cleanup completed');
  }

  /**
   * Get device analytics
   */
  getDeviceAnalytics() {
    return {
      ...this.deviceAnalytics,
      suspiciousDevicesActive: this.suspiciousDevices.size,
      trustedDevicesActive: this.trustedDevices.size
    };
  }

  /**
   * Generate device security report
   */
  async generateDeviceSecurityReport() {
    try {
      const analytics = this.getDeviceAnalytics();

      // Get recent suspicious devices
      const recentSuspicious = [];
      for (const fingerprint of this.suspiciousDevices) {
        try {
          const suspiciousData = await cacheService.get(`suspicious_device:${fingerprint}`);
          if (suspiciousData) {
            recentSuspicious.push({
              fingerprint: fingerprint.substring(0, 16) + '...',
              riskScore: suspiciousData.analysis.riskScore,
              flags: suspiciousData.analysis.flags,
              flaggedAt: new Date(suspiciousData.flaggedAt).toISOString()
            });
          }
        } catch (error) {
          // Skip this device if there's an error
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        analytics,
        recentSuspiciousDevices: recentSuspicious.slice(0, 20),
        recommendations: this.generateSecurityRecommendations(analytics)
      };
    } catch (error) {
      logger.error('Failed to generate device security report:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations(analytics) {
    const recommendations = [];

    if (analytics.suspiciousCount > analytics.totalDevices * 0.1) {
      recommendations.push({
        type: 'HIGH_SUSPICIOUS_RATE',
        severity: 'high',
        message: 'High rate of suspicious devices detected. Consider stricter validation.'
      });
    }

    if (analytics.trustedCount < analytics.totalDevices * 0.5) {
      recommendations.push({
        type: 'LOW_TRUST_RATE',
        severity: 'medium',
        message: 'Low rate of trusted devices. Consider implementing device verification.'
      });
    }

    if (analytics.newDevicesDaily > 100) {
      recommendations.push({
        type: 'HIGH_NEW_DEVICE_RATE',
        severity: 'medium',
        message: 'High rate of new devices. Monitor for potential bot activity.'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
const deviceFingerprintingService = new DeviceFingerprintingService();

module.exports = deviceFingerprintingService;
