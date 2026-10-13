terraform {
  required_version = ">= 1.14.0"

  # location/region/etc configured in `backends/` (not checked in)
  # specify on terraform init with -backend-config=backends/<environment>.tfvars
  backend "s3" {
    encrypt = "true"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
