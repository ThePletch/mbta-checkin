variable "aws_region" {
  description = "AWS region for the provider. IAM is global; this is the region Terraform uses to look up the existing bucket."
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "s3" {
  description = "S3 configuration"
  type        = object({
    bucket_name = string
    path_prefix = string
  })

  validation {
    condition     = !can(regex("(^s3://)|(^arn:)", var.s3.path_prefix))
    error_message = "s3.path_prefix is a key prefix inside the bucket, such as \"apps/mbta-checkin\" or \"/\"."
  }
}

variable "github" {
  description = "GitHub configuration"
  type        = object({
    repository = string
    environment = optional(string, null) # defaults to var.environment
    create_oidc_provider = optional(bool, true)
  })

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github.repository))
    error_message = "github.repository must be in owner/name form."
  }
}

variable "tags" {
  description = "Tags applied to the OIDC provider and deploy role."
  type        = map(string)
  default     = {}
}
