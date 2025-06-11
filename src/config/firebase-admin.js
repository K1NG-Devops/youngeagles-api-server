import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let firebaseInitialized = false;

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (firebaseInitialized) {
    console.log('🔥 Firebase Admin already initialized');
    return admin;
  }

  try {
    const {
      FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY,
      FIREBASE_CLIENT_EMAIL,
      ENABLE_PUSH_NOTIFICATIONS
    } = process.env;

    // Check if push notifications are enabled
    if (ENABLE_PUSH_NOTIFICATIONS !== 'true') {
      console.log('📱 Push notifications are disabled. Set ENABLE_PUSH_NOTIFICATIONS=true to enable.');
      return null;
    }

    // Validate required environment variables
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️  Firebase Admin credentials not found in environment variables');
      console.log('📝 Please add FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL to your .env file');
      return null;
    }

    // Format the private key (handle escaped newlines)
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    // Initialize Firebase Admin
    const serviceAccount = {
      type: 'service_account',
      project_id: FIREBASE_PROJECT_ID,
      private_key: privateKey,
      client_email: FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: FIREBASE_PROJECT_ID,
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully!');
    console.log('📱 Push notifications are now enabled');
    
    return admin;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:');
    console.error('Error details:', error.message);
    
    if (error.message.includes('private_key')) {
      console.error('🔑 Check your FIREBASE_PRIVATE_KEY format in .env file');
    }
    if (error.message.includes('client_email')) {
      console.error('📧 Check your FIREBASE_CLIENT_EMAIL in .env file');
    }
    
    return null;
  }
};

// Export the initialization function and admin instance
export { initializeFirebaseAdmin };
export default admin;

