# AGENTS.md — Option 4: Hosting 1 Web on EC2 + 1 DB on AWS Managed RDS

## 1. Project Overview
This repository implements **Option 4**: An Enterprise Production Standard architecture hosting a **stateless Web Application on an EC2 Auto Scaling Group** connected to a fully managed **AWS RDS for PostgreSQL 16** database, fronted by an Application Load Balancer and Amazon CloudFront CDN.

This architecture is optimized for production commercial platforms, B2B SaaS, and e-commerce applications requiring high availability, automated point-in-time recovery (PITR), and zero database administration overhead.

---

## 2. Repository Layout
```
option-4-web-ec2-db-rds/
├── app/                          # Next.js 14 application codebase
│   ├── app/                      # Application routes and API handlers
│   ├── app/lib/db.ts             # PostgreSQL client pool with SSL mode
│   ├── Dockerfile                # Multi-stage container build
│   └── package.json              # Dependencies and scripts
├── infra/
│   ├── environments/             # Environment configs (dev.json, prod.json)
│   └── modules/                  # CloudFormation templates
│       ├── vpc-subnets.yaml      # Multi-AZ VPC & DB Subnet Groups
│       ├── security-groups.yaml  # ALB SG, Web SG, and RDS SG definitions
│       └── app.yaml              # Web ASG, AWS RDS PostgreSQL 16, ALB, CloudFront
├── .github/workflows/            # CI/CD pipelines (OIDC deployment, ECR build, lint)
├── .husky/ & .githooks/          # Quality gates: commit-msg, pre-commit, pre-push
├── test/test_api.js              # Automated Node.js API and healthcheck tests
└── AGENTS.md                     # Agent guide for Option 4
```

---

## 3. Essential Commands

### Build & Run
- **Install Dependencies:** `npm install` (root) or `cd app && npm install`
- **Build Container:** `docker build -t nextjs-app:latest app/`
- **Run Application Locally:** `cd app && npm run dev`

### Validation & Quality Gates
- **Run Automated Tests:**
  ```bash
  node test/test_api.js
  ```
- **Lint CloudFormation Templates:**
  ```bash
  cfn-lint infra/modules/*.yaml
  ```
- **Scan IaC Security (Checkov):**
  ```bash
  checkov --config-file .checkov.yaml
  ```
- **Scan for Secrets (GitLeaks):**
  ```bash
  gitleaks protect --staged --verbose
  ```
- **Run All Pre-Commit Checks:**
  ```bash
  ./.husky/pre-commit
  ```

---

## 4. Architecture Requirements to Create

### 4.1. Compute & Web Layer
- **Web EC2 Instance:** 1x EC2 instance (`t4g.small` Graviton ARM) in **App Private Subnets**.
- **Auto Scaling Group (ASG):** Capacity `Min=1, Max=1, Desired=1` tied to ALB Target Group health checks for auto-healing.
- **Bootstrapping:** UserData pulls container from Amazon ECR, retrieves DB credentials securely from AWS SSM Parameter Store, and connects over SSL (`sslmode=require`).
- **Management Access:** Server administration strictly via **AWS Systems Manager (SSM) Session Manager**. Do NOT open SSH port 22 to the internet.

### 4.2. Managed Database Layer (AWS RDS PostgreSQL 16)
- **Engine Version:** AWS RDS for PostgreSQL version 16.x.
- **Storage & Encryption:** Amazon EBS gp3 SSD with Storage Autoscaling and mandatory encryption at rest via AWS KMS (`StorageEncrypted: true`).
- **High Availability & Failover:** Amazon RDS DB Subnet Group spanning across at least 2 Availability Zones. Supports Multi-AZ synchronous standby replication with automatic failover (60–120s).
- **Automated Backups & PITR:** Automated daily backups with continuous transaction log archiving (7 to 35-day retention), enabling Point-In-Time Recovery to any specific second.
- **Protection Policies:** `DeletionProtection: true` and automated final snapshot creation upon deletion.

### 4.3. Network & Security Isolation Layer
- **VPC & Subnets:** Multi-AZ Amazon VPC with Public Subnets (ALB), App Private Subnets (Web EC2), and dedicated DB Private Subnets across 2 AZs.
- **Security Group Chain:**
  - `ALBSecurityGroup`: Ingress port 80/443 from CloudFront/Internet.
  - `WebSecurityGroup`: Ingress port 80 strictly from `ALBSecurityGroup`.
  - `RDSSecurityGroup`: Ingress port 5432 **exclusively from `WebSecurityGroup`**. All internet and load balancer access to the database is denied.
- **Credential Protection:** Database connection string and credentials stored as SecureString in AWS SSM Parameter Store (`/app/prod/database_url`).

### 4.4. Edge & Load Balancing Layer
- **Amazon CloudFront:** Global CDN, HTTPS TLS termination via AWS Certificate Manager (ACM), DDoS protection via AWS Shield Standard, and custom origin header injection (`X-CloudFront-Origin-Verify`).
- **Application Load Balancer (ALB):** Evaluates header `X-CloudFront-Origin-Verify`. Direct traffic bypassing CloudFront is rejected with `HTTP 403 Forbidden`.

---

## 5. Operational Boundaries & Guardrails

### 🛑 Never Do
- **Never Connect to Database Without SSL:** Connections from Web EC2 to RDS must enforce `sslmode=require`.
- **Never Expose RDS Publicly:** `PubliclyAccessible` must be set to `false`.
- **Never Use Static AWS Keys:** GitHub Actions must authenticate solely via AWS IAM OIDC (`secrets.AWS_ROLE_TO_ASSUME`).
- **Never Open Port 22:** Inbound SSH from `0.0.0.0/0` is forbidden.

### ⚠️ Ask First
- Modifying RDS instance class or allocated storage size.
- Changing database backup retention window or maintenance schedule.

### ✅ Always Do
- Follow Conventional Commits format (`type(scope): message`).
- Verify that `test/test_api.js`, `cfn-lint`, `checkov`, and `gitleaks` pass before pushing.

---

## 6. Technical Conventions & Standards
- **Connection Pooling:** Application database client pool configured in `app/app/lib/db.ts` with idle timeout and connection limits.
- **Zero-Downtime Deployment:** GitHub Actions builds image to Amazon ECR and triggers a rolling update on the Web EC2 instances with zero downtime to the database.
- **Security Groups:** All ingress rules must contain explicit `Description` fields.

---

## 7. Definition of Done (Verification Checklist)
Before completing any task in this repository, verify:
1. [ ] `cfn-lint infra/modules/*.yaml` exits with code 0.
2. [ ] `checkov --config-file .checkov.yaml` runs cleanly.
3. [ ] `gitleaks protect --staged --verbose` finds 0 secrets.
4. [ ] `node test/test_api.js` passes all tests.
5. [ ] Workflows contain zero static AWS keys (`! grep -rn --exclude="ci-infra.yml" "AWS_ACCESS_KEY_ID" .github/workflows/`).
6. [ ] Commit message conforms to Conventional Commits hook.
