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

const AWS_RDS_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIGCTCCA/GgAwIBAgIRAIO6ldra1KZvNWJ0TA1ihXEwDQYJKoZIhvcNAQEMBQAw
gZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ
bmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws
QW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAO
BgNVBAcMB1NlYXR0bGUwIBcNMjEwNTIxMjE0NTA1WhgPMjEyMTA1MjEyMjQ1MDVa
MIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg
SW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM
LEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAw
DgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA
sDN52Si9pFSyZ1ruh3xAN0nVqEs960o2IK5CPu/ZfshFmzAwnx/MM8EHt/jMeZtj
SM58LADAsNDL01ELpFZATjgZQ6xNAyXRXE7RiTRUvNkK7O3o2qAGbLnJq/UqF7Sw
LRnB8V6hYOv+2EjVnohtGCn9SUFGZtYDjWXsLd4ML4Zpxv0a5LK7oEC7AHzbUR7R
jsjkrXqSv7GE7bvhSOhMkmgxgj1F3J0b0jdQdtyyj109aO0ATUmIvf+Bzadg5AI2
A9UA+TUcGeebhpHu8AP1Hf56XIlzPpaQv3ZJ4vzoLaVNUC7XKzAl1dlvCl7Klg/C
-----END CERTIFICATE-----`;

      if (isSsl) {
        sslConfig = { rejectUnauthorized: true };
        const rdsCaPath = process.env.RDS_CA_PATH || '/etc/pki/tls/certs/rds-combined-ca-bundle.pem';
        if (fs.existsSync(rdsCaPath)) {
          try {
            sslConfig.ca = fs.readFileSync(rdsCaPath);
          } catch (e: any) {
            console.warn('Could not read custom CA bundle, using embedded AWS RDS Root CA:', e?.message);
            sslConfig.ca = AWS_RDS_ROOT_CA;
          }
        } else {
          sslConfig.ca = AWS_RDS_ROOT_CA;
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
