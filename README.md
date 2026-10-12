# Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended)

Independent infrastructure and application source code for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended Architecture) with AWS NAT Gateway**.

## 1. Architecture Overview
![Architecture](infra/architecture_diagram.png)

## 2. Cost Analysis

> 💡 **Verified via Infracost CLI:** Cost calculations derived directly from CloudFormation templates using `infracost scan ./infra/modules`.

### A. Component Cost Breakdown (Infracost CLI Verified)
| CloudFormation Module / Component | AWS Resource Type | Monthly Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **AWS NAT Gateway** | `AWS::EC2::NatGateway` | **$32.85** | Managed NAT Gateway in Public Subnet (0.0.0.0/0 egress) |
| **AWS Managed RDS PostgreSQL** | `AWS::RDS::DBInstance` (`db.t3.micro` + 20GB gp3) | **$31.42** | Managed engine, automated backups & storage |
| **Application Load Balancer (ALB)** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | **$16.43** | Multi-AZ load balancer and SSL/TLS routing |
| **Web Compute (Auto Scaling Group)** | `AWS::AutoScaling::AutoScalingGroup` (`t3.micro`) | **$9.49** | Stateless web application compute tier |
| **Secrets & Operational Monitoring** | `SecretsManager`, `CloudWatch`, `SNS` | **$0.36** | Dual Secrets (RDS + App) and multi-tier alarms |
| **Total Monthly Cost** | `infra/modules/` | **$90.55 / mo** | ~2,290,000 VND / month |

*(Saves **$69.35 / month** compared to the previous 7 VPC Interface Endpoints architecture at $102.20/month).*

### B. Cost by Purchasing Option & Commitment
| Purchasing Model | Web Compute | RDS Managed DB | NAT Gateway & ALB | Total Monthly Cost | Approx. Local Currency (VND) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $9.49 | $31.42 | $49.64 | **$90.55 / mo** | ~2,290,000 VND |
| **1-Year Savings Plan / RI** | $5.98 | $22.62 | $49.64 | **$78.24 / mo** *(14% savings)* | ~1,980,000 VND |
| **3-Year Savings Plan / RI** | $3.79 | $16.02 | $49.64 | **$69.45 / mo** *(23% savings)* | ~1,755,000 VND |
| **Production Scale (`db.t3.small` Multi-AZ)** | $18.98 | $62.84 | $49.64 | **$131.46 / mo** | ~3,325,000 VND |

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
