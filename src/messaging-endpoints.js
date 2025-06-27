/**
 * Young Eagles Messaging System
 * Comprehensive messaging functionality for preschool communication
 */

export default function setupMessagingEndpoints(app, db, io, verifyToken) {
  
  // =============================================================================
  // MESSAGING ENDPOINTS - Real-time Communication System
  // =============================================================================

  // Get conversations list for authenticated user
  app.get('/api/messaging/conversations', async (req, res) => {
    console.log('💬 Getting conversations list');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      // Get all conversations where user is either sender or recipient
      const [conversations] = await db.execute(`
        SELECT DISTINCT
          c.id as conversation_id,
          c.subject,
          c.type,
          c.is_group,
          c.created_at,
          c.updated_at,
          
          -- Get the other participant's info (for individual chats)
          CASE 
            WHEN c.created_by = ? THEN 
              COALESCE(u_recipient.name, s_recipient.name, 'Unknown User')
            ELSE 
              COALESCE(u_creator.name, s_creator.name, 'Unknown User')
          END as other_participant_name,
          
          CASE 
            WHEN c.created_by = ? THEN 
              COALESCE(u_recipient.email, s_recipient.email)
            ELSE 
              COALESCE(u_creator.email, s_creator.email)
          END as other_participant_email,
          
          CASE 
            WHEN c.created_by = ? THEN 
              COALESCE(u_recipient.role, s_recipient.role)
            ELSE 
              COALESCE(u_creator.role, s_creator.role)
          END as other_participant_role,
          
          -- Latest message info
          m.content as last_message,
          m.created_at as last_message_time,
          
          -- Unread count (simplified since we don't have sender_type)
          (SELECT COUNT(*) FROM messages m2 
           WHERE m2.conversation_id = c.id 
           AND m2.sender_id != ? 
           AND m2.is_read = FALSE) as unread_count

        FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN users u_creator ON c.created_by = u_creator.id AND c.creator_type = 'parent'
        LEFT JOIN staff s_creator ON c.created_by = s_creator.id AND c.creator_type IN ('admin', 'teacher')
        LEFT JOIN users u_recipient ON cp.participant_id = u_recipient.id AND cp.participant_type = 'parent'
        LEFT JOIN staff s_recipient ON cp.participant_id = s_recipient.id AND cp.participant_type IN ('admin', 'teacher')
        LEFT JOIN messages m ON c.id = m.conversation_id AND m.id = (
          SELECT id FROM messages m3 
          WHERE m3.conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        )
        
        WHERE (c.created_by = ? AND c.creator_type = ?) 
           OR (cp.participant_id = ? AND cp.participant_type = ?)
        
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
      `, [
        user.id, user.id, user.id, user.id,
        user.id, user.role, user.id, user.role
      ]);

      console.log(`✅ Found ${conversations.length} conversations for ${user.email}`);

      res.json({
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.conversation_id,
          subject: conv.subject,
          type: conv.type,
          isGroup: conv.is_group,
          otherParticipant: {
            name: conv.other_participant_name,
            email: conv.other_participant_email,
            role: conv.other_participant_role
          },
          lastMessage: conv.last_message,
          lastMessageTime: conv.last_message_time,
          lastSenderType: null, // Not available in current schema
          unreadCount: conv.unread_count,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      res.status(500).json({
        message: 'Failed to fetch conversations',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get messages for a specific conversation
  app.get('/api/messaging/conversations/:conversationId/messages', async (req, res) => {
    console.log('💬 Getting messages for conversation:', req.params.conversationId);
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const { conversationId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      // Verify user has access to this conversation
      const [access] = await db.execute(`
        SELECT 1 FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = ? 
        AND ((c.created_by = ? AND c.creator_type = ?) 
             OR (cp.participant_id = ? AND cp.participant_type = ?))
      `, [conversationId, user.id, user.role, user.id, user.role]);

      if (access.length === 0) {
        return res.status(403).json({
          message: 'Access denied to this conversation',
          error: 'ACCESS_DENIED'
        });
      }

      // Get messages with sender info
      const [messages] = await db.execute(`
        SELECT 
          m.id,
          m.content,
          m.message_type,
          m.sender_id,
          m.is_read,
          m.created_at,
          
          COALESCE(u.name, s.name) as sender_name,
          COALESCE(u.email, s.email) as sender_email
          
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN staff s ON m.sender_id = s.id
        
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, [conversationId]);

      // Mark messages as read for current user
      await db.execute(`
        UPDATE messages 
        SET is_read = TRUE 
        WHERE conversation_id = ? 
        AND sender_id != ? 
        AND is_read = FALSE
      `, [conversationId, user.id]);

      console.log(`✅ Found ${messages.length} messages in conversation ${conversationId}`);

      res.json({
        success: true,
        messages: messages.reverse().map(msg => ({
          id: msg.id,
          content: msg.content,
          messageType: msg.message_type,
          senderId: msg.sender_id,
          senderType: null, // Not available in current schema
          senderName: msg.sender_name,
          senderEmail: msg.sender_email,
          isRead: msg.is_read,
          createdAt: msg.created_at,
          attachmentUrl: null, // Not available in current schema
          isOwn: msg.sender_id === user.id // Simplified since we don't have sender_type
        })),
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit
        }
      });

    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      res.status(500).json({
        message: 'Failed to fetch messages',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Start a new conversation
  app.post('/api/messaging/conversations', async (req, res) => {
    console.log('💬 Starting new conversation');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const { 
        recipientId, 
        recipientType, 
        subject, 
        messageContent, 
        conversationType = 'individual',
        isGroup = false 
      } = req.body;

      if (!recipientId || !recipientType || !subject || !messageContent) {
        return res.status(400).json({
          message: 'Recipient ID, type, subject, and message content are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Validate recipient exists
      const recipientTable = recipientType === 'parent' ? 'users' : 'staff';
      const [recipient] = await db.execute(
        `SELECT id, name, email FROM ${recipientTable} WHERE id = ?`,
        [recipientId]
      );

      if (recipient.length === 0) {
        return res.status(404).json({
          message: 'Recipient not found',
          error: 'RECIPIENT_NOT_FOUND'
        });
      }

      // Create conversation
      const [conversationResult] = await db.execute(`
        INSERT INTO conversations (
          subject, type, is_group, created_by, creator_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, [subject, conversationType, isGroup, user.id, user.role]);

      const conversationId = conversationResult.insertId;

      // Add recipient as participant
      await db.execute(`
        INSERT INTO conversation_participants (
          conversation_id, participant_id, participant_type, joined_at
        ) VALUES (?, ?, ?, NOW())
      `, [conversationId, recipientId, recipientType]);

      // Send initial message
      const [messageResult] = await db.execute(`
        INSERT INTO messages (
          conversation_id, sender_id, receiver_id, content, message_type, created_at
        ) VALUES (?, ?, ?, ?, 'general', NOW())
      `, [conversationId, user.id, recipientId, messageContent]);

      // Update conversation timestamp
      await db.execute(`
        UPDATE conversations SET updated_at = NOW() WHERE id = ?
      `, [conversationId]);

      console.log(`✅ New conversation created: ${conversationId}`);

      // Emit real-time notification
      const notificationData = {
        type: 'new_conversation',
        conversationId,
        subject,
        senderName: user.name,
        senderRole: user.role,
        recipientId,
        recipientType
      };

      io.emit(`user_${recipientType}_${recipientId}`, notificationData);

      res.status(201).json({
        success: true,
        message: 'Conversation started successfully',
        conversationId,
        messageId: messageResult.insertId
      });

    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      res.status(500).json({
        message: 'Failed to create conversation',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Send a message in existing conversation
  app.post('/api/messaging/conversations/:conversationId/messages', async (req, res) => {
    console.log('💬 Sending message to conversation:', req.params.conversationId);
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const { conversationId } = req.params;
      const { content, messageType = 'text', attachmentUrl } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          message: 'Message content is required',
          error: 'MISSING_CONTENT'
        });
      }

      // Verify user has access to this conversation
      const [access] = await db.execute(`
        SELECT 1 FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = ? 
        AND ((c.created_by = ? AND c.creator_type = ?) 
             OR (cp.participant_id = ? AND cp.participant_type = ?))
      `, [conversationId, user.id, user.role, user.id, user.role]);

      if (access.length === 0) {
        return res.status(403).json({
          message: 'Access denied to this conversation',
          error: 'ACCESS_DENIED'
        });
      }

      // Get the other participant (receiver) for this conversation
      const [otherParticipant] = await db.execute(`
        SELECT participant_id FROM conversation_participants 
        WHERE conversation_id = ? AND participant_id != ?
        UNION
        SELECT created_by as participant_id FROM conversations 
        WHERE id = ? AND created_by != ?
        LIMIT 1
      `, [conversationId, user.id, conversationId, user.id]);
      
      const receiverId = otherParticipant.length > 0 ? otherParticipant[0].participant_id : null;
      
      // Insert message
      const [messageResult] = await db.execute(`
        INSERT INTO messages (
          conversation_id, sender_id, receiver_id, content, message_type, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `, [conversationId, user.id, receiverId, content, messageType]);

      // Update conversation timestamp
      await db.execute(`
        UPDATE conversations SET updated_at = NOW() WHERE id = ?
      `, [conversationId]);

      // Get conversation participants for real-time notifications
      const [participants] = await db.execute(`
        SELECT participant_id, participant_type FROM conversation_participants 
        WHERE conversation_id = ?
        UNION
        SELECT created_by as participant_id, creator_type as participant_type 
        FROM conversations WHERE id = ?
      `, [conversationId, conversationId]);

      console.log(`✅ Message sent in conversation ${conversationId}`);

      // Emit real-time notification to all participants except sender
      const messageData = {
        type: 'new_message',
        conversationId,
        messageId: messageResult.insertId,
        content,
        senderName: user.name,
        senderRole: user.role,
        createdAt: new Date().toISOString()
      };

      participants.forEach(participant => {
        if (!(participant.participant_id === user.id && participant.participant_type === user.role)) {
          io.emit(`user_${participant.participant_type}_${participant.participant_id}`, messageData);
        }
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        messageId: messageResult.insertId
      });

    } catch (error) {
      console.error('❌ Error sending message:', error);
      res.status(500).json({
        message: 'Failed to send message',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get available contacts (for starting new conversations)
  app.get('/api/messaging/contacts', async (req, res) => {
    console.log('👥 Getting available contacts');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      let contacts = [];

      if (user.role === 'admin') {
        // Admin can message teachers and parents
        const [teachers] = await db.execute(`
          SELECT id, name, email, 'teacher' as role, 'teacher' as type
          FROM staff WHERE role = 'teacher'
          ORDER BY name
        `);

        const [parents] = await db.execute(`
          SELECT id, name, email, 'parent' as role, 'parent' as type
          FROM users WHERE role = 'parent'
          ORDER BY name
        `);

        contacts = [...teachers, ...parents];

      } else if (user.role === 'teacher') {
        // Teachers can message admin and parents of their students
        const [teacherInfo] = await db.execute(`
          SELECT className FROM staff WHERE id = ? AND role = 'teacher'
        `, [user.id]);

        const [admin] = await db.execute(`
          SELECT id, name, email, 'admin' as role, 'admin' as type
          FROM staff WHERE role = 'admin'
          ORDER BY name
        `);

        let parents = [];
        if (teacherInfo.length > 0 && teacherInfo[0].className) {
          const [classParents] = await db.execute(`
            SELECT DISTINCT u.id, u.name, u.email, 'parent' as role, 'parent' as type
            FROM users u
            INNER JOIN children c ON u.id = c.parent_id
            WHERE c.className = ?
            ORDER BY u.name
          `, [teacherInfo[0].className]);
          parents = classParents;
        }

        contacts = [...admin, ...parents];

      } else if (user.role === 'parent') {
        // Parents can message admin and their children's teachers
        const [admin] = await db.execute(`
          SELECT id, name, email, 'admin' as role, 'admin' as type
          FROM staff WHERE role = 'admin'
          ORDER BY name
        `);

        const [teachers] = await db.execute(`
          SELECT DISTINCT s.id, s.name, s.email, 'teacher' as role, 'teacher' as type
          FROM staff s
          INNER JOIN children c ON s.className = c.className
          WHERE c.parent_id = ?
          ORDER BY s.name
        `, [user.id]);

        contacts = [...admin, ...teachers];
      }

      console.log(`✅ Found ${contacts.length} available contacts for ${user.role}`);

      res.json({
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
          type: contact.type
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching contacts:', error);
      res.status(500).json({
        message: 'Failed to fetch contacts',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Send broadcast message (Admin only)
  app.post('/api/messaging/broadcast', async (req, res) => {
    console.log('📢 Sending broadcast message');
    const user = verifyToken(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required',
        error: 'FORBIDDEN'
      });
    }

    try {
      const { subject, content, recipientType, className } = req.body;

      if (!subject || !content || !recipientType) {
        return res.status(400).json({
          message: 'Subject, content, and recipient type are required',
          error: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Get recipients based on type
      let recipients = [];
      
      if (recipientType === 'all_parents') {
        const [parents] = await db.execute(`
          SELECT id, name, email, 'parent' as type FROM users WHERE role = 'parent'
        `);
        recipients = parents;
      } else if (recipientType === 'all_teachers') {
        const [teachers] = await db.execute(`
          SELECT id, name, email, 'teacher' as type FROM staff WHERE role = 'teacher'
        `);
        recipients = teachers;
      } else if (recipientType === 'class_parents' && className) {
        const [classParents] = await db.execute(`
          SELECT DISTINCT u.id, u.name, u.email, 'parent' as type
          FROM users u
          INNER JOIN children c ON u.id = c.parent_id
          WHERE c.className = ?
        `, [className]);
        recipients = classParents;
      }

      if (recipients.length === 0) {
        return res.status(400).json({
          message: 'No recipients found for the specified criteria',
          error: 'NO_RECIPIENTS'
        });
      }

      // Create individual conversations for each recipient
      const results = [];
      for (const recipient of recipients) {
        try {
          // Create conversation
          const [conversationResult] = await db.execute(`
            INSERT INTO conversations (
              subject, type, is_group, created_by, creator_type, created_at, updated_at
            ) VALUES (?, 'broadcast', FALSE, ?, ?, NOW(), NOW())
          `, [subject, user.id, user.role]);

          const conversationId = conversationResult.insertId;

          // Add recipient as participant
          await db.execute(`
            INSERT INTO conversation_participants (
              conversation_id, participant_id, participant_type, joined_at
            ) VALUES (?, ?, ?, NOW())
          `, [conversationId, recipient.id, recipient.type]);

          // Send message
          await db.execute(`
            INSERT INTO messages (
              conversation_id, sender_id, receiver_id, content, message_type, created_at
            ) VALUES (?, ?, ?, ?, 'general', NOW())
          `, [conversationId, user.id, recipient.id, content]);

          results.push({
            recipientId: recipient.id,
            recipientName: recipient.name,
            conversationId
          });

          // Real-time notification
          io.emit(`user_${recipient.type}_${recipient.id}`, {
            type: 'broadcast_message',
            subject,
            senderName: user.name,
            conversationId
          });

        } catch (err) {
          console.error(`Failed to send to ${recipient.email}:`, err);
        }
      }

      console.log(`✅ Broadcast sent to ${results.length} recipients`);

      res.json({
        success: true,
        message: `Broadcast message sent to ${results.length} recipients`,
        results
      });

    } catch (error) {
      console.error('❌ Error sending broadcast:', error);
      res.status(500).json({
        message: 'Failed to send broadcast message',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Mark conversation as read
  app.patch('/api/messaging/conversations/:conversationId/read', async (req, res) => {
    console.log('👁️ Marking conversation as read:', req.params.conversationId);
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const { conversationId } = req.params;

      // Mark all messages in conversation as read for current user
      const [result] = await db.execute(`
        UPDATE messages 
        SET is_read = TRUE 
        WHERE conversation_id = ? 
        AND sender_id != ? 
        AND is_read = FALSE
      `, [conversationId, user.id]);

      console.log(`✅ Marked ${result.affectedRows} messages as read`);

      res.json({
        success: true,
        message: 'Conversation marked as read',
        messagesUpdated: result.affectedRows
      });

    } catch (error) {
      console.error('❌ Error marking conversation as read:', error);
      res.status(500).json({
        message: 'Failed to mark conversation as read',
        error: 'DATABASE_ERROR'
      });
    }
  });

  // Get unread message count
  app.get('/api/messaging/unread-count', async (req, res) => {
    console.log('🔢 Getting unread message count');
    const user = verifyToken(req);
    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    try {
      const [result] = await db.execute(`
        SELECT COUNT(*) as unread_count
        FROM messages m
        INNER JOIN conversations c ON m.conversation_id = c.id
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE m.sender_id != ? 
        AND m.is_read = FALSE
        AND ((c.created_by = ? AND c.creator_type = ?) 
             OR (cp.participant_id = ? AND cp.participant_type = ?))
      `, [user.id, user.id, user.role, user.id, user.role]);

      const unreadCount = result[0].unread_count;

      res.json({
        success: true,
        unreadCount
      });

    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      res.status(500).json({
        message: 'Failed to get unread count',
        error: 'DATABASE_ERROR'
      });
    }
  });

  console.log('✅ Messaging endpoints configured');
}
