# main.tf -- the Kenya staging estate: a VPC, a public subnet, a way out to the
# internet, a firewall, and the Paystream EC2 instance. This whole file IS the
# thing that was deleted by hand last week -- now it is written down.

# The provider: tells Terraform to talk to AWS, in this region.
provider "aws" {
  region = var.region
}

# A data source looks up something that already exists in AWS. Here: the latest
# Ubuntu 22.04 image, so we never hard-code an AMI id that differs per region.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical, the publisher of Ubuntu images
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# The VPC: a private network in AWS for the Kenya staging estate.
resource "aws_vpc" "staging" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  tags = {
    Name    = "kenya-staging"
    Project = "paystream"
    Env     = "staging"
  }
}

# A public subnet inside that VPC for the instance to live in.
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = var.subnet_cidr
  map_public_ip_on_launch = true
  tags = {
    Name = "kenya-staging-public"
  }
}

# An internet gateway: the VPC's door to the public internet.
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.staging.id
  tags = {
    Name = "kenya-staging-igw"
  }
}

# A route table that sends all outbound traffic through the internet gateway...
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
  tags = {
    Name = "kenya-staging-public-rt"
  }
}

# ...and attach that route table to the public subnet.
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# The firewall: SSH only from your IP, HTTP from anywhere (the Paystream site).
resource "aws_security_group" "web" {
  name        = "kenya-staging-web"
  description = "SSH from my ip, HTTP from anywhere"
  vpc_id      = aws_vpc.staging.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "kenya-staging-web"
  }
}

# The EC2 instance that runs Paystream, placed in the subnet behind the firewall.
resource "aws_instance" "paystream" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name    = "paystream-staging"
    Project = "paystream"
    Env     = "staging"
  }
}
