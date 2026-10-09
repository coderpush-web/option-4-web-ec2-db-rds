
variable "aws_region" {
  type        = string
  description = "AWS Deployment Region"
  default     = "ap-southeast-1"
}

variable "environment" {
  type        = string
  description = "Environment name (dev or prod)"
  default     = "prod"
}

variable "ec2_instance_type" {
  type    = string
  default = "t3.small"
}

variable "rds_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "web_volume_size" {
  type    = number
  default = 30
}

variable "rds_allocated_storage" {
  type    = number
  default = 20
}

variable "db_username" {
  type    = string
  default = "appadmin"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "ProdP@ssw0rdMasterSecure2026!"
}
