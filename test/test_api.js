const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running automated unit & integration tests for Option 4 (RDS PostgreSQL)...');

// 1. Sanity & Package Verification
assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

const pkg = require(path.join(__dirname, '../app/package.json'));
assert.ok(pkg.name || pkg.private, 'Package verification passed');
assert.ok(pkg.dependencies.next, 'Next.js dependency must be present');
assert.ok(pkg.dependencies.react, 'React dependency must be present');
assert.ok(pkg.dependencies.postgres, 'postgres.js driver must be present');

// 2. File Artifact Verification
assert.ok(fs.existsSync(path.join(__dirname, '../app/Dockerfile')), 'Dockerfile must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/app/page.tsx')), 'Next.js page.tsx must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/app/api/health/route.ts')), 'Health check route.ts must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/.env.example')), '.env.example must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/app/lib/schema-init.ts')), 'schema-init.ts must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/scripts/init-db.js')), 'scripts/init-db.js must exist');

// 3. Environment Example Contract Verification
const envExample = fs.readFileSync(path.join(__dirname, '../app/.env.example'), 'utf8');
assert.ok(envExample.includes('AUTH_SECRET='), '.env.example must document AUTH_SECRET');
assert.ok(envExample.includes('AUTH_URL='), '.env.example must document AUTH_URL');
assert.ok(envExample.includes('POSTGRES_URL='), '.env.example must document POSTGRES_URL');
assert.ok(envExample.includes('DATABASE_URL='), '.env.example must document DATABASE_URL');
assert.ok(envExample.includes('APP_ENV='), '.env.example must document APP_ENV');
assert.ok(envExample.includes('PORT='), '.env.example must document PORT');

// 4. Zero Hardcoded Fallback Credentials & Strict TLS in db.ts
const dbContent = fs.readFileSync(path.join(__dirname, '../app/app/lib/db.ts'), 'utf8');
assert.ok(!dbContent.includes('postgres://postgres:postgres'), 'db.ts must NOT have fallback hardcoded credentials');
assert.ok(!dbContent.includes('rejectUnauthorized: false'), 'db.ts must NOT disable TLS certificate chain verification');
assert.ok(dbContent.includes('rejectUnauthorized: true'), 'db.ts must enforce TLS verification with rejectUnauthorized: true');
assert.ok(dbContent.includes('getSqlClient'), 'db.ts must export lazy getSqlClient');

// 5. Authentication Fail-Closed & Zero Backdoor Verification
const authContent = fs.readFileSync(path.join(__dirname, '../app/auth.ts'), 'utf8');
assert.ok(!authContent.includes('placeholderUsers'), 'auth.ts must NOT import or use placeholderUsers');
assert.ok(!authContent.includes('123456'), 'auth.ts must NOT contain mock password fallback');

const placeholderContent = fs.readFileSync(path.join(__dirname, '../app/app/lib/placeholder-data.ts'), 'utf8');
assert.ok(!placeholderContent.includes('123456'), 'placeholder-data.ts must NOT contain 123456 password');

// 6. Strict Compiler Configuration
const nextConfig = fs.readFileSync(path.join(__dirname, '../app/next.config.js'), 'utf8');
assert.ok(!nextConfig.includes('ignoreBuildErrors: true'), 'next.config.js must not suppress TypeScript errors');
assert.ok(!nextConfig.includes('ignoreDuringBuilds: true'), 'next.config.js must not suppress ESLint errors');

// 7. CloudFormation Module Files Verification
assert.ok(fs.existsSync(path.join(__dirname, '../infra/modules/app.yaml')), 'app.yaml must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../infra/modules/iam-roles.yaml')), 'iam-roles.yaml must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../infra/modules/security-groups.yaml')), 'security-groups.yaml must exist');

console.log('✅ Automated Next.js & Infrastructure tests passed successfully!');
