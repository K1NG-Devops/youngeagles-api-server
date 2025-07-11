/**
 * AI Grading Service for Young Eagles API
 * Provides AI-powered grading and feedback functionality
 */

class AIGradingService {
  constructor() {
    this.gradingQueue = new Map();
    this.processingStatus = new Map();
  }

  /**
   * Start AI grading for submissions
   * @param {Array} submissions - Array of homework submissions
   * @param {number} teacherId - ID of the teacher requesting grading
   * @returns {Object} Grading queue status
   */
  async startGrading(submissions, teacherId, dbQuery) {
    try {
      const queueId = `grading_${Date.now()}_${teacherId}`;
      
      // Add to processing queue
      this.gradingQueue.set(queueId, {
        submissions,
        teacherId,
        status: 'processing',
        startedAt: new Date(),
        progress: 0,
        results: []
      });

      // Store dbQuery function in queueItem for later use
      this.gradingQueue.get(queueId).dbQuery = dbQuery;

      // Mock AI processing (in real implementation, this would call OpenAI/Claude)
      setTimeout(() => {
        this.processGrading(queueId);
      }, 3000);

      return {
        success: true,
        queueId,
        status: 'started',
        estimatedTime: '2-5 minutes',
        submissionCount: submissions.length
      };
    } catch (error) {
      console.error('AI Grading start error:', error);
      throw new Error('Failed to start AI grading');
    }
  }

  /**
   * Mock AI processing function
   * In production, this would integrate with actual AI services
   */
  async processGrading(queueId) {
    const queueItem = this.gradingQueue.get(queueId);
    if (!queueItem) return;

    // Simulate processing each submission
    for (let i = 0; i < queueItem.submissions.length; i++) {
      const submission = queueItem.submissions[i];
      
      // Mock AI grading results
      const gradingResult = {
        submissionId: submission.id,
        grade: Math.floor(Math.random() * 20) + 80, // 80-100%
        feedback: this.generateMockFeedback(submission),
        strengths: this.generateStrengths(),
        improvements: this.generateImprovements(),
        gradedAt: new Date(),
        confidence: Math.floor(Math.random() * 20) + 80 // 80-100%
      };

      queueItem.results.push(gradingResult);
      queueItem.progress = Math.round(((i + 1) / queueItem.submissions.length) * 100);
      
      // Update queue status
      this.gradingQueue.set(queueId, queueItem);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Mark as completed
    queueItem.status = 'completed';
    queueItem.completedAt = new Date();
    this.gradingQueue.set(queueId, queueItem);

    // Notify teacher of grading completion
    if (queueItem.dbQuery) {
      try {
        const gradingPayload = {
          queue_id: queueId,
          submission_count: queueItem.submissions.length,
          completed_count: queueItem.results.length
        };
        
        await queueItem.dbQuery(`
          INSERT INTO notifications (
            userId, userType, title, body, type, data, priority, 
            isRead, createdAt, sentAt, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
        `, [
          queueItem.teacherId, // userId
          'teacher', // userType
          'AI Grading Completed',
          `AI grading for your submissions has been completed for queue ${queueId}. ${queueItem.results.length} submissions were processed.`,
          'general', // type from existing enum
          JSON.stringify(gradingPayload), // data as JSON
          'normal', // priority
          0, // isRead (false)
          'sent' // status
        ]);
        console.log(`📬 Notification sent to teacher ${queueItem.teacherId} for grading completion`);
      } catch (error) {
        console.error('Error creating grading completion notification:', error);
      }
    }
  }

  /**
   * Get grading results for a specific submission
   */
  async getGradingResults(submissionId) {
    // Find results across all queues
    for (const [_queueId, queueItem] of this.gradingQueue) {
      const result = queueItem.results.find(r => r.submissionId === submissionId);
      if (result) {
        return {
          success: true,
          result
        };
      }
    }

    return {
      success: false,
      message: 'Grading results not found'
    };
  }

  /**
   * Get grading queue status
   */
  getQueueStatus(teacherId) {
    const teacherQueues = [];
    
    for (const [queueId, queueItem] of this.gradingQueue) {
      if (queueItem.teacherId === teacherId) {
        teacherQueues.push({
          queueId,
          status: queueItem.status,
          progress: queueItem.progress,
          submissionCount: queueItem.submissions.length,
          completedCount: queueItem.results.length,
          startedAt: queueItem.startedAt,
          completedAt: queueItem.completedAt
        });
      }
    }

    return teacherQueues;
  }

  // Mock feedback generators
  generateMockFeedback(submission) {
    const feedbacks = [
      'Excellent work! Your understanding of the concepts is clear and well-demonstrated.',
      'Good effort! The work shows solid understanding with room for improvement in detail.',
      'Well done! Creative approach to the problem with accurate execution.',
      'Strong performance! The work demonstrates mastery of key concepts.',
      'Good work! Clear thinking process with minor areas for enhancement.'
    ];
    return feedbacks[Math.floor(Math.random() * feedbacks.length)];
  }

  generateStrengths() {
    const strengths = [
      'Clear problem-solving approach',
      'Excellent attention to detail',
      'Creative thinking',
      'Strong conceptual understanding',
      'Well-organized presentation'
    ];
    return strengths.slice(0, Math.floor(Math.random() * 3) + 1);
  }

  generateImprovements() {
    const improvements = [
      'Consider adding more detailed explanations',
      'Double-check calculations for accuracy',
      'Include more examples to support your points',
      'Organize work in a more structured manner',
      'Provide clearer labeling of diagrams'
    ];
    return improvements.slice(0, Math.floor(Math.random() * 2) + 1);
  }

  /**
   * Clean up old queue items (run periodically)
   */
  cleanupQueue() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [queueId, queueItem] of this.gradingQueue) {
      if (queueItem.startedAt < oneDayAgo) {
        this.gradingQueue.delete(queueId);
      }
    }
  }
}

// Export singleton instance
export default new AIGradingService();
