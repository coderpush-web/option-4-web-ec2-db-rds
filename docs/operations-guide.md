# Operations & Usage Guide - Option 4: Web ASG EC2 + Managed RDS MySQL (Recommended)

This guide covers local development, AWS Managed RDS database operations, automated backups, Point-In-Time Restore (PITR), remote host administration, and troubleshooting for **Option 4: 1 EC2 Web ASG + 1 AWS Managed RDS Database**.

---

## 1. Local Application Development

### Development Environment Setup:
```bash
cd app

# 1. Install Node.js dependencies
npm install

# 2. Run local development server
npm run dev
```

Visit `http://localhost:3000` to interact with the Next.js application.

### Key Endpoints:
- `/`: Main dashboard home view.
- `/dashboard/invoices`: Invoice management interface with filtering, status updates, and creation form.
- `/dashboard/customers`: Customer directory.
- `/api/health`: Health probe endpoint monitored by the ALB Target Group (`200 OK`).

### Running Tests:
```bash
node test/test_api.js
```

---

## 2. AWS Managed RDS Database Administration

In Option 4, the database tier is fully managed by Amazon RDS, eliminating manual OS maintenance, manual database upgrades, and manual storage configuration.

### RDS Connection Information:
Retrieve the database endpoint and port from the CloudFormation stack:
```bash
aws cloudformation describe-stacks \
  --stack-name dev-app \
  --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" \
  --output text
```

- **Port:** `3306`
- **Default Database:** `appdb`
- **Master Username:** `admin` (or parameter configured in `dev.json` / `prod.json`)
- **Encryption:** Storage encrypted with AWS KMS (`aws/rds`).

### Connecting to RDS via a Bastion / SSM Web Instance:
Because RDS is inside Private Subnets with no public accessibility, connect to a Web instance first via SSM:
```bash
# 1. Start SSM session on an active Web EC2 instance
aws ssm start-session --target <WEB_INSTANCE_ID>

# 2. Connect to RDS from the EC2 shell
mysql -h <RDS_ENDPOINT> -P 3306 -u admin -p appdb
```

---

## 3. Automated Backups & Point-In-Time Restore (PITR)

### Automated Daily Snapshots:
Amazon RDS automatically performs daily storage snapshots and captures transaction logs:
- **Backup Retention:** 7 days (Production) / 1 day (Development).
- **Backup Window:** Automatic during non-peak hours.

### Creating an On-Demand Manual RDS Snapshot:
```bash
DB_INSTANCE_IDENTIFIER="dev-app-mysqldb" # Look up in AWS RDS Console or CLI

aws rds create-db-snapshot \
  --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" \
  --db-snapshot-identifier "manual-backup-$(date +%F-%H%M)"
```

### Performing a Point-In-Time Restore (PITR):
To restore the database to any specific minute within the retention period:
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$DB_INSTANCE_IDENTIFIER" \
  --target-db-instance-identifier "restored-db-$(date +%F)" \
  --restore-time "2026-10-10T12:00:00Z"
```

---

## 4. Remote Web Tier Administration via AWS Systems Manager

Administrative shell access to Web EC2 instances is performed securely through **AWS Systems Manager Session Manager**:

### Connect to a Web Instance:
```bash
# 1. List active instances in the Web Auto Scaling Group
aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=dev-opt4-asg" "Name=instance-state-name,Values=running" \
  --query "Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,State.Name]" \
  --output table

# 2. Start SSM interactive shell
aws ssm start-session --target <WEB_INSTANCE_ID>
```

### Useful Management Commands:
```bash
# Check Docker container status
sudo docker ps

# View container runtime logs
sudo docker logs -f $(sudo docker ps -q)

# Test TCP connectivity to RDS endpoint on port 3306
nc -zv <RDS_ENDPOINT> 3306
```

---

## 5. Monitoring & Observability

### A. Centralized CloudWatch Logs
- **Log Group:** `/aws/ec2/dev-opt4` (or `/aws/ec2/prod-opt4`)
- **Retention Period:** 14 days (Dev) / 30 days (Prod)

Stream logs:
```bash
aws logs tail /aws/ec2/dev-opt4 --follow --format short
```

### B. CloudWatch Alarms & RDS Metrics
Option 4 includes automated alerts across both tiers:
1. **ALB 5XX Errors Alarm:** Triggers when ALB 5XX errors exceed 10 in 1 minute.
2. **Web CPU Utilization Alarm:** Triggers when ASG average CPU utilization exceeds 85% for 5 minutes.
3. **RDS CPU Utilization Alarm:** Triggers when RDS MySQL instance CPU utilization exceeds 85% for 5 minutes.
4. **RDS Free Storage Space:** Monitors available disk capacity and triggers auto-expansion before exhaustion.

All alarms notify via **Amazon SNS Topic** (`${EnvironmentName}-ops-alerts`), delivering emails to the operations team.

---

## 6. Troubleshooting & Frequently Encountered Issues

### Issue 1: Web Application Cannot Reach RDS Database
- **Cause:** Security Group ingress rules misconfigured or RDS instance in `modifying`/`rebooting` state.
- **Remediation:**
  1. Verify the RDS Security Group allows port 3306 inbound from the Web Security Group.
  2. Check RDS status: `aws rds describe-db-instances --db-instance-identifier <ID> --query "DBInstances[0].DBInstanceStatus"`.
  3. Verify DNS resolution of the RDS endpoint inside the EC2 instance: `getent hosts <RDS_ENDPOINT>`.

### Issue 2: RDS Storage Space Warning
- **Cause:** Large transaction log files or unindexed tables.
- **Remediation:**
  1. Check `FreeStorageSpace` metric in CloudWatch.
  2. Enable RDS Storage Auto-scaling (or increase `DBAllocatedStorage` in `environments/prod.json`).

### Issue 3: High Latency or RDS Connection Limit Reached
- **Cause:** Web containers opening too many concurrent unpooled connections.
- **Remediation:**
  1. Review connection pool settings in `app/app/lib/db.ts` (`max: 10`, `idle_timeout: 10`).
  2. In high concurrency production environments, consider attaching **AWS RDS Proxy** to pool database connections across auto-scaled EC2 instances.
