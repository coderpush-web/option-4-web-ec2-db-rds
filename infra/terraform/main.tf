terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # S3 Remote State Backend an toàn & bảo mật
  backend "s3" {
    bucket         = "coderpush-terraform-states-ap-southeast-1"
    key            = "option-4-web-ec2-db-rds/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "coderpush-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-default-x86_64"]
  }
}

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
}

module "security" {
  source      = "./modules/security"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
}

module "iam" {
  source      = "./modules/iam"
  environment = var.environment
}


resource "aws_db_subnet_group" "rds" {
  name        = "${var.environment}-rds-subnet-group"
  subnet_ids  = module.vpc.private_subnet_ids
  description = "Multi-AZ Private DB Subnets"

  tags = {
    Name        = "${var.environment}-rds-subnet-group"
    Environment = var.environment
  }
}

resource "aws_db_instance" "mysql" {
  identifier              = "${var.environment}-mysql-db"
  allocated_storage       = var.rds_allocated_storage
  storage_type            = "gp3"
  engine                  = "mysql"
  engine_version          = "8.0.36"
  instance_class          = var.rds_instance_class
  db_name                 = "appdb"
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.rds.name
  vpc_security_group_ids  = [module.security.db_security_group_id]
  skip_final_snapshot     = true
  storage_encrypted       = true
  copy_tags_to_snapshot   = true
  backup_retention_period = 7

  tags = {
    Name        = "${var.environment}-mysql-db"
    Environment = var.environment
  }
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = module.vpc.public_subnet_id
  vpc_security_group_ids = [module.security.web_security_group_id]
  iam_instance_profile   = module.iam.instance_profile_name

  root_block_device {
    volume_size           = var.web_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name        = "${var.environment}-web-server"
    Environment = var.environment
  }
}

resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"

  tags = {
    Name        = "${var.environment}-web-eip"
    Environment = var.environment
  }
}

output "website_url" {
  value = "http://${aws_eip.web.public_ip}"
}

output "rds_endpoint" {
  value = aws_db_instance.mysql.endpoint
}

