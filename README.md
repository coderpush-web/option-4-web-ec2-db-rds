# Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended)

Independent infrastructure and application source code for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database (Recommended Architecture)**.

## 1. Directory Structure (File Structure)
```text
.
├── .github/workflows/
│   ├── ci-app.yml       # CI: Test Application & Build Check
│   ├── ci-infra.yml     # CI: Lint CloudFormation Templates
│   ├── build-ecr.yml    # CD: Build Docker Image & Push to Amazon ECR
│   └── deploy.yml       # CD: Deploy Infrastructure via CloudFormation
├── app/                          # Standalone web application (Next.js / Node.js)
├── docs/                         # Technical documentation (Deployment, Operations, Architecture)
├── infra/                        # AWS CloudFormation Infrastructure-as-Code
│   ├── modules/                  # Modular templates (app.yaml, vpc-subnets.yaml, etc.)
│   ├── environments/             # Environment parameters for dev & prod
│   └── architecture_diagram.png  # Diagram-as-Code architecture diagram
├── test/                         # Automated tests (Unit test & API integration tests)
│   └── test_api.js
└── README.md                     # Technical report, cost matrix, and architectural summary
```

## 2. Multi-Dimension Cost Analysis

### A. Cost by Purchasing Option & Optimization (Singapore Region: `ap-southeast-1`)
| Purchasing Model | Web Compute (EC2) | RDS Managed (MySQL) | Storage, IP & Backup | Total Monthly Cost | Approx. Local Currency (VND) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $15.18 | $23.36 (`db.t4g.small`) | $9.10 | **$47.64 / mo** | ~1,203,000 VND |
| **1-Year Savings Plan / RI** | $9.56 | $16.82 | $9.10 | **$35.48 / mo** *(25% savings)* | ~895,000 VND |
| **3-Year Savings Plan / RI** | $6.06 | $11.92 | $9.10 | **$27.08 / mo** *(43% savings)* | ~684,000 VND |
| **Cost Saver (Using db.t3.micro)** | $15.18 | $20.00 | $9.10 | **$44.28 / mo** | ~1,118,000 VND |

### B. Cross-Region Cost Comparison
- **Singapore (`ap-southeast-1`):** $47.64 / month (Lowest latency to Southeast Asia & Vietnam: ~30ms).
- **US East (`us-east-1`):** $42.15 / month (11.5% cheaper due to lower baseline compute and RDS rates in US regions).

## 3. Architecture Overview
![Architecture](infra/architecture_diagram.png)

```mermaid
flowchart TD
    subgraph Client ["Client Access"]
        Users["Users / Browsers"]
        Domain["Custom Domain (opt4.png261.dev)"]
    end

    subgraph Edge ["Edge Layer"]
        CF["Amazon CloudFront CDN (Cache Static /_next/*)"]
    end

    subgraph AWS_VPC ["AWS VPC (ap-southeast-1)"]
        subgraph Public_Subnets ["Public Subnets (AZ1 & AZ2)"]
            ALB["Application Load Balancer (ALB)"]
            TG["Target Group (Healthcheck: /api/health)"]
        end

        subgraph Private_Subnets ["Private Subnets (AZ1 & AZ2)"]
            subgraph ASG ["Web Auto Scaling Group (Min: 1-2, Max: 4-6)"]
                EC2_1["Web Instance 1<br/>Docker Next.js (Port 80)"]
                EC2_2["Web Instance 2<br/>Docker Next.js (Port 80)"]
            end

            subgraph DB_Tier ["Database Tier (Private Subnets Multi-AZ)"]
                RDS["AWS Managed RDS MySQL 8.0<br/>(Multi-AZ in Prod, Encrypted GP3)"]
            end
        end
    end

    subgraph Management ["Security, Observability & Deployment"]
        SM["AWS Secrets Manager<br/>(Dynamic DB Credentials)"]
        CW_Logs["CloudWatch LogGroup<br/>(14d Dev / 30d Prod)"]
        CW_Alarms["CloudWatch Alarms<br/>(ALB 5XX + Web CPU + RDS Storage + RDS CPU)"]
        SNS["SNS OpsAlertTopic"]
        Email["Ops Alert Email"]
        ECR["Amazon ECR Repository"]
        CI_CD["GitHub Actions CI/CD<br/>(Zero-Downtime Instance Refresh)"]
    end

    Users --> Domain --> CF
    CF -->|Dynamic requests| ALB
    ALB --> TG --> ASG
    ASG -->|SQL Queries (Port 3306)| RDS
    ASG -.->|Resolve Secret| SM
    SM -.->|Manage Master Creds| RDS
    ASG -.->|Logs| CW_Logs
    ASG -.->|Metrics| CW_Alarms
    RDS -.->|Metrics| CW_Alarms
    ALB -.->|Metrics| CW_Alarms
    CW_Alarms --> SNS --> Email
    CI_CD -->|Push Docker Image| ECR
    CI_CD -->|Trigger Instance Refresh| ASG
```

### Key Architectural Highlights:
- **CloudFront CDN Edge Caching:** Caches static assets (`/_next/static/*`, `/static/*`) globally, offloading 80–90% of requests from origin servers, lowering TTFB, and accelerating global page load times.
- **Application Load Balancer (ALB):** Spans Multi-AZ Public Subnets, balancing incoming HTTP/HTTPS traffic with automated health probes on `/api/health`.
- **Web Auto Scaling Group (ASG):** Resides securely within **Private Subnets (AZ1 & AZ2)**, automatically scaling EC2 instances based on CPU utilization (70% target tracking).
- **AWS Managed RDS MySQL (Multi-AZ):** Fully managed relational database located deep within **Private Subnets (AZ1 & AZ2)** with automated daily backups, storage encryption, and automated Multi-AZ failover.
- **AWS Secrets Manager Integration:** Zero hardcoded plaintext database passwords; credentials securely rotated and dynamically supplied to compute tiers.
- **Zero-Downtime Rolling Update:** Integrated `aws autoscaling start-instance-refresh` in CI/CD updates container versions progressively without service downtime.
- **Multi-Tier Monitoring & Alerts:** CloudWatch Alarms (ALB 5XX, Web CPU, RDS Storage, RDS CPU) notify via Amazon SNS Topic; log retention auto-expires after 14 days (Dev) / 30 days (Prod).
- **AWS-Native Custom Domain:** Directs user traffic via DNS CNAME (DNS-only) directly to Amazon CloudFront Edge & ALB endpoints.

## 📸 Application Screenshots (Live Environments: Dev & Prod)

| Development Environment (`opt4-dev.png261.dev`) | Production Environment (`opt4.png261.dev`) |
| :---: | :---: |
| ![Development Environment](screenshots/dev_screenshot.png) | ![Production Environment](screenshots/prod_screenshot.png) |

> 🚀 **Deployment Notes:**
> - **Development (`opt4-dev.png261.dev`):** Debug configuration, Web Auto Scaling Min 1 - Max 2 instances, single-AZ RDS.
> - **Production (`opt4.png261.dev`):** Production optimized, Web Auto Scaling Min 2 - Max 6 instances, Multi-AZ RDS MySQL with automated failover and AWS ACM SSL/HTTPS.

## ⚛️ Web Application & Docker / Amazon ECR Delivery

### 1. Web Application Architecture
- **Application:** Next.js Dashboard & Management Platform.
- **Frontend Stack:** React 18, Next.js App Router, Tailwind CSS, Lucide Icons.
- **Backend & API:** Node.js Next.js Server Components and REST routes.
- **Database:** AWS Managed RDS MySQL 8.0 Multi-AZ in Private Subnet Group.

### 2. Separation of Build and Deployment (Build Once, Deploy Everywhere)
1. **Multi-Stage Docker Build:**
   - **Stage 1 (Builder):** Compiles Next.js frontend code and assets.
   - **Stage 2 (Runner):** Lightweight `node:20-alpine` base image containing only required production runtime files.
2. **Push to Amazon ECR:**
   - Image tagged by environment (`latest` for Prod, `dev-latest` for Dev) and pushed to **Amazon Elastic Container Registry (ECR)**.
3. **Decoupled Deployment:**
   - EC2 instances do not compile code on-box. They pull verified containers from ECR and manage service lifecycles via `systemd`.

## 4. CI/CD Workflow & Branching Strategy
- **`dev`**: Main development branch. Automatically runs unit tests, lints CloudFormation, and pushes dev container images.
- **`main`**: Protected production branch (**Branch Protection Rules** enforce PR reviews). Merging triggers automated production deployment and Web ASG rolling instance refresh.

## 🌐 Custom Domain Configuration (`png261.dev`)

The infrastructure routes traffic for `png261.dev` across both environments:

| Environment | Git Branch | Subdomain | Record Type | Target Destination | Proxy Status |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Development** | `dev` | `opt4-dev.png261.dev` | `CNAME` | `${CloudFrontDistribution.DomainName}` | DNS Only (☁️ Grey Cloud) |
| **Production** | `main` | `opt4.png261.dev` | `CNAME` | `${CloudFrontDistribution.DomainName}` | DNS Only (☁️ Grey Cloud) |

## ☁️ Native AWS CloudFormation Infrastructure Management (No State File)
The entire infrastructure is 100% managed with **AWS CloudFormation Native**:
- **AWS-Managed State:** Resource state is maintained internally by AWS CloudFormation.
- **Zero State File Overhead:** Eliminates state locking conflicts, accidental leaks, and S3/DynamoDB maintenance overhead.
- **Drift Detection:** Enables automated configuration drift detection directly from the AWS Console or AWS CLI.
