import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures that all required upload directories exist
 */
export async function ensureUploadDirectories() {
    const uploadDirs = [
        'uploads',
        'uploads/profile_pictures',
        'uploads/homework',
        'uploads/payment_proofs'
    ];

    const rootDir = path.join(__dirname, '../..');

    for (const dir of uploadDirs) {
        const fullPath = path.join(rootDir, dir);
        try {
            await fs.mkdir(fullPath, { recursive: true });
            console.log(`✅ Directory ensured: ${dir}`);
        } catch (error) {
            console.error(`❌ Error creating directory ${dir}:`, error.message);
        }
    }
}
