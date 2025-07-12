export default {
    host: process.env.DB_HOST || 'shuttle.proxy.rlwy.net',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'fhdgRvbocRQKcikxGTNsQUHVIMizngLb',
    database: process.env.DB_NAME || 'skydek_DB',
    port: process.env.DB_PORT || 49263,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: false // Disable SSL since we had certificate issues
};
