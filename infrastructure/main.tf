data "aws_s3_bucket" "app" {
  bucket = var.s3.bucket_name
}

locals {
  normalized_prefix = trim(var.s3.path_prefix, "/")

  object_arn = (
    local.normalized_prefix == ""
    ? "${data.aws_s3_bucket.app.arn}/*"
    : "${data.aws_s3_bucket.app.arn}/${local.normalized_prefix}/*"
  )

  # aws s3 sync lists the prefix with and without a trailing slash.
  list_prefixes = (
    local.normalized_prefix == ""
    ? ["*"]
    : [
      local.normalized_prefix,
      "${local.normalized_prefix}/",
      "${local.normalized_prefix}/*",
    ]
  )

  oidc_provider_url = "https://token.actions.githubusercontent.com"
  oidc_provider_arn = (
    var.github.create_oidc_provider
      ? one(aws_iam_openid_connect_provider.github[*].arn)
      : one(data.aws_iam_openid_connect_provider.github[*].arn)
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.github.create_oidc_provider ? 1 : 0
  url            = local.oidc_provider_url
  client_id_list = ["sts.amazonaws.com"]
  tags           = var.tags
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.github.create_oidc_provider ? 0 : 1
  url   = local.oidc_provider_url
}

data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github.repository}:environment:${var.github.environment}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "mbta-checkin-deploy-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
  description        = "Assumed by GitHub Actions to publish this app under its S3 prefix."
  tags               = var.tags
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "ListAppPrefix"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]
    resources = [data.aws_s3_bucket.app.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = local.list_prefixes
    }
  }

  statement {
    sid    = "SyncAppObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]
    resources = [local.object_arn]
  }

  # AWS CLI reads this before syncing to confirm the bucket's region
  statement {
    sid       = "ReadBucketRegion"
    effect    = "Allow"
    actions   = ["s3:GetBucketLocation"]
    resources = [data.aws_s3_bucket.app.arn]
  }
}

resource "aws_iam_policy" "deploy" {
  name   = "${aws_iam_role.deploy.name}-s3"
  policy = data.aws_iam_policy_document.deploy.json
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}
