import express from 'express';
import authenticateToken from '../middleware/authMiddleware.js';
import { query } from '../db.js';

const router = express.Router();

// Helper function to execute database queries
async function executeQuery(sql, params = []) {
    const rows = await query(sql, params);
    return rows;
}

// Get ad configuration (admin only)
router.get('/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access ad configuration'
            });
        }

        const configs = await executeQuery(`
            SELECT * FROM ad_configurations 
            ORDER BY ad_type, placement
        `);

        res.json({
            success: true,
            configurations: configs
        });

    } catch (error) {
        console.error('Error fetching ad configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ad configuration',
            error: error.message
        });
    }
});

// Update ad configuration (admin only)
router.put('/config', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can update ad configuration'
            });
        }

        const { 
            ad_type, 
            placement, 
            is_active, 
            frequency_cap, 
            target_audience 
        } = req.body;

        if (!ad_type || !placement) {
            return res.status(400).json({
                success: false,
                message: 'Ad type and placement are required'
            });
        }

        // Insert or update configuration
        await executeQuery(`
            INSERT INTO ad_configurations (
                ad_type, placement, is_active, frequency_cap, target_audience, updated_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                is_active = VALUES(is_active),
                frequency_cap = VALUES(frequency_cap),
                target_audience = VALUES(target_audience),
                updated_at = NOW()
        `, [ad_type, placement, is_active, frequency_cap, target_audience]);

        res.json({
            success: true,
            message: 'Ad configuration updated successfully'
        });

    } catch (error) {
        console.error('Error updating ad configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ad configuration',
            error: error.message
        });
    }
});

// Get ad analytics (admin only)
router.get('/analytics', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can access ad analytics'
            });
        }

        const { start_date, end_date, ad_type, user_type } = req.query;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (start_date) {
            whereClause += ' AND impression_time >= ?';
            params.push(start_date);
        }

        if (end_date) {
            whereClause += ' AND impression_time <= ?';
            params.push(end_date);
        }

        if (ad_type) {
            whereClause += ' AND ad_type = ?';
            params.push(ad_type);
        }

        if (user_type) {
            whereClause += ' AND user_type = ?';
            params.push(user_type);
        }

        // Get overall analytics
        const overviewResults = await executeQuery(`
            SELECT 
                COUNT(*) as total_impressions,
                SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as total_clicks,
                SUM(revenue) as total_revenue,
                AVG(CASE WHEN clicked = 1 THEN 1.0 ELSE 0.0 END) * 100 as click_through_rate,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT session_id) as unique_sessions
            FROM ad_analytics 
            ${whereClause}
        `, params);
        
        const overview = overviewResults[0] || {};

        // Get analytics by ad type
        const byAdType = await executeQuery(`
            SELECT 
                ad_type,
                COUNT(*) as impressions,
                SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as clicks,
                SUM(revenue) as revenue,
                AVG(CASE WHEN clicked = 1 THEN 1.0 ELSE 0.0 END) * 100 as ctr
            FROM ad_analytics 
            ${whereClause}
            GROUP BY ad_type
            ORDER BY revenue DESC
        `, params);

        // Get analytics by placement
        const byPlacement = await executeQuery(`
            SELECT 
                placement,
                COUNT(*) as impressions,
                SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as clicks,
                SUM(revenue) as revenue,
                AVG(CASE WHEN clicked = 1 THEN 1.0 ELSE 0.0 END) * 100 as ctr
            FROM ad_analytics 
            ${whereClause}
            GROUP BY placement
            ORDER BY revenue DESC
        `, params);

        // Get daily revenue trend (last 30 days)
        const dailyRevenue = await executeQuery(`
            SELECT 
                DATE(impression_time) as date,
                COUNT(*) as impressions,
                SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as clicks,
                SUM(revenue) as revenue
            FROM ad_analytics 
            WHERE impression_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(impression_time)
            ORDER BY date DESC
            LIMIT 30
        `);

        res.json({
            success: true,
            analytics: {
                overview: {
                    total_impressions: overview.total_impressions || 0,
                    total_clicks: overview.total_clicks || 0,
                    total_revenue: parseFloat(overview.total_revenue || 0),
                    click_through_rate: parseFloat(overview.click_through_rate || 0),
                    unique_users: overview.unique_users || 0,
                    unique_sessions: overview.unique_sessions || 0
                },
                by_ad_type: byAdType.map(item => ({
                    ...item,
                    revenue: parseFloat(item.revenue || 0),
                    ctr: parseFloat(item.ctr || 0)
                })),
                by_placement: byPlacement.map(item => ({
                    ...item,
                    revenue: parseFloat(item.revenue || 0),
                    ctr: parseFloat(item.ctr || 0)
                })),
                daily_revenue: dailyRevenue.map(item => ({
                    ...item,
                    revenue: parseFloat(item.revenue || 0)
                }))
            }
        });

    } catch (error) {
        console.error('Error fetching ad analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ad analytics',
            error: error.message
        });
    }
});

// Log ad impression/click (for tracking)
router.post('/track', authenticateToken, async (req, res) => {
    try {
        const { 
            ad_type, 
            placement, 
            clicked = false, 
            revenue = 0, 
            session_id 
        } = req.body;

        if (!ad_type || !placement) {
            return res.status(400).json({
                success: false,
                message: 'Ad type and placement are required'
            });
        }

        // Check if user exists in users or staff table
        let validUserId = null;
        if (req.user.userType === 'admin' || req.user.userType === 'teacher') {
            // For staff users, we'll store null for user_id and track in session_id
            validUserId = null;
        } else {
            // For parent users, use the actual user_id
            validUserId = req.user.id;
        }
        
        await executeQuery(`
            INSERT INTO ad_analytics (
                user_id, ad_type, placement, clicked, revenue, 
                session_id, user_type, impression_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            validUserId,
            ad_type,
            placement,
            clicked,
            revenue,
            session_id || `session_${req.user.id}_${Date.now()}`,
            req.user.userType || 'parent'
        ]);

        res.json({
            success: true,
            message: 'Ad interaction tracked successfully'
        });

    } catch (error) {
        console.error('Error tracking ad interaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track ad interaction',
            error: error.message
        });
    }
});

// Get user ad preferences
router.get('/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const preferencesResults = await executeQuery(`
            SELECT * FROM user_ad_preferences WHERE user_id = ?
        `, [userId]);
        
        const preferences = preferencesResults[0] || null;

        // Return default preferences if none exist
        const defaultPreferences = {
            ad_free_premium: false,
            personalized_ads: true,
            educational_content_only: true,
            frequency_preference: 'standard'
        };

        res.json({
            success: true,
            preferences: preferences || defaultPreferences
        });

    } catch (error) {
        console.error('Error fetching ad preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ad preferences',
            error: error.message
        });
    }
});

// Update user ad preferences
router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            ad_free_premium, 
            personalized_ads, 
            educational_content_only, 
            frequency_preference 
        } = req.body;

        await executeQuery(`
            INSERT INTO user_ad_preferences (
                user_id, ad_free_premium, personalized_ads, 
                educational_content_only, frequency_preference, updated_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                ad_free_premium = VALUES(ad_free_premium),
                personalized_ads = VALUES(personalized_ads),
                educational_content_only = VALUES(educational_content_only),
                frequency_preference = VALUES(frequency_preference),
                updated_at = NOW()
        `, [
            userId, 
            ad_free_premium, 
            personalized_ads, 
            educational_content_only, 
            frequency_preference
        ]);

        res.json({
            success: true,
            message: 'Ad preferences updated successfully'
        });

    } catch (error) {
        console.error('Error updating ad preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ad preferences',
            error: error.message
        });
    }
});

// Handle premium upgrade
router.post('/premium-upgrade', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscription_type, payment_reference } = req.body;

        if (!subscription_type || !payment_reference) {
            return res.status(400).json({
                success: false,
                message: 'Subscription type and payment reference are required'
            });
        }

        // Update user to premium (ad-free)
        await executeQuery(`
            INSERT INTO user_ad_preferences (
                user_id, ad_free_premium, updated_at
            ) VALUES (?, 1, NOW())
            ON DUPLICATE KEY UPDATE
                ad_free_premium = 1,
                updated_at = NOW()
        `, [userId]);

        // Log the premium upgrade (could be extended with payment tracking)
        console.log(`User ${userId} upgraded to premium: ${subscription_type}, Payment: ${payment_reference}`);

        res.json({
            success: true,
            message: 'Premium upgrade successful',
            subscription: {
                type: subscription_type,
                payment_reference: payment_reference,
                activated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error processing premium upgrade:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process premium upgrade',
            error: error.message
        });
    }
});

// Log user feedback on ads
router.post('/feedback', authenticateToken, async (req, res) => {
    try {
        const { 
            ad_type, 
            placement, 
            feedback_type, 
            feedback_text, 
            rating 
        } = req.body;

        if (!ad_type || !placement || !feedback_type) {
            return res.status(400).json({
                success: false,
                message: 'Ad type, placement, and feedback type are required'
            });
        }

        // For now, just log the feedback (could be stored in a dedicated table)
        console.log(`Ad Feedback from User ${req.user.id}:`, {
            ad_type,
            placement,
            feedback_type,
            feedback_text,
            rating,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Feedback recorded successfully'
        });

    } catch (error) {
        console.error('Error recording ad feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record feedback',
            error: error.message
        });
    }
});

export default router;
