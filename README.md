# Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended)

Independent infrastructure and application source code for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended Architecture)**.

## 1. Architecture Overview
![Architecture](infra/architecture_diagram.png)

### Key Architectural Highlights:
- **CloudFront CDN Edge Caching:** Caches static assets globally, offloading 80–90% of requests from origin servers, lowering TTFB.
- **Application Load Balancer (ALB):** Spans Multi-AZ Public Subnets, balancing incoming HTTP/HTTPS traffic with health probes on `/api/health`.
- **Web Auto Scaling Group (ASG):** Resides securely within Private Subnets, automatically scaling EC2 instances based on CPU utilization.
- **AWS Managed RDS PostgreSQL (Multi-AZ):** Fully managed relational database located in Private Subnets with automated backups, storage encryption, and automated failover.
- **AWS Secrets Manager Integration:** Zero hardcoded plaintext database passwords; credentials securely rotated and dynamically supplied to compute tiers.
- **AWS-Native Custom Domain:** Directs user traffic via DNS CNAME directly to CloudFront & ALB endpoints.

## 2. Cost Analysis

> 💡 **Verified via Infracost CLI:** Cost calculations derived directly from CloudFormation templates using `infracost scan ./infra/modules`.

### A. Component Cost Breakdown (Infracost CLI Verified)
| CloudFormation Module / Component | AWS Resource Type | Monthly Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **AWS Managed RDS PostgreSQL** | `AWS::RDS::DBInstance` (`db.t3.micro` + 20GB gp3) | **$31.42** | Managed engine, automated backups & storage |
| **Application Load Balancer (ALB)** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | **$16.43** | Multi-AZ load balancer and SSL/TLS routing |
| **Web Compute (Auto Scaling Group)** | `AWS::AutoScaling::AutoScalingGroup` (`t3.micro`) | **$9.49** | Stateless web application compute tier |
| **Secrets & Operational Monitoring** | `SecretsManager`, `CloudWatch`, `SNS` | **$0.36** | Dual Secrets (RDS + App) and multi-tier alarms |
| **Subtotal (Production HA Application Tier)** | `infra/modules/app.yaml` | **$57.70 / mo** | ~1,460,000 VND / month |
| **Private VPC Interface Endpoints (Optional)** | `AWS::EC2::VPCEndpoint` (7 endpoints) | **$102.20** | SSM, ECR, CloudWatch Logs in Private Subnets |
| **Total (Full Enterprise Isolated Architecture)** | `infra/modules/` | **$159.90 / mo** | ~4,045,000 VND / month |

### B. Cost by Purchasing Option & Architecture Mode
| Purchasing Model / Mode | Web Compute | RDS Managed DB | ALB & Support | Total (Lean Mode)* | Total (Full Isolated) | Approx. Local Currency (Lean) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $9.49 | $31.42 | $16.79 | **$57.70 / mo** | **$159.90 / mo** | ~1,460,000 VND |
| **1-Year Savings Plan / RI** | $5.98 | $22.62 | $16.79 | **$45.39 / mo** *(21% off)* | **$147.59 / mo** | ~1,149,000 VND |
| **3-Year Savings Plan / RI** | $3.79 | $16.02 | $16.79 | **$36.60 / mo** *(37% off)* | **$138.80 / mo** | ~927,000 VND |
| **Production Scale (`db.t3.small` Multi-AZ)** | $18.98 | $62.84 | $16.79 | **$98.61 / mo** | **$200.81 / mo** | ~2,495,000 VND |

*\*Lean Mode: Compute + ALB + CloudFront routing without dedicated VPC Interface Endpoints ($102.20/mo).*

## 3. Disaster Recovery & Recovery Time (MTTR)

Tested and verified under real AWS Chaos Engineering scenarios:

| Failure Scenario | Recovery Mechanism | Measured Recovery Time (MTTR) | Resilience & Telemetry |
| :--- | :--- | :--- | :--- |
| **AWS RDS Managed Database Force Reboot** | Connection pool auto-retry + Graceful 503 | **22s** (reconnect) / **56s** (available) | Process uptime intact; clean HTTP 503 |
| **RDS Network Ingress Isolation (Port 5432 Block)** | Security Group Ingress re-authorization | **4 seconds** | Fast TLS connection recovery |
| **EC2 Web Instance Termination** | Web ASG auto-replacement in Private Subnets | **140 seconds** | RDS database completely unaffected |
| **Target Response Latency & RDS Telemetry** | CloudWatch Metrics (`dev-postgres-rds`) | **8.8ms** avg latency | Steady state CPU: 4.8%–7.0%, freeable RAM: ~210MB |

## 4. Application Screenshots

| Development Environment (`opt4-dev.png261.dev`) | Production Environment (`opt4.png261.dev`) |
| :---: | :---: |
| ![Development Environment](docs/screenshots/dev_screenshot.png) | ![Production Environment](docs/screenshots/prod_screenshot.png) |
