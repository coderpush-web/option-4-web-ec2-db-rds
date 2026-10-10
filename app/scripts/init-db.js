#!/usr/bin/env node
const postgres = require('postgres');
const fs = require('fs');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.log('Skipping database migration: neither POSTGRES_URL nor DATABASE_URL is set.');
  process.exit(0);
}

const isSsl = connectionString.includes('sslmode=require');
let sslConfig = false;

if (isSsl) {
  sslConfig = { rejectUnauthorized: true };
  const rdsCaPath = process.env.RDS_CA_PATH || '/etc/pki/tls/certs/rds-combined-ca-bundle.pem';
  if (fs.existsSync(rdsCaPath)) {
    try {
      sslConfig.ca = fs.readFileSync(rdsCaPath);
    } catch (e) {
      console.warn('Could not read custom CA bundle, using system root CAs:', e.message);
    }
  }
}

const sql = postgres(connectionString, {
  ssl: sslConfig,
  connect_timeout: 10,
  max: 1,
});

async function run() {
  console.log('Connecting to PostgreSQL to verify and initialize schema...');
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        image_url VARCHAR(255) NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        customer_id UUID NOT NULL,
        amount INT NOT NULL,
        status VARCHAR(255) NOT NULL,
        date DATE NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS revenue (
        month VARCHAR(4) NOT NULL UNIQUE,
        revenue INT NOT NULL
      );
    `;

    console.log('✅ PostgreSQL schema verified/initialized successfully.');
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema initialization error:', err.message);
    await sql.end();
    process.exit(1);
  }
}

run();
