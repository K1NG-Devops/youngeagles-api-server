/**
 * Admin WebSocket Events Handler
 * Emits real-time events to admin dashboard
 */

export class AdminWebSocketEvents {
  constructor(io) {
    this.io = io;
  }

  // Emit when new homework submission is received
  emitNewSubmission(submissionData) {
    const eventData = {
      type: 'new_submission',
      submissionId: submissionData.submissionId,
      studentName: submissionData.studentName || submissionData.childName,
      homeworkTitle: submissionData.homeworkTitle,
      parentName: submissionData.parentName,
      className: submissionData.className,
      submittedAt: new Date().toISOString(),
      filesCount: submissionData.filesCount || 0
    };

    console.log('📡 Emitting new_submission to admins:', eventData);
    
    // Send to all admin users
    this.io.to('role_admin').emit('new_submission', eventData);
    
    // Also send as general notification
    this.io.to('role_admin').emit('notification', {
      type: 'success',
      message: `New homework submission from ${eventData.studentName}`,
      urgent: false
    });
  }

  // Emit when new user registers
  emitNewUser(userData) {
    const eventData = {
      type: 'new_user',
      userId: userData.userId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      registeredAt: new Date().toISOString()
    };

    console.log('📡 Emitting new_user to admins:', eventData);
    
    // Send to all admin users
    this.io.to('role_admin').emit('new_user', eventData);
    
    // Send notification
    this.io.to('role_admin').emit('notification', {
      type: 'info',
      message: `New ${userData.role} registered: ${userData.name}`,
      urgent: userData.role === 'teacher' // Teacher registrations might need approval
    });
  }

  // Emit when attendance is recorded
  emitAttendanceUpdate(attendanceData) {
    const eventData = {
      type: 'attendance_update',
      className: attendanceData.className,
      presentCount: attendanceData.presentCount,
      totalCount: attendanceData.totalCount,
      teacherName: attendanceData.teacherName,
      recordedAt: new Date().toISOString()
    };

    console.log('📡 Emitting attendance_update to admins:', eventData);
    
    // Send to all admin users
    this.io.to('role_admin').emit('attendance_update', eventData);
  }

  // Emit system notifications
  emitSystemNotification(notificationData) {
    const eventData = {
      type: notificationData.type || 'info',
      message: notificationData.message,
      urgent: notificationData.urgent || false,
      timestamp: new Date().toISOString()
    };

    console.log('📡 Emitting system notification to admins:', eventData);
    
    // Send to all admin users
    this.io.to('role_admin').emit('notification', eventData);
  }

  // Emit when homework assignment is created
  emitHomeworkCreated(homeworkData) {
    const eventData = {
      type: 'homework_created',
      homeworkId: homeworkData.homeworkId,
      title: homeworkData.title,
      className: homeworkData.className,
      teacherName: homeworkData.teacherName,
      dueDate: homeworkData.dueDate,
      createdAt: new Date().toISOString()
    };

    console.log('📡 Emitting homework_created to admins:', eventData);
    
    // Send to all admin users
    this.io.to('role_admin').emit('homework_created', eventData);
    
    // Send notification
    this.io.to('role_admin').emit('notification', {
      type: 'info',
      message: `New homework created: ${homeworkData.title} for ${homeworkData.className}`,
      urgent: false
    });
  }

  // Emit test events for development
  emitTestEvent(eventData) {
    console.log('📡 Emitting test event to admins:', eventData);
    
    // Route test events based on type
    switch(eventData.type) {
      case 'new_submission':
        this.io.to('role_admin').emit('new_submission', eventData);
        break;
      case 'new_user':
        this.io.to('role_admin').emit('new_user', eventData);
        break;
      case 'attendance_update':
        this.io.to('role_admin').emit('attendance_update', eventData);
        break;
      default:
        this.io.to('role_admin').emit('notification', eventData);
    }
  }

  // Get connected admin count
  getConnectedAdminCount() {
    const adminRoom = this.io.sockets.adapter.rooms.get('role_admin');
    return adminRoom ? adminRoom.size : 0;
  }

  // Send system health update
  emitSystemHealth(healthData) {
    const eventData = {
      type: 'system_health',
      status: healthData.status,
      uptime: healthData.uptime,
      memoryUsage: healthData.memoryUsage,
      activeConnections: this.io.engine.clientsCount,
      timestamp: new Date().toISOString()
    };

    console.log('📡 Emitting system health to admins:', eventData);
    this.io.to('role_admin').emit('system_health', eventData);
  }
}

export default AdminWebSocketEvents; 