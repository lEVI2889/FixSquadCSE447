const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function initDatabase() {
  console.log('🚀 [DB Init] Starting raw SQL database initialization...');

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    multipleStatements: true
  };

  const dbName = process.env.DB_NAME || 'service_platform';

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log(`📡 Connected to MySQL server at ${dbConfig.host}:${dbConfig.port}`);

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✅ Database \`${dbName}\` confirmed.`);

    await connection.changeUser({ database: dbName });

    // Read and run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Executing raw SQL statements from schema.sql...');
    await connection.query(schemaSql);

    console.log('✅ Table `categories` created/verified and seed data populated successfully.');
    await connection.end();
  } catch (err) {
    console.error('❌ [DB Init Error]:', err.message);
    console.log('ℹ️ Ensure your MySQL server is running if using live database.');
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
