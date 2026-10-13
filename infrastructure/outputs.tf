output "deploy_role_arn" {
  description = "Set this as the AWS_ROLE_ARN variable on each GitHub environment that deploys."
  value       = aws_iam_role.deploy.arn
}

output "deploy_role_name" {
  description = "Name of the IAM role GitHub Actions assumes."
  value       = aws_iam_role.deploy.name
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider."
  value       = local.oidc_provider_arn
}

output "s3_object_arn" {
  description = "Object ARN prefix the deploy role is allowed to read, write, and delete."
  value       = local.object_arn
}
