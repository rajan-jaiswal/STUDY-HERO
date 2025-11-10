
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rajan@9768',
    database: process.env.DB_NAME || 'study_hero',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Test the connection
promisePool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Connected successfully!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ MySQL Connection Failed:', err);
        process.exit(1);
    });

module.exports = promisePool;
