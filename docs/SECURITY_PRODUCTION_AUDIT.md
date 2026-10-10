# Comprehensive Security, Architectural & Production Readiness Audit
## Architecture Option 4: Production Multi-Tier Web EC2 Auto Scaling Group with AWS Managed Amazon RDS PostgreSQL 16
**Repository:** `option-4-web-ec2-db-rds`  
**Evaluation Date:** 2026-10-10  
**Audit Standard:** AWS Well-Architected Framework (Security, Reliability, Operational Excellence) & CWE/CVSS v3.1  
**Status:** Action Required Prior to Production Deployment  

---

## 1. Executive Summary

This document presents a comprehensive, production-grade security, architectural, and reliability assessment of **Option 4 (`option-4-web-ec2-db-rds`)**.

Option 4 represents the **flagship, enterprise-grade multi-tier reference architecture** pairing an Auto Scaling Group (ASG) of containerized Next.js 14 web instances across Multi-AZ Private Subnets with an **AWS Managed Amazon RDS PostgreSQL 16 Multi-AZ** database instance. Ingress is managed via an Application Load Balancer (ALB) and edge-cached by Amazon CloudFront CDN.

### Key Assessment Findings
1. **Critical In-Transit TLS Bypass (`rejectUnauthorized: false`):** In `app/app/lib/db.ts`, the database client initializes SSL with `{ rejectUnauthorized: false }`. This setting disables TLS certificate authority (CA) chain verification, exposing all database traffic between the EC2 web instances and Amazon RDS to Man-in-the-Middle (MITM) inspection and tampering. Furthermore, the RDS CloudFormation resource lacks a custom `DBParameterGroup` enforcing `rds.force_ssl = 1`.
2. **Database Schema & Migration Pipeline Blind Spot (Day-1 Production Outage):** The project contains no database migration framework (no Prisma, Drizzle, Flyway, or automated SQL runner). Schema DDL is present solely in `/app/app/seed/route.ts`, which explicitly rejects production execution (`NODE_ENV === 'production' -> 403 Forbidden`). Consequently, a clean production deployment provisions an empty database with **zero tables**, while application query handlers catch errors and silently serve mock data, concealing a total database failure.
3. **Hardcoded Fallbacks & Authentication Bypass Backdoor:** Source code contains hardcoded fallback credentials (`postgres://postgres:postgres@127.0.0.1:5432/postgres` in `db.ts`) and a built-in authentication bypass backdoor (`user@nextmail.com` / `123456` in `placeholder-data.ts` and `auth.ts`) validating unauthenticated logins when the database is empty or offline.
4. **Secret Management & Container Injection Gaps:** EC2 UserData bootstrap retrieves RDS credentials from AWS Secrets Manager and writes them to `/etc/react-webapp.env`, but completely omits NextAuth's mandatory session encryption key (`AUTH_SECRET`), causing NextAuth runtime authentication failures in production. No `.env.example` file exists.
5. **Connection Pooling & ASG Scaling Headroom:** The application configures a client pool size of `max: 10` per web instance. Under peak production load (scaling up to 6 ASG instances), active connections reach 60+. On smaller instance classes (`db.t3.micro` dev), this nears the default PostgreSQL connection ceiling (~80–100), highlighting the need for connection budgeting and AWS RDS Proxy integration.
6. **Stale Documentation & Template Copy-Paste Defects:** CloudFormation resource descriptions, parameter documentation, and operational guides copy-pasted from MySQL stacks repeatedly refer to RDS MySQL, including recommending MySQL commands and variable names instead of PostgreSQL 16.

---

## 2. Architectural Context & Component Topology

### 2.1 Component Architecture Diagram

```
                                      [ Internet Clients ]
                                                │
                                                │ HTTPS (Port 443)
                                                ▼
                           ┌─────────────────────────────────────────┐
                           │      Amazon CloudFront CDN Edge         │
                           │   - ViewerProtocolPolicy: redirect-to-https
                           │   - X-CloudFront-Origin-Verify Header   │
                           │   - Cache /_next/static/* & /static/*   │
                           └────────────────────┬────────────────────┘
                                                │
                                                │ HTTP (Port 80)
                                                ▼
┌────────────────────────────────── AWS Virtual Private Cloud (VPC: 10.0.0.0/16) ──────────────────────────────────┐
│                                                                                                                  │
│  ┌────────────────────── Public Subnet 1 (10.0.1.0/24) ──┐  ┌────────────────────── Public Subnet 2 (10.0.2.0/24) ──┐  │
│  │                                                       │  │                                                       │  │
│  │               ┌───────────────────────────────────────┴──┴───────────────────────────────────────┐               │  │
│  │               │              Internet-Facing Application Load Balancer (ALB)                     │               │  │
│  │               │  - Port 80 Listener (Redirects to 443 if Cert; 403 Forbidden without Header)     │               │  │
│  │               │  - Port 443 Listener (Validates Origin Header -> Forwards to ALBTargetGroup)     │               │  │
│  │               └───────────────────────────────────────┬──────────────────────────────────────────┘               │  │
│  └───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘  │
│                                                          │ Forward Port 80 (WebSecurityGroup)                           │
│                                                          ▼                                                              │
│  ┌───────────────────── Private Subnet 1 (10.0.10.0/24) ─┴──┐  ┌───────────────────── Private Subnet 2 (10.0.11.0/24) ───┐  │
│  │                                                          │  │                                                       │  │
│  │   ┌──────────────────────────────────────────────────┐   │  │   ┌───────────────────────────────────────────────┐   │  │
│  │   │        Auto Scaling Group Web Instance 1         │   │  │   │        Auto Scaling Group Web Instance 2      │   │  │
│  │   │  - AL2023 EC2 (t3.micro dev / t3.small prod)     │   │  │   │  - AL2023 EC2 (t3.micro dev / t3.small prod)  │   │  │
│  │   │  - Docker Container: `react-webapp` (Port 80)    │   │  │   │  - Docker Container: `react-webapp` (Port 80) │   │  │
│  │   │  - Next.js 14 App Router (Node 20 Alpine)        │   │  │   │  - Next.js 14 App Router (Node 20 Alpine)     │   │  │
│  │   │  - Env: `/etc/react-webapp.env` (Missing AuthKey)│   │  │   │  - Env: `/etc/react-webapp.env` (Missing Auth)│   │  │
│  │   └────────────────────────┬─────────────────────────┘   │  │   └───────────────────────┬───────────────────────┘   │  │
│  │                            │                             │  │                           │                           │  │
│  │                            └──────────────────────────┐  │  │  ┌────────────────────────┘                           │  │
│  │                                                       │  │  │  │                                                    │  │
│  │                                                       ▼  ▼  ▼  ▼                                                    │  │
│  │                                       PostgreSQL 5432 with TLS (sslmode=require)                                    │  │
│  │                         [SECURITY DEFECT: App sets rejectUnauthorized: false -> MITM Risk]                         │  │
│  │                                                       │                                                             │  │
│  │                                                       ▼                                                             │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                 AWS Managed Amazon RDS PostgreSQL 16 (`AWS::RDS::DBInstance`)                               │   │  │
│  │   │  - Engine: postgres 16.9, InstanceClass: db.t3.micro dev / db.t3.small prod                                │   │  │
│  │   │  - Multi-AZ Deployment enabled in prod (Synchronous standby replica in Private Subnet 2)                    │   │  │
│  │   │  - StorageEncrypted: true (AWS KMS aws/rds)                                                                 │   │  │
│  │   │  - Automated Backups: 7-day retention, Continuous WAL archiving, Point-In-Time Restore (PITR)                │   │  │
│  │   │  - Route 53 Managed CNAME Endpoint (`!GetAtt RDSInstance.Endpoint.Address`)                                 │   │  │
│  │   │  - [INFRASTRUCTURE DEFECT]: Lacks custom DBParameterGroup enforcing `rds.force_ssl = 1`                     │   │  │
│  │   │  - [SCHEMA GAP]: Database launches with ZERO tables (seed disabled in production, no migrations)            │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                                                     │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │ VPC Interface Endpoints: `ecr.api`, `ecr.dkr`, `s3`, `logs`, `secretsmanager`, `ssm`, `ssmmessages`         │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component & Resource Inventory

| Logical Resource | CloudFormation Type | Physical Architecture & Configuration | Purpose & Status |
| :--- | :--- | :--- | :--- |
| `RDSInstance` | `AWS::RDS::DBInstance` | PostgreSQL 16.9, Multi-AZ prod, StorageEncrypted | AWS Managed Relational Database |
| `RDSSecret` | `AWS::SecretsManager::Secret` | `${EnvironmentName}-rds-postgres-credentials` | RDS Master credentials generator |
| `DBSubnetGroup` | `AWS::RDS::DBSubnetGroup` | Spans `PrivateSubnet1` and `PrivateSubnet2` | Subnet isolation for RDS instances |
| `WebLaunchTemplate` | `AWS::EC2::LaunchTemplate` | AL2023, IMDSv2 required, dynamic RDS endpoint | Web tier compute blueprint |
| `WebAutoScalingGroup` | `AWS::AutoScaling::AutoScalingGroup` | Min: 1 (dev) / 2 (prod), Max: 2 (dev) / 6 (prod) | Compute elasticity & rolling updates |
| `ApplicationLoadBalancer` | `AWS::ElasticLoadBalancingV2::LoadBalancer` | Internet-facing ALB in Public Subnets 1 & 2 | Ingress reverse proxy |
| `ALBTargetGroup` | `AWS::ElasticLoadBalancingV2::TargetGroup` | Target: ASG port 80, Health: `/api/health` | Web instance routing pool |
| `CloudFrontDistribution` | `AWS::CloudFront::Distribution` | CDN distribution, PriceClass 200 | Edge caching & TLS termination |
| `ALBSecurityGroup` | `AWS::EC2::SecurityGroup` | Ports 80 & 443 inbound from `0.0.0.0/0` | Ingress filtering |
| `WebSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 80 restricted to `ALBSecurityGroup` | Web instance boundary |
| `DatabaseSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 5432 restricted to `WebSecurityGroup` | RDS network boundary |
| `EC2SSMRole` | `AWS::IAM::Role` | SSM, ECR, CloudWatch, SecretsManager read | Web instance IAM profile |

---

## 3. Comprehensive Security Findings & Vulnerability Matrix

| Finding ID | Severity | CVSS v3.1 | CWE ID | Affected Files & Lines | Short Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | 8.6 | CWE-798 | `app/app/lib/db.ts:4–7` | Insecure hardcoded fallback connection string with plaintext credentials |
| **SEC-02** | **CRITICAL** | 8.1 | CWE-295 / CWE-319 | `app/app/lib/db.ts:12–18`<br>`infra/modules/app.yaml:134–164` | TLS certificate validation disabled (`rejectUnauthorized: false`) and missing `force_ssl` |
| **SEC-03** | **HIGH** | 7.7 | CWE-287 / CWE-798 | `app/app/lib/placeholder-data.ts:3–10`<br>`app/auth.ts:20–28` | Authentication bypass backdoor validating mock credentials on DB failure |
| **SEC-04** | **HIGH** | 7.5 | CWE-312 / CWE-330 | `infra/modules/app.yaml:334–345`<br>`app/auth.ts:35` | Missing `AUTH_SECRET` container injection breaking session encryption |
| **SEC-05** | **HIGH** | 7.2 | CWE-657 / CWE-404 | Architecture / `app/app/seed/route.ts` | Zero schema migrations; production DB has no tables, silently serving mocks |
| **SEC-06** | **MEDIUM** | 5.3 | CWE-476 | `app/app/seed/route.ts:5`<br>`app/app/query/route.ts:3` | Non-null assertion on missing env variable triggers unhandled module crash |
| **SEC-07** | **MEDIUM** | 4.8 | CWE-330 | `infra/modules/app.yaml:243, 276, 443` | Predictable ALB origin verification header derived from AWS Account ID |
| **SEC-08** | **MEDIUM** | 4.3 | CWE-1188 | Repository Root / `app/` | Absence of `.env.example` template for configuration contracts |
| **SEC-09** | **MEDIUM** | 4.0 | CWE-400 | `app/app/lib/db.ts:17`<br>`infra/modules/app.yaml:141, 375` | Potential RDS connection exhaustion under peak ASG scaling without RDS Proxy |
| **SEC-10** | **LOW** | 3.3 | CWE-1059 | `infra/modules/app.yaml:2`<br>`docs/operations-guide.md:1, 74` | Copy-paste documentation defects referring to RDS MySQL |

---

### Deep-Dive Analysis of Vulnerabilities

#### Finding SEC-01: Hardcoded Insecure Fallback Database Connection String
- **Severity:** **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N — Score: 8.6)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-259 (Use of Hard-coded Password)
- **Affected Location:** `option-4-web-ec2-db-rds/app/app/lib/db.ts`, Lines 4–7:
  ```typescript
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  ```
- **Technical Description:** Fallback connection string exposes default credentials (`postgres:postgres`) targeting localhost. If environment variables are missing, the client fails to connect to RDS and attempts to connect locally.
- **Remediation:** Remove fallback connection strings completely. Require `POSTGRES_URL` or `DATABASE_URL` at runtime.

---

#### Finding SEC-02: TLS Certificate Verification Disabled (`rejectUnauthorized: false`) & Missing `force_ssl`
- **Severity:** **CRITICAL** (CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N — Score: 8.1)
- **CWE:** CWE-295 (Improper Certificate Validation), CWE-319 (Cleartext Transmission of Sensitive Information)
- **Affected Locations:**
  - `app/app/lib/db.ts`, Lines 12–18:
    ```typescript
    const isSsl = connectionString.includes('sslmode=require');
    sqlClient = postgres(connectionString, {
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      connect_timeout: 5,
      idle_timeout: 10,
      max: 10,
    });
    ```
  - `infra/modules/app.yaml`, Lines 134–164 (`AWS::RDS::DBInstance` resource).
- **Technical Description:**
  1. Although the connection string generated by UserData includes `?sslmode=require`, `db.ts` passes `ssl: { rejectUnauthorized: false }` to the `postgres.js` driver.
  2. Disabling `rejectUnauthorized` disables validation of the TLS certificate chain, hostname verification, and validity dates against the trust store.
  3. An adversary positioned on the local network or VPC (e.g. via ARP spoofing, rogue DNS, or compromised node) can present an arbitrary self-signed certificate, successfully intercepting or modifying all database traffic, credentials, and financial queries.
  4. In the CloudFormation infrastructure, `RDSInstance` does not reference a custom `AWS::RDS::DBParameterGroup` enforcing `rds.force_ssl = 1`. Unencrypted connections are permitted by RDS if a client connects without SSL.
- **Security Impact:** Man-in-the-Middle (MITM) compromise of database traffic; failure of AWS Foundational Security Best Practices and PCI-DSS compliance.
- **Remediation:**
  1. In `app/app/lib/db.ts`, eliminate `{ rejectUnauthorized: false }`. Provide the AWS RDS Root CA bundle (Amazon Root CA 1) or configure standard TLS verification.
  2. In `infra/modules/app.yaml`, create an `AWS::RDS::DBParameterGroup` setting `rds.force_ssl = 1` and attach it to `RDSInstance`.

---

#### Finding SEC-03: Hardcoded Plaintext User Credentials with Auth Bypass Backdoor
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N — Score: 7.7)
- **CWE:** CWE-287 (Improper Authentication), CWE-798 (Use of Hard-coded Credentials)
- **Affected Locations:**
  - `app/app/lib/placeholder-data.ts`, Lines 3–10 (`user@nextmail.com` / `123456`)
  - `app/auth.ts`, Lines 20–28:
    ```typescript
    const found = placeholderUsers.find((u) => u.email === email);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        email: found.email,
        password: await bcrypt.hash(found.password, 10),
      };
    }
    ```
- **Technical Description:** When database queries fail (which occurs continuously on day 1 because no tables exist in RDS), `getUser(email)` falls back to `placeholderUsers`. Any user supplying `user@nextmail.com` and `123456` is granted full administrative dashboard access.
- **Security Impact:** Backdoor administrative login in production.
- **Remediation:** Remove fallback lines 20–28 in `app/auth.ts`. Return `null` if user is not in database.

---

#### Finding SEC-04: Missing `AUTH_SECRET` Container Injection
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.5)
- **CWE:** CWE-312 (Cleartext Storage of Sensitive Information), CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:**
  - `infra/modules/app.yaml`, Lines 334–345.
  - `app/auth.ts`, Line 35: `secret: process.env.AUTH_SECRET`.
- **Technical Description:** UserData writes RDS database credentials into `/etc/react-webapp.env` but omits `AUTH_SECRET`. NextAuth fails in production with `MissingSecret` upon receiving authentication requests.
- **Remediation:** Create an `AWS::SecretsManager::Secret` for `${EnvironmentName}-web-auth-secret` (32-byte hex string) and write `AUTH_SECRET` into `/etc/react-webapp.env`.

---

#### Finding SEC-05: Production Outage on Launch (Zero Tables, Disabled Seed, No Migrations)
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H — Score: 7.2)
- **CWE:** CWE-657 (Violation of Secure Design Principles), CWE-404 (Improper Resource Shutdown or Release)
- **Affected Locations:** `app/app/seed/route.ts:105–110`, `app/app/lib/data.ts:18, 40`.
- **Technical Description:**
  1. The repository provides no schema migration tool (no Prisma, Drizzle, Flyway, Knex, or raw SQL script).
  2. Table definitions exist only in `/api/seed`, which returns `403 Forbidden` in production.
  3. Consequently, upon initial deployment, the RDS PostgreSQL database contains zero tables.
  4. All queries fail. However, `app/app/lib/data.ts` catches database errors and serves mock data, concealing the complete absence of a database from operators.
  5. Any mutation (e.g. creating an invoice) throws an unhandled database error.
- **Remediation:** Implement an automated migration runner executing during deployment or EC2 boot that idempotently creates tables and constraints before starting the web application.

---

#### Finding SEC-06: Non-Null Assertion Crash Risk on Seed and Query Routes
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:M — Score: 5.3)
- **CWE:** CWE-476 (NULL Pointer Dereference)
- **Affected Locations:** `app/app/seed/route.ts:5`, `app/app/query/route.ts:3`.
- **Technical Description:** `postgres(process.env.POSTGRES_URL!, ...)` crashes route module loading if `POSTGRES_URL` is undefined.
- **Remediation:** Remove top-level client instantiation or validate configuration prior to invocation.

---

#### Finding SEC-07: Predictable ALB Origin Verification Header
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N — Score: 4.8)
- **CWE:** CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:** `infra/modules/app.yaml`, Lines 243, 276, 443.
- **Technical Description:** Deterministic header `${EnvironmentName}-secure-origin-${AWS::AccountId}` allows origin bypass if Account ID is known.
- **Remediation:** Store high-entropy secret in AWS Secrets Manager.

---

#### Finding SEC-08: Missing `.env.example` Template
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N — Score: 4.3)
- **CWE:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Location:** Repository Root and `app/`.
- **Technical Description:** Lacks `.env.example` documenting `AUTH_SECRET`, `POSTGRES_URL`, `DATABASE_URL`, `APP_ENV`, `PORT`.
- **Remediation:** Create `app/.env.example`.

---

#### Finding SEC-09: Potential Database Connection Exhaustion under ASG Scaling
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:M — Score: 4.0)
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Affected Locations:** `app/app/lib/db.ts:17`, `infra/modules/app.yaml:141, 375`.
- **Technical Description:** Client pool in `postgres.js` sets `max: 10`. When the ASG scales up to 6 instances in prod, connection demand reaches 60 connections. The `db.t3.micro` instance class defaults to ~80-100 max connections. Traffic spikes risk connection pool exhaustion.
- **Remediation:** Tune connection pool size (`max: 5`) or integrate AWS RDS Proxy in front of PostgreSQL.

---

#### Finding SEC-10: Documentation & Metadata Defects Referencing RDS MySQL
- **Severity:** **LOW** (CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N — Score: 3.3)
- **CWE:** CWE-1059 (Incomplete Documentation)
- **Affected Locations:**
  - `infra/modules/app.yaml:2`: `Description: '... AWS Managed RDS MySQL'`.
  - `docs/operations-guide.md:1`: Title reads `# Operations & Usage Guide - Option 4: Web ASG EC2 + Managed RDS MySQL (Recommended)`.
  - `docs/operations-guide.md:74`: Script uses `DB_INSTANCE_IDENTIFIER="dev-app-mysqldb"`.
  - `docs/deployment-guide.md:52`: References `Master administrator password for RDS MySQL`.
- **Technical Description:** Stale copy-pasted documentation creates operational errors during maintenance and troubleshooting.
- **Remediation:** Update documentation to reflect PostgreSQL 16 RDS.

---

## 4. Infrastructure Security & AWS Well-Architected Review

### 4.1 RDS Managed Architecture & Resilience Evaluation
- **High Availability & Failover:**
  - In production (`prod.json`), `MultiAZ: true` is configured. Amazon RDS synchronously replicates data to a standby instance in `PrivateSubnet2` and automatically performs failover in under 60 seconds if the primary AZ fails.
- **Backup & Recovery:**
  - `BackupRetentionPeriod: 7` days. Continuous transaction logging (WAL) supports Point-In-Time Restore (PITR) to any second within the retention window.
  - `DeletionPolicy: Snapshot` and `DeletionProtection: true` in production protect against accidental database deletion.
- **Dynamic CNAME Endpoint:**
  - Web instances connect to `!GetAtt RDSInstance.Endpoint.Address` via Route 53 managed RDS DNS, completely decoupling compute from database IP addresses.

### 4.2 IAM Roles & Instance Profiles (`infra/modules/iam-roles.yaml`)
- **Broad Wildcard Secret Access:**
  ```yaml
  Resource: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:${EnvironmentName}-*'
  ```
  Grants access to all secrets in the environment. Should be scoped to specific secret ARNs.
- **Missing KMS & Parameter Store Actions:**
  Lacks `kms:Decrypt` for Customer Managed Keys and `ssm:GetParameter*` for Parameter Store.

### 4.3 Storage & Transit Cryptography
- **Storage Encryption:**
  - Both EBS volumes and RDS instances enable storage encryption (`StorageEncrypted: true`).
  - Uses AWS default managed keys (`aws/ebs`, `aws/rds`). Enterprise production environments should transition to Customer Managed KMS Keys (CMK) with automated annual rotation.
- **CloudFront to ALB Transit:**
  - CloudFront `CustomOriginConfig` specifies `OriginProtocolPolicy: http-only` on port 80. Edge-to-origin transit across the AWS network is unencrypted.

### 4.4 Monitoring & Observability
- **Existing Alarms:**
  - `ALB5XXAlarm`: Triggers on `HTTPCode_Target_5XX_Count > 10`.
  - `HighCPUAlarm`: Triggers on Web ASG `CPUUtilization > 85%`.
  - `RDSHighCPUAlarm`: Triggers on RDS `CPUUtilization > 85%`.
  - `RDSStorageAlarm`: Triggers on RDS `FreeStorageSpace <= 5GB`.
- **Missing Alarms:**
  - `RDSConnectionAlarm`: Triggers when `DatabaseConnections > 70` to warn before connection starvation.
  - `RDSFreeableMemoryAlarm`: Alerts on low memory.
  - ALB Target Response Time and Unhealthy Host Count.

---

## 5. Application Security & Code Quality Review

### 5.1 Build Configuration & TypeScript Masking (`app/next.config.js`)
- `next.config.js` sets `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`.
- **Remediation:** Remove build error suppression and ensure `npm run build` passes cleanly.

### 5.2 Automated Testing Gaps (`test/test_api.js`)
- Trivial assertion `1 + 1 === 2`. Lacks database connectivity tests, SSL flag verification, and schema validation.

### 5.3 Health Check Shallow Probe (`app/app/api/health/route.ts`)
- Returns HTTP 200 without testing RDS reachability. If RDS crashes or network connectivity is severed, `/api/health` continues returning HTTP 200, preventing ALB from rerouting traffic.

---

## 6. Architecture-Specific Deep Dive: Managed RDS PostgreSQL Integration

Option 4 represents the target production state for multi-tier web applications on AWS. To achieve production readiness:

### 6.1 Enforce SSL/TLS at Database Tier
1. **CloudFormation Parameter Group:**
   Add an `AWS::RDS::DBParameterGroup` to `infra/modules/app.yaml`:
   ```yaml
   RDSParameterGroup:
     Type: AWS::RDS::DBParameterGroup
     Properties:
       Description: Enforce SSL for PostgreSQL RDS
       Family: postgres16
       Parameters:
         rds.force_ssl: '1'
       Tags:
         - Key: Name
           Value: !Sub '${EnvironmentName}-rds-params'
   ```
   Reference `DBParameterGroupName: !Ref RDSParameterGroup` in `RDSInstance`.
2. **Strict Certificate Authority Verification in Node.js:**
   In `app/app/lib/db.ts`:
   - Download the AWS Global Root CA bundle (`global-bundle.pem`).
   - Configure TLS options to verify server certificates against the Amazon CA bundle rather than setting `rejectUnauthorized: false`.

### 6.2 Implement Automated Schema Migrations
1. Add a migration script (`migrate.js` or SQL migration runner) in `app/migrations/`.
2. Execute migrations during deployment or container entrypoint before starting the Next.js server.
3. Validate that tables `users`, `invoices`, `customers`, and `revenue` exist upon application launch.

---

## 7. Actionable Step-by-Step Remediation Roadmap

### Phase 1: Critical Security & Secret Management (Immediate)
1. **Eradicate Fallback PostgreSQL String:** Remove `'postgres://postgres:postgres@...'` from `db.ts`.
2. **Remove Authentication Backdoor:** Delete lines 20–28 in `app/auth.ts`.
3. **Dynamic NextAuth Secret:**
   - Add `AWS::SecretsManager::Secret` for `${EnvironmentName}-web-auth-secret`.
   - Update IAM policies and inject `AUTH_SECRET` into `/etc/react-webapp.env`.
4. **Create `.env.example`:** Document `AUTH_SECRET`, `POSTGRES_URL`, `DATABASE_URL`, `APP_ENV`, `PORT`.

### Phase 2: Enforce Database SSL/TLS & CA Verification (High Priority)
1. **Enforce `rds.force_ssl = 1`:**
   Add `RDSParameterGroup` in `infra/modules/app.yaml` setting `rds.force_ssl: '1'`.
2. **Remove `rejectUnauthorized: false`:**
   Update `app/app/lib/db.ts` to enforce strict CA certificate verification against the AWS Root CA bundle.

### Phase 3: Database Schema Migration & Documentation Fixes (Medium Priority)
1. **Automated Database Schema Migration:**
   Provide migration runner initializing tables during deployment.
2. **Correct MySQL Metadata & Documentation:**
   Replace all references to MySQL in `app.yaml`, `README.md`, and operations guides with PostgreSQL 16.

### Phase 4: Code Quality & Observability (Low Priority)
1. **Enforce Strict TypeScript Compilation:**
   Remove `ignoreBuildErrors: true` from `next.config.js`.
2. **Deep Health Check:**
   Update `/api/health` to execute `SELECT 1` against RDS, returning HTTP 503 if unreachable.
3. **CloudWatch Alarms:**
   Add alarms for RDS database connection count and ALB target response time.

---

## 8. AWS Well-Architected Framework Compliance Scorecard

| Pillar | Rating | Baseline Findings | Target Status Post-Remediation |
| :--- | :---: | :--- | :--- |
| **Security** | **FAIL** | `rejectUnauthorized: false` in `db.ts`, missing `rds.force_ssl = 1`, hardcoded fallback in `db.ts`, auth backdoor in `auth.ts`, missing `AUTH_SECRET`. | **PASS**: Strict TLS certificate verification, `rds.force_ssl = 1`, dynamic Secrets Manager retrieval, zero hardcoded credentials. |
| **Reliability** | **FAIL** | Zero schema migrations causing day-1 production empty DB outage; Multi-AZ RDS configured but app served mocks silently. | **PASS**: Automated schema migrations, Multi-AZ automated failover, PITR backup retention, verified database tables. |
| **Performance Efficiency** | **PASS** | Managed RDS offloads compute; Multi-AZ standby handles failover; connection pooling configured. | **PASS**: High-performance multi-tier architecture. |
| **Cost Optimization** | **PASS** | Auto-scaling web tier (2–6 instances in prod); right-sized RDS instances (`db.t3.small` in prod); GP3 storage. | **PASS**: Optimal cost-to-performance ratio. |
| **Operational Excellence** | **FAIL** | Stale MySQL documentation; suppressed TypeScript build errors in `next.config.js`; no automated migration pipeline. | **PASS**: Accurate PostgreSQL documentation, strict `tsc` compilation, automated schema initialization. |

---

## 9. Verification & Audit Attestation

This audit was conducted by inspecting CloudFormation templates (`infra/modules/*.yaml`), application source code (`app/**/*`), container definitions (`app/Dockerfile`), and pipeline workflows (`.github/workflows/*.yml`) in repository `option-4-web-ec2-db-rds`.

**Verification Command References:**
- CloudFormation Linting: `cfn-lint infra/modules/*.yaml`
- TypeScript Static Verification: `cd app && npx tsc --noEmit`
- Clean Production Build: `cd app && npm run build`
- Zero-Secret Grep Validation: `grep -rn "postgres://postgres:" .`
