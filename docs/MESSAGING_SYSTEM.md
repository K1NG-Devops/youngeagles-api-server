# Young Eagles Messaging System

## Overview
The messaging system enables real-time communication between admin, teachers, and parents in the preschool platform. It supports individual conversations, group messaging, and broadcast announcements.

## How It Works

### 1. **User Roles & Communication Flow**

#### **Admin** 👑
- Can message **ALL** teachers and parents
- Can send **broadcast messages** to groups:
  - All parents
  - All teachers  
  - Parents of specific classes
- Can create announcements
- Has full access to all conversations

#### **Teachers** 👨‍🏫
- Can message **admin**
- Can message **parents of their students** (based on class assignment)
- Can send class-specific announcements
- Cannot message parents outside their assigned class

#### **Parents** 👪
- Can message **admin**
- Can message **their child's teachers** (automatically determined by child's class)
- Can respond to messages and announcements
- Cannot initiate conversations with other parents

### 2. **Message Types**

#### **Individual Messages** 💬
- One-on-one conversations
- Private communication between two users
- Real-time delivery with read receipts

#### **Broadcast Messages** 📢
- Admin sends to multiple recipients simultaneously
- Creates individual conversations with each recipient
- Used for school-wide announcements

#### **Class Announcements** 🎓
- Teachers send to all parents in their class
- Homework reminders, field trip notices, etc.
- Targeted communication by class

### 3. **API Endpoints**

#### **Get Conversations**
```
GET /api/messaging/conversations
```
Returns list of conversations for authenticated user with:
- Conversation metadata
- Last message preview
- Unread count
- Participant information

#### **Get Messages**
```
GET /api/messaging/conversations/:conversationId/messages?page=1&limit=50
```
Returns paginated messages for a specific conversation with:
- Message content and metadata
- Sender information
- Read status
- Timestamps

#### **Start New Conversation**
```
POST /api/messaging/conversations
{
  "recipientId": 123,
  "recipientType": "teacher",
  "subject": "About homework",
  "messageContent": "Hello, I wanted to discuss..."
}
```

#### **Send Message**
```
POST /api/messaging/conversations/:conversationId/messages
{
  "content": "Thank you for the update!",
  "messageType": "text"
}
```

#### **Get Available Contacts**
```
GET /api/messaging/contacts
```
Returns users the current user can start conversations with

#### **Send Broadcast** (Admin only)
```
POST /api/messaging/broadcast
{
  "subject": "School Holiday Notice",
  "content": "The school will be closed...",
  "recipientType": "all_parents" // or "all_teachers", "class_parents"
}
```

#### **Get Unread Count**
```
GET /api/messaging/unread-count
```
Returns total unread message count for notification badges

### 4. **Real-time Features**

#### **Socket.IO Events**
- **New Message**: `user_{type}_{id}` receives message notifications
- **New Conversation**: Real-time conversation creation alerts
- **Broadcast Notifications**: Instant delivery of announcements
- **Read Receipts**: Live read status updates

#### **Notification System**
- Browser notifications for new messages
- Unread message badges
- Real-time conversation list updates
- Push notifications (when PWA is installed)

### 5. **Frontend Integration**

#### **Message Button Functionality**
When users click the message button, they should see:

1. **Conversation List** - Shows all existing conversations
2. **New Message Button** - Starts new conversations
3. **Contact Picker** - Shows available contacts based on user role
4. **Message Thread** - Individual conversation view
5. **Compose Area** - Text input with send button

#### **User Experience Flow**

1. **Admin clicks Messages** →
   - Sees list of all conversations
   - Can click "New Message" to see all teachers/parents
   - Can send broadcasts to groups

2. **Teacher clicks Messages** →
   - Sees conversations with admin and parents
   - Can click "New Message" to see admin + their class parents
   - Can send class announcements

3. **Parent clicks Messages** →
   - Sees conversations with admin and teachers
   - Can click "New Message" to see admin + child's teachers
   - Can respond to school communications

### 6. **Database Schema**

#### **Core Tables**
- `conversations` - Conversation metadata
- `conversation_participants` - Who's in each conversation
- `messages` - All message content
- `notifications` - System notifications
- `message_attachments` - File attachments (future)

#### **Key Features**
- Foreign key relationships ensure data integrity
- Indexes optimize query performance
- Soft deletes preserve message history
- Support for file attachments and reactions

### 7. **Security Features**

#### **Authorization**
- Users can only see conversations they participate in
- Role-based access control for broadcast messages
- Input validation and sanitization
- SQL injection protection

#### **Privacy**
- Messages are only visible to participants
- Deleted messages are soft-deleted (audit trail)
- File uploads are secured and validated

### 8. **Implementation Examples**

#### **Frontend Component Structure**
```
MessagingPage/
├── ConversationList.jsx
├── MessageThread.jsx
├── ComposeMessage.jsx
├── ContactPicker.jsx
├── BroadcastForm.jsx (admin only)
└── NotificationBadge.jsx
```

#### **Sample API Calls**
```javascript
// Get conversations
const conversations = await api.get('/api/messaging/conversations');

// Send message
await api.post(`/api/messaging/conversations/${conversationId}/messages`, {
  content: messageText,
  messageType: 'text'
});

// Start new conversation
await api.post('/api/messaging/conversations', {
  recipientId: selectedContact.id,
  recipientType: selectedContact.type,
  subject: subject,
  messageContent: initialMessage
});
```

### 9. **Next Steps for Frontend**

1. **Update Message Button**: Instead of going to main area, navigate to messaging interface
2. **Create Messaging Components**: Build the conversation list and message thread views
3. **Implement Real-time**: Connect to Socket.IO for live updates
4. **Add Notifications**: Show unread counts and new message alerts
5. **Role-based UI**: Different interfaces for admin, teachers, and parents

### 10. **Future Enhancements**

- File attachments (images, documents)
- Voice messages
- Message reactions (thumbs up, etc.)
- Message search functionality
- Message templates for common responses
- Scheduled message sending
- Message encryption for sensitive communications

## Technical Notes

- All endpoints require authentication
- Messages support pagination for performance
- Real-time events use Socket.IO rooms
- Database queries are optimized with proper indexing
- CORS is configured for cross-origin requests

The messaging system is now fully functional and ready for frontend integration! The backend provides all necessary endpoints for a complete messaging experience.
