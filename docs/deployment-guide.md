# Deployment Guide - Option 4: Web ASG EC2 + Managed RDS PostgreSQL 16 (Recommended)

This guide provides end-to-end instructions for deploying the production-grade AWS CloudFormation infrastructure and containerized web application for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database**.

---

## 1. Prerequisites

Ensure the following tools and permissions are set up:

- **AWS CLI v2**: Configured with credentials possessing administrative permissions across CloudFormation, EC2, VPC, ELBv2, Auto Scaling, RDS, CloudFront, ECR, SSM, and CloudWatch.
- **Docker Engine**: Docker 24.x+ or Docker Desktop.
- **Node.js**: Node.js 20.x LTS or higher.
- **Python 3**: Python 3.10+ (for environment parameter parsing).
- **cfn-lint** *(optional)*: For CloudFormation template linting (`pip install cfn-lint`).

---

## 2. Infrastructure Code Structure

All CloudFormation files reside under `infra/`:

```text
infra/
├── environments/
│   ├── dev.json             # Environment parameters for Development
│   └── prod.json            # Environment parameters for Production
└── modules/
    ├── vpc-subnets.yaml     # Module 1: VPC, IGW, Public Subnets (2 AZs), Private Subnets (2 AZs)
    ├── security-groups.yaml # Module 2: Security Groups (ALB, Web Tier, and RDS DB Subnet)
    ├── iam-roles.yaml       # Module 3: EC2 IAM Role & Instance Profile (SSM, ECR ReadOnly)
    └── app.yaml             # Module 4: ALB, Web ASG, AWS RDS PostgreSQL 16 Instance, CloudFront
```

---

## 3. Environment Parameter Configuration

Configuration files are located in `infra/environments/dev.json` and `infra/environments/prod.json`.

| Parameter | Dev Value | Prod Value | Description |
| :--- | :--- | :--- | :--- |
| `EnvironmentName` | `dev` | `prod` | Prefix for resource naming and tagging |
| `InstanceType` | `t3.micro` | `t3.small` / `t3.medium` | EC2 instance sizing for Web ASG |
| `DBInstanceClass` | `db.t3.micro` | `db.t4g.small` (Graviton2) | RDS DB instance class |
| `DBMultiAZ` | `false` | `true` | Multi-AZ high availability failover |
| `DBAllocatedStorage`| `20` | `50` | Initial RDS storage in GB (gp3 encrypted) |
| `MinInstances` | `1` | `2` | Minimum Web instances in ASG |
| `MaxInstances` | `2` | `6` | Maximum Web instances in ASG |
| `DesiredInstances` | `1` | `2` | Initial Web instance target count |
| `WebVolumeSize` | `20` | `30` | Root EBS volume size for Web instances (GB) |
| `DBPassword` | *(secure)* | *(secure)* | Dynamic password generated in AWS Secrets Manager for RDS PostgreSQL |
| `LogRetentionDays` | `14` | `30` | CloudWatch log retention period in days |

---

## 4. Automated Deployment via GitHub Actions (CI/CD)

The repository features a modular CI/CD pipeline split into 4 focused GitHub Actions workflows:
- `.github/workflows/ci-app.yml`: Application testing and validation (`test/test_api.js`).
- `.github/workflows/ci-infra.yml`: Infrastructure validation and linting (`cfn-lint`).
- `.github/workflows/build-ecr.yml`: Builds Docker container image and pushes to Amazon ECR.
- `.github/workflows/deploy.yml`: Deploys CloudFormation stacks and triggers instance refresh.

### Required GitHub Repository Secrets (AWS OIDC Only):
Under **Settings** -> **Secrets and variables** -> **Actions**:
- `AWS_ROLE_TO_ASSUME`: IAM Role ARN configured for GitHub Actions OIDC (e.g. `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-deploy-role`).
- `AWS_REGION`: AWS Region (default: `ap-southeast-1`).

### Automated Workflow Pipeline:
1. **Application Testing & CloudFormation Linting:**
   - Validates Next.js code and runs automated API tests.
   - Lints infrastructure templates using `cfn-lint`.
2. **Container Delivery to Amazon ECR:**
   - Builds multi-stage Docker image for Next.js.
   - Pushes image with tag `dev-latest` (on `dev` branch) or `latest` (on `main` branch).
3. **Infrastructure Stacks Deployment:**
   - Triggers GitHub Actions CD (`deploy.yml`) on merge to `main`.
4. **Zero-Downtime Instance Refresh:**
   - Triggers `aws autoscaling start-instance-refresh` to update Web instances progressively while the managed RDS database runs uninterrupted.

---

## 5. Manual Deployment via AWS CLI

### Step 1: Build and Push Docker Image to ECR

```bash
# Set configuration variables
export AWS_REGION="ap-southeast-1"
export ENV="dev" # or prod
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO_NAME="${ENV}-option-4-web-app"
export IMAGE_TAG="dev-latest" # or latest for prod

# Create ECR repository if needed
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION"

# Log in to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build and push container image
cd app
docker build -t "$REPO_NAME:$IMAGE_TAG" .
docker tag "$REPO_NAME:$IMAGE_TAG" "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
docker push "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
cd ..
```

### Step 2: Execute Infrastructure Deployment Stacks via AWS CLI

Deployments are automated via GitHub Actions (`deploy.yml`). If performing manual deployment via AWS CLI:

```bash
cd infra
export ENV="dev" # or prod
export IMAGE_TAG="dev-latest" # or latest

# 1. Network Stack
aws cloudformation deploy --template-file modules/vpc-subnets.yaml --stack-name "${ENV}-network" --parameter-overrides EnvironmentName="$ENV" --region "$AWS_REGION"

# 2. Security Groups Stack
aws cloudformation deploy --template-file modules/security-groups.yaml --stack-name "${ENV}-security-groups" --parameter-overrides EnvironmentName="$ENV" --region "$AWS_REGION"

# 3. IAM Roles Stack
aws cloudformation deploy --template-file modules/iam-roles.yaml --stack-name "${ENV}-iam" --parameter-overrides EnvironmentName="$ENV" --capabilities CAPABILITY_IAM --region "$AWS_REGION"

# 4. Application Compute Stack
aws cloudformation deploy --template-file modules/app.yaml --stack-name "${ENV}-app" --parameter-overrides EnvironmentName="$ENV" ImageTag="$IMAGE_TAG" --capabilities CAPABILITY_IAM --region "$AWS_REGION"
```

The script provisions:
1. `${ENV}-network`: Provisions VPC and Multi-AZ subnets.
2. `${ENV}-security-groups`: Creates ALB SG, Web SG, and RDS DB SG (port 5432 restricted to Web SG).
3. `${ENV}-iam`: Configures EC2 Instance Profile with SSM and ECR read-only roles.
4. `${ENV}-app`: Provisions the AWS Managed RDS PostgreSQL database in the Private DB Subnet Group, launches the Web Auto Scaling Group, ALB, and CloudFront CDN distribution.
5. Displays stack outputs including database endpoint and CloudFront URL.

---

## 6. Custom Domain & DNS Mapping

Obtain the CloudFront domain name from the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name dev-app \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
  --output text
```

In your DNS manager:
- **Record Type:** `CNAME`
- **Host:** `opt4-dev` (or `opt4` for Prod)
- **Target:** `<distribution-id>.cloudfront.net`
- **Proxy Status:** **DNS Only (Grey Cloud ☁️)**

---

## 7. Infrastructure Teardown & Resource Cleanup

To delete all resources cleanly:

```bash
ENV="dev" # or prod

aws cloudformation delete-stack --stack-name "${ENV}-app"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-app"

aws cloudformation delete-stack --stack-name "${ENV}-iam"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-iam"

aws cloudformation delete-stack --stack-name "${ENV}-security-groups"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-security-groups"

aws cloudformation delete-stack --stack-name "${ENV}-network"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-network"

echo "✅ Teardown complete for environment: $ENV"
```
