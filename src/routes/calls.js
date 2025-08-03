const express = require('express');
const { protect } = require('../middleware/auth');
const { validateBody } = require('../validation/validators');
const WebRTCService = require('../services/webrtcService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Initiate a call
// @route   POST /api/calls/initiate
// @access  Private
router.post(
  '/initiate',
  validateBody({
    targetUserId: {
      type: 'string',
      required: true
    },
    callType: {
      type: 'string',
      required: true,
      valid: ['audio', 'video']
    }
  }),
  async (req, res) => {
    try {
      const { targetUserId, callType } = req.body;
      const callerId = req.user.id;

      if (callerId === targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot call yourself'
        });
      }

      const callSession = await WebRTCService.initiateCall(callerId, targetUserId, callType);

      res.status(200).json({
        success: true,
        data: {
          callId: callSession.id,
          sessionId: callSession.sessionId,
          offer: callSession.offer
        }
      });
    } catch (error) {
      logger.error('Call initiation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to initiate call'
      });
    }
  }
);

// @desc    Answer a call
// @route   POST /api/calls/:callId/answer
// @access  Private
router.post(
  '/:callId/answer',
  validateBody({
    answer: {
      type: 'object',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { callId } = req.params;
      const { answer } = req.body;
      const userId = req.user.id;

      const result = await WebRTCService.answerCall(callId, userId, answer);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Call answer error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to answer call'
      });
    }
  }
);

// @desc    Reject a call
// @route   POST /api/calls/:callId/reject
// @access  Private
router.post('/:callId/reject', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    await WebRTCService.rejectCall(callId, userId);

    res.status(200).json({
      success: true,
      message: 'Call rejected successfully'
    });
  } catch (error) {
    logger.error('Call rejection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject call'
    });
  }
});

// @desc    End a call
// @route   POST /api/calls/:callId/end
// @access  Private
router.post('/:callId/end', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    await WebRTCService.endCall(callId, userId);

    res.status(200).json({
      success: true,
      message: 'Call ended successfully'
    });
  } catch (error) {
    logger.error('Call end error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to end call'
    });
  }
});

// @desc    Add ICE candidate
// @route   POST /api/calls/:callId/ice-candidate
// @access  Private
router.post(
  '/:callId/ice-candidate',
  validateBody({
    candidate: {
      type: 'object',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { callId } = req.params;
      const { candidate } = req.body;
      const userId = req.user.id;

      await WebRTCService.addIceCandidate(callId, userId, candidate);

      res.status(200).json({
        success: true,
        message: 'ICE candidate added successfully'
      });
    } catch (error) {
      logger.error('ICE candidate error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add ICE candidate'
      });
    }
  }
);

// @desc    Start screen sharing
// @route   POST /api/calls/:callId/screen-share/start
// @access  Private
router.post('/:callId/screen-share/start', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    const result = await WebRTCService.startScreenShare(callId, userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Screen share start error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start screen sharing'
    });
  }
});

// @desc    Stop screen sharing
// @route   POST /api/calls/:callId/screen-share/stop
// @access  Private
router.post('/:callId/screen-share/stop', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    await WebRTCService.stopScreenShare(callId, userId);

    res.status(200).json({
      success: true,
      message: 'Screen sharing stopped successfully'
    });
  } catch (error) {
    logger.error('Screen share stop error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop screen sharing'
    });
  }
});

// @desc    Toggle video
// @route   POST /api/calls/:callId/video/toggle
// @access  Private
router.post('/:callId/video/toggle', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    const result = await WebRTCService.toggleVideo(callId, userId);

    res.status(200).json({
      success: true,
      data: {
        videoEnabled: result.videoEnabled
      }
    });
  } catch (error) {
    logger.error('Video toggle error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle video'
    });
  }
});

// @desc    Toggle audio
// @route   POST /api/calls/:callId/audio/toggle
// @access  Private
router.post('/:callId/audio/toggle', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    const result = await WebRTCService.toggleAudio(callId, userId);

    res.status(200).json({
      success: true,
      data: {
        audioEnabled: result.audioEnabled
      }
    });
  } catch (error) {
    logger.error('Audio toggle error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle audio'
    });
  }
});

// @desc    Get call status
// @route   GET /api/calls/:callId/status
// @access  Private
router.get('/:callId/status', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    const status = await WebRTCService.getCallStatus(callId, userId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Call status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get call status'
    });
  }
});

// @desc    Get active calls for user
// @route   GET /api/calls/active
// @access  Private
router.get('/active', async (req, res) => {
  try {
    const userId = req.user.id;

    const activeCalls = await WebRTCService.getActiveCalls(userId);

    res.status(200).json({
      success: true,
      data: activeCalls
    });
  } catch (error) {
    logger.error('Active calls error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active calls'
    });
  }
});

// @desc    Get call history
// @route   GET /api/calls/history
// @access  Private
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const history = await WebRTCService.getCallHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Call history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call history'
    });
  }
});

module.exports = router;
