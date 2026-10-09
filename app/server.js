const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 80;
const APP_ENV = process.env.APP_ENV || 'Production';
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER || 'appadmin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'P@ssw0rdSecure2026!';
const DB_NAME = process.env.DB_NAME || 'appdb';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let pool = null;
if (DB_HOST) {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 4000
  });
}

const mockProducts = [
  { id: 1, name: 'AWS Cloud Architecture Blueprint', category: 'DevOps & Cloud', price: '49.99', stock: 120, sku: 'AWS-ARCH-01', description: 'Complete production-ready AWS CloudFormation & CI/CD template kit.' },
  { id: 2, name: 'RDS High-Availability Failover Kit', category: 'Database', price: '89.00', stock: 45, sku: 'RDS-HA-02', description: 'Automated multi-AZ failover and point-in-time backup tooling.' },
  { id: 3, name: 'ECR Container Pipeline Accelerator', category: 'CI/CD Automation', price: '29.50', stock: 350, sku: 'ECR-PIPE-03', description: 'OIDC integration and zero-downtime rolling container delivery.' },
  { id: 4, name: 'Cloudflare Zero Trust Edge Shield', category: 'Security & DNS', price: '19.99', stock: 890, sku: 'CF-SHIELD-04', description: 'Universal SSL/TLS with DDoS Layer 7 rate limiting rules.' }
];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: APP_ENV });
});

app.get('/api/catalog', async (req, res) => {
  let products = mockProducts;
  let isRdsConnected = false;

  if (pool) {
    try {
      const [rows] = await pool.query('SELECT 1 + 1 AS solution');
      isRdsConnected = true;
    } catch (err) {
      console.log('RDS Query status:', err.message);
    }
  }

  res.json({
    env: APP_ENV,
    isRdsConnected,
    products,
    engine: 'MySQL 8.0 on AWS RDS'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`AuroraStore Web Server running on port ${port} in ${APP_ENV} mode`);
});
