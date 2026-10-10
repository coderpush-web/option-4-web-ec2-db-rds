import bcrypt from 'bcrypt';
import { invoices, customers, revenue } from './placeholder-data';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function initDatabaseSchema(sql: any): Promise<void> {
  if (!sql) return;
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Extensions
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      // 2. Tables
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

      // 3. Seed initial customers if empty
      const custCount = await sql`SELECT count(*)::int as count FROM customers`;
      if (custCount[0]?.count === 0 && customers.length > 0) {
        for (const customer of customers) {
          await sql`
            INSERT INTO customers (id, name, email, image_url)
            VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
            ON CONFLICT (id) DO NOTHING;
          `;
        }
      }

      // 4. Seed initial invoices if empty
      const invCount = await sql`SELECT count(*)::int as count FROM invoices`;
      if (invCount[0]?.count === 0 && invoices.length > 0) {
        for (const invoice of invoices) {
          await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
            ON CONFLICT (id) DO NOTHING;
          `;
        }
      }

      // 5. Seed initial revenue if empty
      const revCount = await sql`SELECT count(*)::int as count FROM revenue`;
      if (revCount[0]?.count === 0 && revenue.length > 0) {
        for (const rev of revenue) {
          await sql`
            INSERT INTO revenue (month, revenue)
            VALUES (${rev.month}, ${rev.revenue})
            ON CONFLICT (month) DO NOTHING;
          `;
        }
      }

      // 6. Seed initial admin user only if explicit password provided in environment
      const userCount = await sql`SELECT count(*)::int as count FROM users`;
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
      if (userCount[0]?.count === 0 && initialPassword) {
        const hashedPassword = await bcrypt.hash(initialPassword, 10);
        await sql`
          INSERT INTO users (name, email, password)
          VALUES ('Admin', 'admin@example.com', ${hashedPassword})
          ON CONFLICT (email) DO NOTHING;
        `;
      }

      isInitialized = true;
      console.log('✅ PostgreSQL database schema initialized successfully');
    } catch (error) {
      console.error('⚠️ Database schema initialization failed or skipped:', error);
      // Don't crash process, allow retry on next connection
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}
