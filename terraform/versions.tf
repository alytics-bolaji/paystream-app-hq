# versions.tf -- which Terraform and which providers this configuration needs.
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws" # the official AWS provider from the Terraform Registry
      version = "~> 5.0"         # any 5.x version
    }
  }
}
