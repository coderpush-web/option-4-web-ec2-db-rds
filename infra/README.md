# Infrastructure Modules - option-4-web-ec2-db-rds

This directory contains standalone AWS CloudFormation modules supporting both **Development (`dev`)** and **Production (`prod`)** environments.

## 1. Module Structure
- `modules/vpc-subnets.yaml`: Provisions VPC, Internet Gateway, 2 Public Subnets (ALB), and 2 Private Subnets (Web ASG and RDS DB Subnet Group across Multi-AZ).
- `modules/security-groups.yaml`: Manages Security Groups for ALB, Web Tier, and RDS MySQL (inbound port 3306 restricted strictly to Web SG).
- `modules/iam-roles.yaml`: Configures EC2 IAM Instance Profile with AWS SSM Session Manager and Amazon ECR ReadOnly access.
- `modules/app.yaml`: Provisions enterprise compute & managed database resources (Web ASG, AWS Managed RDS MySQL 8.0 instance, ALB, CloudFront Distribution).

## 2. Environment Configuration
- `environments/dev.json`: Cost-optimized parameters for Development (t3.micro Web, db.t3.micro RDS, single AZ).
- `environments/prod.json`: High-availability & performance configuration for Production (t3.small/medium Web, Graviton db.t4g.small RDS, Multi-AZ automatic failover).

## 3. Automated CI/CD Deployment
Deployments are fully automated via GitHub Actions (`.github/workflows/deploy.yml`):
- **Production (`prod`)**: Automatically deploys when image build & push completes on `main`.
- **Manual Trigger (`workflow_dispatch`)**: Can be dispatched anytime from the GitHub Actions tab targeting `dev` or `prod`.
