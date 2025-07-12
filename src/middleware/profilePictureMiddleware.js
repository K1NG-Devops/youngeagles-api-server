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
    
    // Skip if not an image
    if (!filePath.endsWith('.png') && !filePath.endsWith('.jpg') && !filePath.endsWith('.jpeg')) {
        return next();
    }

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist, serve default avatar
            console.log(`Profile picture not found: ${req.path}`);
            const defaultAvatar = path.join(__dirname, '../../assets/default-avatar.png');
            res.sendFile(defaultAvatar);
        } else {
            // File exists, continue to next middleware (static file serving)
            next();
        }
    });
}
