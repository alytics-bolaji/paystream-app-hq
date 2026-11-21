# variables.tf -- the inputs you can change without editing the main config.
variable "region" {
  description = "AWS region to build the staging estate in"
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "IP range for the staging VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "subnet_cidr" {
  description = "IP range for the public subnet inside the VPC"
  type        = string
  default     = "10.20.1.0/24"
}

variable "instance_type" {
  description = "EC2 size (t3.micro is free-tier eligible)"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair, for SSH access"
  type        = string
}

variable "my_ip" {
  description = "Your public IP in CIDR form (e.g. 1.2.3.4/32) allowed to SSH in"
  type        = string
}
