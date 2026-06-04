import io

from qcloud_cos import CosConfig, CosS3Client

from app.common.config import settings

_config = CosConfig(
    Region=settings.COS_REGION,
    SecretId=settings.COS_SECRET_ID,
    SecretKey=settings.COS_SECRET_KEY,
    Scheme=settings.COS_SCHEMA
)

client = CosS3Client(_config)
_bucket = settings.COS_BUCKET

def ensure_bucket():
    try:
        client.head_bucket(Bucket=_bucket)
    except Exception:
        client.create_bucket(Bucket=_bucket)

def upload_file(object_key: str, data: bytes, content_type: str = 'application/pdf'):
    client.put_object(
        Bucket=_bucket,
        Key=object_key,
        Body=io.BytesIO(data),
        ContentLength=str(len(data)),
        ContentType=content_type
    )

def download_file(object_key: str):
    response = client.get_object(Bucket=_bucket, Key=object_key)
    data = response['Body'].read()
    return data

def delete_file(object_key: str):
    client.delete_object(Bucket=_bucket, Key=object_key)

def get_presigned_url(object_key: str, expires: int = 3600):
    url = client.get_presigned_url(
        Method='GET',
        Bucket=_bucket,
        Key=object_key,
        Expired=expires
    )
    return url