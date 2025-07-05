# Homework Notification & Button System Features

## Overview
This document outlines the enhanced homework submission system with automatic notifications, proper button handling for different homework types, and AI-assisted grading workflow.

## 🔔 Notification System

### When Homework is Submitted
1. **Interactive Homework**: Shows notification with auto-calculated score
2. **Traditional Homework**: Shows notification that work was submitted to teacher
3. **Notification includes**: Teacher name, submission details, and score (if applicable)

### Parent Notifications Include:
- **Title**: "Interactive Homework Completed" or "Homework Submitted"
- **Message**: Details about what was submitted, to which teacher, and score if auto-graded
- **Type**: `homework_submission`
- **Score**: Percentage score for interactive homework, null for traditional

### Teacher Notifications Include:
- **AI Grading Complete**: When AI finishes grading submissions
- **Submission Alerts**: When students submit work

## 🎯 Button Logic for Different Homework Types

### Interactive Lessons/Homework
- **Button Text**: "Start Homework" (not "Submit Work")
- **Behavior**: Launches interactive lesson directly
- **No Submit Button**: Automatically submits when completed
- **Auto-Grading**: Scores calculated and stored immediately

### Traditional Homework (CAPS/File-based)
- **Button Text**: "View Details" in homework list
- **After Viewing**: Shows "Start Homework" button
- **Submit Process**: File upload with manual submission
- **Teacher Grading**: Manual review and scoring required

### Submitted Homework
- **No Submit Button**: Once submitted, shows status instead
- **Status Display**: "Submitted", "Graded", or "Returned"
- **Score Display**: Shows grade when available

## 🤖 AI-Assisted Teacher Grading Workflow

### For Teachers Using AI to Grade Work:

1. **View Submissions**: See all student submissions for homework
2. **Start AI Grading**: Click to begin automated grading process
3. **AI Processing**: System analyzes submissions (2-5 minutes)
4. **Review Results**: Teacher reviews AI suggestions
5. **Apply Grades**: Teacher confirms and applies grades
6. **Return to Parents**: Notifications sent automatically

### Teacher Notification Flow:
```
Submissions Received → AI Grading Started → AI Complete Notification → 
Review & Apply Grades → Parent Notification Sent
```

## 📱 API Endpoints

### Homework Submission
- **POST** `/api/homework/{homeworkId}/submit`
- Handles both interactive and traditional homework
- Automatic notifications to parents
- Auto-grading for interactive content

### Manual Grading
- **POST** `/api/homework/{homeworkId}/submissions/{submissionId}/grade`
- Teachers grade individual submissions
- Automatic parent notifications with grades

### AI Grading
- **POST** `/api/ai/grading/start` - Start AI grading batch
- **GET** `/api/ai/grading/queue` - Check grading status
- **GET** `/api/ai/grading/results/{submissionId}` - Get AI results

### Notifications
- **GET** `/api/notifications` - Get all notifications
- **GET** `/api/notifications/unread/count` - Unread count
- **POST** `/api/notifications/{id}/read` - Mark as read

## 🗄️ Database Schema Updates

### New Tables:
1. **notifications**: Stores all notification data
2. **homework_individual_assignments**: Tracks individual homework assignments

### Updated Tables:
1. **homework_submissions**: Added interactive homework fields
2. **homework**: Added content_type and assignment_type fields

### Key Fields Added:
- `content_type`: 'traditional', 'interactive', 'project'
- `submission_type`: 'interactive', 'file_upload', 'text'
- `score`: Auto-calculated score for interactive homework
- `answers_data`: JSON data for interactive responses
- `auto_graded`: Boolean flag for automatic grading

## 🎨 UI Button Behavior Summary

| Homework Type | List View Button | Detail View Action | Submit Process |
|---------------|------------------|-------------------|----------------|
| Interactive | "Start Homework" | Launch directly | Auto-submit on completion |
| Traditional/CAPS | "View Details" | "Start Homework" after viewing | Manual file upload & submit |
| Submitted | Status display | View results/grade | No further submission |

## 🔄 Complete Workflow Example

### Interactive Homework:
1. Student clicks "Start Homework" → Launches lesson
2. Student completes interactive content → Auto-submits with score
3. Parent gets notification: "Interactive homework completed with X% score"
4. Teacher can review if needed, but already graded

### Traditional Homework:
1. Student clicks "View Details" → Shows instructions
2. Student clicks "Start Homework" → Can now upload files
3. Student uploads work and clicks submit
4. Parent gets notification: "Homework submitted to Teacher Name"
5. Teacher grades manually → Parent gets graded notification

### AI-Assisted Grading (Teacher Side):
1. Teacher sees submissions in dashboard
2. Teacher clicks "Start AI Grading" for batch of submissions
3. AI processes work (teacher gets progress updates)
4. Teacher gets completion notification
5. Teacher reviews AI suggestions and applies grades
6. Parents automatically notified of grades

This system ensures that:
- ✅ Interactive homework submits automatically with immediate scoring
- ✅ Traditional homework requires proper review before submission
- ✅ Parents get immediate feedback on interactive work
- ✅ Teachers can use AI to speed up grading process
- ✅ All submissions trigger appropriate notifications
- ✅ Button text and behavior match homework type
