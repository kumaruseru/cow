const crypto = require('crypto');
const logger = require('../utils/logger');
const encryptionService = require('./encryptionService');

class WebRTCService {
  constructor() {
    this.activeCalls = new Map();
    this.callSessions = new Map();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
      // Add TURN servers for production
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'username',
      //   credential: 'password'
      // }
    ];
  }

  // Initialize a new call session
  async initializeCall(callerId, recipientId, callType = 'audio') {
    try {
      const callId = this.generateCallId();
      const sessionKeys = await encryptionService.generateWebRTCKeys();

      const callSession = {
        callId,
        callerId,
        recipientId,
        callType, // 'audio' or 'video'
        status: 'initiating',
        createdAt: new Date(),
        sessionKeys,
        iceServers: this.iceServers,
        encryptionEnabled: true,
        participants: [callerId, recipientId]
      };

      this.callSessions.set(callId, callSession);

      logger.info(`Call session initialized: ${callId} between ${callerId} and ${recipientId}`);

      return {
        success: true,
        callId,
        sessionKeys: {
          fingerprint: sessionKeys.fingerprint
          // Don't send private keys to client
        },
        iceServers: this.iceServers
      };
    } catch (error) {
      logger.error('Error initializing call:', error);
      return {
        success: false,
        error: 'Failed to initialize call'
      };
    }
  }

  // Handle call offer (SDP)
  async handleCallOffer(callId, userId, offer) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        throw new Error('Call session not found');
      }

      if (session.callerId !== userId) {
        throw new Error('Unauthorized to send offer');
      }

      // Encrypt the SDP offer
      const encryptedOffer = encryptionService.encryptCallSignaling(
        offer,
        session.sessionKeys.dtlsKey
      );

      session.offer = encryptedOffer;
      session.status = 'offering';

      logger.info(`Call offer received for session: ${callId}`);

      return {
        success: true,
        encryptedOffer
      };
    } catch (error) {
      logger.error('Error handling call offer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle call answer (SDP)
  async handleCallAnswer(callId, userId, answer) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        throw new Error('Call session not found');
      }

      if (session.recipientId !== userId) {
        throw new Error('Unauthorized to send answer');
      }

      // Encrypt the SDP answer
      const encryptedAnswer = encryptionService.encryptCallSignaling(
        answer,
        session.sessionKeys.dtlsKey
      );

      session.answer = encryptedAnswer;
      session.status = 'connected';
      session.connectedAt = new Date();

      // Add to active calls
      this.activeCalls.set(callId, session);

      logger.info(`Call answer received for session: ${callId}`);

      return {
        success: true,
        encryptedAnswer
      };
    } catch (error) {
      logger.error('Error handling call answer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle ICE candidates
  async handleIceCandidate(callId, userId, candidate) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        throw new Error('Call session not found');
      }

      if (!session.participants.includes(userId)) {
        throw new Error('Unauthorized user');
      }

      // Encrypt ICE candidate
      const encryptedCandidate = encryptionService.encryptCallSignaling(
        candidate,
        session.sessionKeys.dtlsKey
      );

      if (!session.iceCandidates) {
        session.iceCandidates = [];
      }

      session.iceCandidates.push({
        userId,
        candidate: encryptedCandidate,
        timestamp: new Date()
      });

      return {
        success: true,
        encryptedCandidate
      };
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // End call session
  endCall(callId, userId, reason = 'normal') {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        return { success: false, error: 'Call session not found' };
      }

      if (!session.participants.includes(userId)) {
        return { success: false, error: 'Unauthorized user' };
      }

      session.status = 'ended';
      session.endedAt = new Date();
      session.endedBy = userId;
      session.endReason = reason;

      // Calculate call duration
      if (session.connectedAt) {
        session.duration = session.endedAt - session.connectedAt;
      }

      // Remove from active calls
      this.activeCalls.delete(callId);

      // Keep session for logging/billing purposes
      setTimeout(
        () => {
          this.callSessions.delete(callId);
        },
        5 * 60 * 1000
      ); // Keep for 5 minutes

      logger.info(`Call ended: ${callId} by ${userId}, reason: ${reason}`);

      return {
        success: true,
        session: {
          callId: session.callId,
          duration: session.duration,
          endReason: reason
        }
      };
    } catch (error) {
      logger.error('Error ending call:', error);
      return {
        success: false,
        error: 'Failed to end call'
      };
    }
  }

  // Get call session info
  getCallSession(callId) {
    const session = this.callSessions.get(callId);
    if (!session) {
      return null;
    }

    // Return safe session info (no sensitive keys)
    return {
      callId: session.callId,
      callerId: session.callerId,
      recipientId: session.recipientId,
      callType: session.callType,
      status: session.status,
      createdAt: session.createdAt,
      connectedAt: session.connectedAt,
      participants: session.participants
    };
  }

  // Generate unique call ID
  generateCallId() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Get active calls for user
  getUserActiveCalls(userId) {
    const userCalls = [];

    for (const [callId, session] of this.activeCalls) {
      if (session.participants.includes(userId)) {
        userCalls.push(this.getCallSession(callId));
      }
    }

    return userCalls;
  }

  // Check if user is in a call
  isUserInCall(userId) {
    for (const [, session] of this.activeCalls) {
      if (session.participants.includes(userId)) {
        return true;
      }
    }
    return false;
  }

  // Handle call quality metrics
  updateCallQuality(callId, userId, qualityMetrics) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      if (!session.participants.includes(userId)) {
        return { success: false, error: 'Unauthorized' };
      }

      if (!session.qualityMetrics) {
        session.qualityMetrics = {};
      }

      session.qualityMetrics[userId] = {
        ...qualityMetrics,
        timestamp: new Date()
      };

      // Log poor quality for monitoring
      if (qualityMetrics.packetLoss > 0.05 || qualityMetrics.jitter > 100) {
        logger.warn(`Poor call quality detected in session ${callId}:`, qualityMetrics);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error updating call quality:', error);
      return { success: false, error: 'Failed to update quality metrics' };
    }
  }

  // Screen sharing functionality
  async initiateScreenShare(callId, userId) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        throw new Error('Call session not found');
      }

      if (!session.participants.includes(userId)) {
        throw new Error('Unauthorized user');
      }

      session.screenSharing = {
        active: true,
        sharedBy: userId,
        startedAt: new Date()
      };

      logger.info(`Screen sharing started in call ${callId} by ${userId}`);

      return {
        success: true,
        screenSharingId: this.generateCallId()
      };
    } catch (error) {
      logger.error('Error initiating screen share:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Stop screen sharing
  stopScreenShare(callId, userId) {
    try {
      const session = this.callSessions.get(callId);
      if (!session || !session.screenSharing) {
        return { success: false, error: 'No active screen sharing' };
      }

      if (session.screenSharing.sharedBy !== userId) {
        return { success: false, error: 'Unauthorized to stop screen sharing' };
      }

      session.screenSharing.active = false;
      session.screenSharing.endedAt = new Date();

      logger.info(`Screen sharing stopped in call ${callId} by ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error stopping screen share:', error);
      return { success: false, error: 'Failed to stop screen sharing' };
    }
  }

  // Call recording (encrypted)
  async startCallRecording(callId, userId) {
    try {
      const session = this.callSessions.get(callId);
      if (!session) {
        throw new Error('Call session not found');
      }

      // Check if user has permission to record
      if (!session.participants.includes(userId)) {
        throw new Error('Unauthorized user');
      }

      // Generate encryption key for recording
      const recordingKey = crypto.randomBytes(32).toString('hex');

      session.recording = {
        active: true,
        startedBy: userId,
        startedAt: new Date(),
        encryptionKey: recordingKey,
        recordingId: this.generateCallId()
      };

      logger.info(`Call recording started for session ${callId} by ${userId}`);

      return {
        success: true,
        recordingId: session.recording.recordingId
      };
    } catch (error) {
      logger.error('Error starting call recording:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Stop call recording
  stopCallRecording(callId, userId) {
    try {
      const session = this.callSessions.get(callId);
      if (!session || !session.recording) {
        return { success: false, error: 'No active recording' };
      }

      if (session.recording.startedBy !== userId) {
        return { success: false, error: 'Unauthorized to stop recording' };
      }

      session.recording.active = false;
      session.recording.endedAt = new Date();
      session.recording.duration = session.recording.endedAt - session.recording.startedAt;

      logger.info(`Call recording stopped for session ${callId} by ${userId}`);

      return {
        success: true,
        recordingInfo: {
          recordingId: session.recording.recordingId,
          duration: session.recording.duration
        }
      };
    } catch (error) {
      logger.error('Error stopping call recording:', error);
      return { success: false, error: 'Failed to stop recording' };
    }
  }

  // Get call statistics
  getCallStatistics() {
    return {
      totalSessions: this.callSessions.size,
      activeCalls: this.activeCalls.size,
      completedCalls: Array.from(this.callSessions.values()).filter(s => s.status === 'ended')
        .length
    };
  }

  // Cleanup old sessions
  cleanupOldSessions() {
    const now = new Date();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [callId, session] of this.callSessions) {
      if (session.status === 'ended' && now - session.endedAt > maxAge) {
        this.callSessions.delete(callId);
        logger.info(`Cleaned up old call session: ${callId}`);
      }
    }
  }
}

module.exports = new WebRTCService();
