import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @param {string} publicId - Public ID for the file
 * @returns {Promise<object>} - Upload result
 */
export async function uploadToCloudinary(filePath, folder, publicId) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            public_id: publicId,
            resource_type: 'auto',
            overwrite: true,
            invalidate: true
        });

        // Delete local file after successful upload
        fs.unlinkSync(filePath);

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @returns {Promise<object>} - Deletion result
 */
export async function deleteFromCloudinary(publicId) {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return {
            success: true,
            result
        };
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
}

/**
 * Get optimized URL for image
 * @param {string} publicId - Public ID of the image
 * @param {object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
export function getOptimizedImageUrl(publicId, options = {}) {
    const defaultOptions = {
        quality: 'auto',
        fetch_format: 'auto',
        ...options
    };

    return cloudinary.url(publicId, defaultOptions);
}
