# Technical Documentation - Option 4: Web ASG EC2 + Managed RDS MySQL (Recommended)

Welcome to the technical documentation for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended Architecture)**.

This `docs/` folder contains comprehensive guides for deploying, operating, and maintaining this enterprise-grade production architecture.

---

## 📚 Documentation Index

1. [Deployment Guide](./deployment-guide.md)
   - Prerequisites & Required Tools
   - Environment Configuration (`dev.json` & `prod.json`)
   - CI/CD Automated Deployment via GitHub Actions
   - Manual Deployment via AWS CLI & `deploy.sh`
   - Custom Domain & DNS Mapping (`png261.dev`)
   - Zero-Downtime Rolling Update (Web ASG Instance Refresh)
   - Teardown & Resource Cleanup

2. [Operations & Usage Guide](./operations-guide.md)
   - Local Development & Testing (`npm run dev`, API tests)
   - AWS Managed RDS Administration & Best Practices
   - Automated Backups, Snapshots & Point-In-Time Restore (PITR)
   - Remote Web Instance Administration via AWS Systems Manager (SSM)
   - Monitoring & Observability (Web & RDS CloudWatch Alarms)
   - Troubleshooting & Frequently Encountered Issues

---

## 🏛️ Architecture Overview

Option 4 represents the AWS Well-Architected recommendation for production workloads, combining elastic stateless web compute with a fully managed database service:

```
[Users / Browsers]
        │
        ▼ (HTTPS / DNS CNAME)
[Amazon CloudFront CDN] ────── (Edge Caching for /_next/static/*)
        │ (Forward Dynamic Requests)
        ▼
[Application Load Balancer (ALB)] ── (Public Subnets AZ1 & AZ2)
        │
        ▼ (Port 80 / Target Group Health Check: /api/health)
[Web Auto Scaling Group (ASG)] ───── (Private Subnets AZ1 & AZ2)
        ├── Web EC2 Instance 1 (Docker Next.js)
        └── Web EC2 Instance 2 (Docker Next.js)
                │
                ▼ (Port 3306 / Encrypted TLS)
[AWS Managed RDS MySQL 8.0] ──────── (DB Subnet Group - Multi-AZ Private)
        ├── Primary DB Instance (AZ1)
        └── Standby Replica (AZ2 - Multi-AZ Failover in Prod)
```

### Key Architectural Highlights:
- **Fully Managed RDS MySQL 8.0:** Automated OS and DB patching, automated daily backups with Point-In-Time Restore (PITR), and Multi-AZ automatic failover in production.
- **Deep Private Subnet Isolation:** Both Web EC2 instances and the RDS cluster reside in Private Subnets. RDS accepts port 3306 traffic exclusively from the Web Security Group.
- **Horizontal Elasticity:** Web ASG dynamically adjusts capacity (min 1–2, max 4–6) across multiple Availability Zones based on target tracking CPU utilization (70%).
- **Amazon CloudFront CDN:** Edge caching globally distributes static assets and accelerates dynamic API requests over AWS global backbone.
- **Zero-Downtime Rolling Deployments:** Rolling instance refreshes update the web application tier with zero downtime and automatic health checks.

---

## ⚡ Quick Start

### 1. Run the Web Application Locally
```bash
cd app
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

### 2. Deploy Infrastructure to Development Environment
```bash
cd infra
chmod +x deploy.sh
./deploy.sh dev
```
