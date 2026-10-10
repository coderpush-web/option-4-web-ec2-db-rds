import postgres from 'postgres';
import fs from 'fs';
import { invoices, customers, revenue } from './placeholder-data';
import { initDatabaseSchema } from './schema-init';

let _client: any = null;
let _schemaInitStarted = false;

export function getSqlClient(): any {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!_client) {
    try {
      const isSsl = connectionString.includes('sslmode=require');
      let sslConfig: any = false;

      if (isSsl) {
        sslConfig = { rejectUnauthorized: true };
        const rdsCaPath = process.env.RDS_CA_PATH || '/etc/pki/tls/certs/rds-combined-ca-bundle.pem';
        if (fs.existsSync(rdsCaPath)) {
          try {
            sslConfig.ca = fs.readFileSync(rdsCaPath);
          } catch (e: any) {
            console.warn('Could not read custom CA bundle, falling back to standard root CAs:', e?.message);
          }
        }
      }

      _client = postgres(connectionString, {
        ssl: sslConfig,
        connect_timeout: 5,
        idle_timeout: 10,
        max: 5,
      });

      if (!_schemaInitStarted) {
        _schemaInitStarted = true;
        initDatabaseSchema(_client).catch((err) => {
          console.error('Initial schema init error:', err);
        });
      }
    } catch (e) {
      console.error('Failed to init postgres client:', e);
      return null;
    }
  }

  return _client;
}

export const sqlClient = new Proxy(function () {} as any, {
  apply(_target, thisArg, argArray) {
    const client = getSqlClient();
    if (!client) {
      throw new Error('Database not configured: POSTGRES_URL or DATABASE_URL is not set.');
    }
    return Reflect.apply(client, thisArg, argArray);
  },
  get(_target, prop, receiver) {
    const client = getSqlClient();
    if (!client) {
      return undefined;
    }
    return Reflect.get(client, prop, receiver);
  },
});

export { invoices, customers, revenue };
