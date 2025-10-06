import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from typing import Optional
import uuid
from datetime import datetime
from pathlib import Path

class R2StorageClient:
    """Cloudflare R2 storage client using S3-compatible API"""
    
    def __init__(self):
        # Get credentials from environment variables
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "synerx-videos")
        
        if not self.access_key_id or not self.secret_access_key:
            raise ValueError("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY in environment variables")
        
        # Create S3-compatible client for R2
        self.s3_client = boto3.client(
            's3',
            endpoint_url=f'https://{self.account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name='auto'  # R2 uses 'auto' region
        )
    
    def upload_video(self, file_path: str, file_name: str = None) -> Optional[str]:
        """
        Upload a video file to R2 storage
        
        Args:
            file_path: Local path to the video file
            file_name: Optional custom filename (defaults to original filename)
            
        Returns:
            Public URL of the uploaded file, or None if upload failed
        """
        try:
            if file_name is None:
                file_name = os.path.basename(file_path)
            
            # Generate unique filename to avoid conflicts
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name_parts = Path(file_name).stem, Path(file_name).suffix
            unique_filename = f"{name_parts[0]}_{timestamp}{name_parts[1]}"
            
            print(f"[R2] Uploading {file_path} as {unique_filename}...")
            
            # Upload file to R2 with proper video streaming headers
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                unique_filename,
                ExtraArgs={
                    'ContentType': 'video/mp4',
                    'ACL': 'public-read',  # Make file publicly accessible
                    'CacheControl': 'public, max-age=31536000',  # Cache for 1 year
                    'ContentDisposition': 'inline',  # Display inline, not download
                    'Metadata': {
                        'streaming': 'true',
                        'video': 'true'
                    }
                }
            )
            
            # Generate public URL using the public dev URL
            public_url = f"https://pub-d09bbd55032147988e9281c29382194b.r2.dev/{unique_filename}"
            
            print(f"[R2] ✅ Upload successful: {public_url}")
            return public_url
            
        except NoCredentialsError:
            print("[R2] ❌ Error: Invalid credentials")
            return None
        except ClientError as e:
            print(f"[R2] ❌ Error uploading file: {e}")
            return None
        except Exception as e:
            print(f"[R2] ❌ Unexpected error: {e}")
            return None
    
    def upload_video_stream(self, file_stream, file_name: str) -> Optional[str]:
        """
        Upload a video file directly from stream to R2 storage (no temp files!)
        
        Args:
            file_stream: File stream object (e.g., from FastAPI UploadFile)
            file_name: Filename for the uploaded file
            
        Returns:
            Public URL of the uploaded file, or None if upload failed
        """
        try:
            # Generate unique filename to avoid conflicts
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name_parts = Path(file_name).stem, Path(file_name).suffix
            unique_filename = f"{name_parts[0]}_{timestamp}{name_parts[1]}"
            
            print(f"[R2] Streaming upload as {unique_filename}...")
            
            # Upload file stream directly to R2 with proper video streaming headers
            self.s3_client.upload_fileobj(
                file_stream,
                self.bucket_name,
                unique_filename,
                ExtraArgs={
                    'ContentType': 'video/mp4',
                    'ACL': 'public-read',  # Make file publicly accessible
                    'CacheControl': 'public, max-age=31536000',  # Cache for 1 year
                    'ContentDisposition': 'inline',  # Display inline, not download
                    'Metadata': {
                        'streaming': 'true',
                        'video': 'true',
                        'upload_method': 'direct_stream'
                    }
                }
            )
            
            # Return the R2 object key (filename) instead of public URL
            # This follows the same pattern as processed videos
            print(f"[R2] ✅ Direct stream upload successful: {unique_filename}")
            return unique_filename
            
        except NoCredentialsError:
            print("[R2] ❌ Error: Invalid credentials")
            return None
        except ClientError as e:
            print(f"[R2] ❌ Error uploading stream: {e}")
            return None
        except Exception as e:
            print(f"[R2] ❌ Unexpected error in stream upload: {e}")
            return None

    def delete_video(self, file_name: str) -> bool:
        """
        Delete a video file from R2 storage
        
        Args:
            file_name: Name of the file to delete
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_name
            )
            print(f"[R2] ✅ Deleted file: {file_name}")
            return True
        except ClientError as e:
            print(f"[R2] ❌ Error deleting file: {e}")
            return False
    
    def list_videos(self, prefix: str = "") -> list:
        """
        List all videos in the bucket
        
        Args:
            prefix: Optional prefix to filter files
            
        Returns:
            List of file objects
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            return response.get('Contents', [])
        except ClientError as e:
            print(f"[R2] ❌ Error listing files: {e}")
            return []
    
    def get_file_size(self, file_name: str) -> Optional[int]:
        """
        Get the size of a file in R2 storage
        
        Args:
            file_name: Name of the file
            
        Returns:
            File size in bytes, or None if file not found
        """
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=file_name
            )
            return response.get('ContentLength')
        except ClientError:
            return None
    
    def test_connection(self) -> bool:
        """
        Test the connection to R2 storage
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Try to list objects (this will fail if credentials are wrong)
            self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                MaxKeys=1
            )
            print("[R2] ✅ Connection test successful")
            return True
        except Exception as e:
            print(f"[R2] ❌ Connection test failed: {e}")
            return False
    
    
    def get_storage_usage(self) -> dict:
        """
        Get storage usage statistics for the bucket
        
        Returns:
            Dictionary with usage statistics
        """
        try:
            objects = self.list_videos()
            
            if not objects:
                return {
                    'total_files': 0,
                    'total_size_bytes': 0,
                    'total_size_mb': 0,
                    'total_size_gb': 0,
                    'usage_percentage': 0,
                    'remaining_gb': 10.0
                }
            
            total_size_bytes = sum(obj['Size'] for obj in objects)
            total_size_mb = total_size_bytes / (1024 * 1024)
            total_size_gb = total_size_mb / 1024
            
            # Free tier is 10GB
            free_limit_gb = 10.0
            free_limit_bytes = free_limit_gb * 1024 * 1024 * 1024
            usage_percentage = (total_size_bytes / free_limit_bytes) * 100
            remaining_gb = free_limit_gb - total_size_gb
            
            return {
                'total_files': len(objects),
                'total_size_bytes': total_size_bytes,
                'total_size_mb': total_size_mb,
                'total_size_gb': total_size_gb,
                'usage_percentage': usage_percentage,
                'remaining_gb': remaining_gb
            }
            
        except Exception as e:
            print(f"[R2] ❌ Error getting storage usage: {e}")
            return None

# Create global instance (lazy initialization)
r2_client = None

def get_r2_client():
    """Get R2 client instance with lazy initialization"""
    global r2_client
    if r2_client is None:
        r2_client = R2StorageClient()
    return r2_client
