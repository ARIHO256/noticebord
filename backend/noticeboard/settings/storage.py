"""Storage configuration for production (S3/CloudFront/MinIO)."""
import os


def configure_storage(settings):
    """Configure Django storages for S3/MinIO in production."""
    aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    aws_bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME")

    if aws_access_key and aws_secret_key and aws_bucket:
        settings["DEFAULT_FILE_STORAGE"] = "storages.backends.s3boto3.S3Boto3Storage"
        settings["STATICFILES_STORAGE"] = "storages.backends.s3boto3.S3Boto3Storage"
        settings["AWS_ACCESS_KEY_ID"] = aws_access_key
        settings["AWS_SECRET_ACCESS_KEY"] = aws_secret_key
        settings["AWS_STORAGE_BUCKET_NAME"] = aws_bucket
        settings["AWS_S3_REGION_NAME"] = os.environ.get("AWS_S3_REGION_NAME", "us-east-1")
        settings["AWS_S3_CUSTOM_DOMAIN"] = os.environ.get("AWS_CLOUDFRONT_DOMAIN", "")
        settings["AWS_S3_OBJECT_PARAMETERS"] = {
            "CacheControl": "max-age=86400",
        }
        settings["AWS_DEFAULT_ACL"] = "public-read"
        settings["AWS_QUERYSTRING_AUTH"] = False
        settings["AWS_S3_FILE_OVERWRITE"] = False

        # Thumbnail storage
        settings["IMAGEKIT_DEFAULT_FILE_STORAGE"] = "storages.backends.s3boto3.S3Boto3Storage"
    else:
        # Fallback to local filesystem
        settings["DEFAULT_FILE_STORAGE"] = "django.core.files.storage.FileSystemStorage"
