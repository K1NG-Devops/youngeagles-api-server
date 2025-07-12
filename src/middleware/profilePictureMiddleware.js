import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Middleware to handle missing profile pictures
 * Serves a default avatar if the requested profile picture doesn't exist
 */
export function profilePictureMiddleware(req, res, next) {
    // Only handle profile picture requests
    if (!req.path.startsWith('/uploads/profile_pictures/')) {
        return next();
    }

    const filePath = path.join(__dirname, '../..', req.path);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist, redirect to default avatar
            console.log(`Profile picture not found: ${req.path}`);
            
            // You can either:
            // 1. Redirect to a default avatar
            res.redirect('/assets/default-avatar.png');
            
            // 2. Or serve a default avatar directly
            // const defaultAvatar = path.join(__dirname, '../../assets/default-avatar.png');
            // res.sendFile(defaultAvatar);
            
            // 3. Or return a 404 with a helpful message
            // res.status(404).json({
            //     error: 'Profile picture not found',
            //     defaultAvatar: '/assets/default-avatar.png'
            // });
        } else {
            // File exists, continue to next middleware (static file serving)
            next();
        }
    });
}
