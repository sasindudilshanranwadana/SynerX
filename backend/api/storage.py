from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
import os
import shutil
import glob
from pathlib import Path
from typing import List, Dict, Any
from clients.r2_storage_client import get_r2_client

router = APIRouter(prefix="/storage", tags=["Storage Management"])

def init_storage_router():
    """Initialize the storage router"""
    
    @router.get("/info")
    async def get_storage_info():
        """
        Get R2 storage information including total, used, free space and temp files
        
        Returns:
            dict: R2 storage information with space usage and temp file details
        """
        try:
            r2_client = get_r2_client()
            
            # Get all files first to identify temp files
            all_files = r2_client.list_videos()
            if all_files:
                # Calculate total size manually to verify
                manual_total = sum(f['Size'] for f in all_files)
            else:
                pass
            
            # Get R2 storage usage
            usage_stats = r2_client.get_storage_usage()
            
            if usage_stats is None:
                
                # Calculate usage from files if usage_stats fails
                total_size = sum(file_obj['Size'] for file_obj in all_files)
                usage_stats = {
                    'total_size_bytes': total_size,
                    'usage_percentage': (total_size / (10 * 1024 * 1024 * 1024)) * 100,
                    'remaining_gb': 10.0 - (total_size / (1024 * 1024 * 1024))
                }
            temp_files = []
            temp_size = 0
            
            # Identify temporary files (files that don't start with "processed_" AND don't contain "interrupted")
            for file_obj in all_files:
                file_name = file_obj['Key']
                
                # Temp files are: files that don't start with "processed_" AND don't contain "interrupted"
                is_temp = not file_name.startswith('processed_') and 'interrupted' not in file_name.lower()
                
                if is_temp:
                    temp_files.append({
                        "path": file_name,
                        "size": file_obj['Size'],
                        "modified": file_obj['LastModified'].timestamp()
                    })
                    temp_size += file_obj['Size']
                else:
                    pass
            
            
            
            # R2 free tier is 10GB
            total_gb = 10.0
            total_bytes = total_gb * 1024 * 1024 * 1024
            used_bytes = usage_stats['total_size_bytes']
            free_bytes = total_bytes - used_bytes
            
            payload = {
                "status": "success",
                "data": {
                    "total": int(total_bytes),
                    "used": int(used_bytes),
                    "free": int(free_bytes),
                    "temp_files": len(temp_files),
                    "temp_size": temp_size,
                    "temp_file_list": temp_files,
                    "usage_percentage": usage_stats['usage_percentage'],
                    "remaining_gb": usage_stats['remaining_gb']
                }
            }
            return JSONResponse(content=payload, headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            })
            
        except Exception as e:
            print(f"[ERROR] Failed to get R2 storage info: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": {
                    "total": 0,
                    "used": 0,
                    "free": 0,
                    "temp_files": 0,
                    "temp_size": 0
                }
            }

    @router.get("/videos")
    async def get_video_files():
        """
        Get list of all video files from R2 storage with metadata
        
        Returns:
            dict: List of video files with size, status, and other metadata
        """
        try:
            r2_client = get_r2_client()
            
            # Get all files from R2
            all_files = r2_client.list_videos()
            video_files = []
            
            for file_obj in all_files:
                file_name = file_obj['Key']
                file_size = file_obj['Size']
                last_modified = file_obj['LastModified']
                
                # Determine file status based on name patterns
                # Keep files that start with "processed_" OR contain "interrupted"
                if file_name.startswith('processed_') or 'interrupted' in file_name.lower():
                    status = "processed"
                else:
                    # All other files are temporary and should be cleaned up
                    status = "temp"
                
                # Check if it's a video file by extension
                video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv']
                if any(file_name.lower().endswith(ext) for ext in video_extensions):
                    # Create a unique ID to avoid duplicates
                    unique_id = f"{file_name}_{file_size}_{last_modified.timestamp()}"
                    
                    video_files.append({
                        "id": unique_id,
                        "name": file_name,
                        "size": file_size,
                        "created_at": last_modified.strftime("%Y-%m-%d %H:%M:%S"),
                        "status": status,
                        "path": file_name,
                        "duration": None,  # Would need video processing to get this
                        "resolution": None,  # Would need video processing to get this
                        "last_modified": last_modified.isoformat(),
                        "raw_name": file_name  # Keep original name for reference
                    })
            
            # Sort by last modified time (newest first)
            video_files.sort(key=lambda x: x["last_modified"], reverse=True)
            
            payload = {
                "status": "success",
                "data": video_files
            }
            return JSONResponse(content=payload, headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            })
            
        except Exception as e:
            print(f"[ERROR] Failed to get R2 video files: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.post("/videos/delete")
    async def delete_video_files(request: Dict[str, Any]):
        """
        Delete selected video files from R2 storage
        
        Args:
            request: Dictionary containing 'video_ids' list of file names to delete
            
        Returns:
            dict: Result of deletion operation
        """
        try:
            r2_client = get_r2_client()
            video_ids = request.get("video_ids", [])
            deleted_files = []
            failed_deletions = []
            
            for video_id in video_ids:
                try:
                    success = r2_client.delete_video(video_id)
                    if success:
                        deleted_files.append(video_id)
                    else:
                        failed_deletions.append(f"Failed to delete {video_id}")
                except Exception as e:
                    failed_deletions.append(f"Failed to delete {video_id}: {str(e)}")
                    print(f"[DELETE] ❌ Exception deleting {video_id}: {str(e)}")
            
            return {
                "status": "success",
                "deleted_files": deleted_files,
                "failed_deletions": failed_deletions,
                "message": f"Deleted {len(deleted_files)} files successfully"
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to delete R2 video files: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    @router.post("/cleanup")
    async def cleanup_temp_files():
        """
        Clean up temporary files from R2 storage to free up space
        
        Returns:
            dict: Result of cleanup operation
        """
        try:
            r2_client = get_r2_client()
            
            # Get all files from R2
            all_files = r2_client.list_videos()
            cleaned_files = []
            freed_space = 0
            
            # Find and delete temp files (files that don't start with "processed_" AND don't contain "interrupted")
            for file_obj in all_files:
                file_name = file_obj['Key']
                file_size = file_obj['Size']
                
                # Temp files are: files that don't start with "processed_" AND don't contain "interrupted"
                is_temp = not file_name.startswith('processed_') and 'interrupted' not in file_name.lower()
                
                if is_temp:
                    try:
                        success = r2_client.delete_video(file_name)
                        if success:
                            cleaned_files.append(file_name)
                            freed_space += file_size
                        else:
                            pass
                    except Exception as e:
                        print(f"[CLEANUP] ❌ Exception deleting {file_name}: {e}")
                else:
                    pass
            
            return {
                "status": "success",
                "cleaned_files": cleaned_files,
                "freed_space": freed_space,
                "message": f"Cleaned up {len(cleaned_files)} temporary files, freed {freed_space} bytes"
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to cleanup R2 temp files: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    @router.get("/analytics")
    async def get_storage_analytics():
        """
        Get R2 storage analytics including file type distribution and growth trends
        
        Returns:
            dict: R2 storage analytics data
        """
        try:
            r2_client = get_r2_client()
            
            # Get all files from R2
            all_files = r2_client.list_videos()
            
            # Analyze file types
            file_types = {}
            total_files = len(all_files)
            total_size = 0
            
            for file_obj in all_files:
                file_name = file_obj['Key']
                file_size = file_obj['Size']
                total_size += file_size
                
                # Get file extension
                ext = Path(file_name).suffix.lower()
                if ext:
                    file_types[ext] = file_types.get(ext, 0) + 1
            
            # Get largest files
            largest_files = sorted(all_files, key=lambda x: x['Size'], reverse=True)[:10]
            largest_files_formatted = [
                {
                    "path": file_obj['Key'],
                    "size": file_obj['Size'],
                    "name": file_obj['Key']
                }
                for file_obj in largest_files
            ]
            
            return {
                "status": "success",
                "data": {
                    "total_files": total_files,
                    "total_size": total_size,
                    "file_types": file_types,
                    "largest_files": largest_files_formatted
                }
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to get R2 storage analytics: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    @router.get("/video/{filename}")
    async def stream_video(filename: str, request: Request):
        """
        Stream a video file from R2 storage with HTTP Range support.
        """
        r2_client = get_r2_client()
        range_header = request.headers.get('range')
        s3 = r2_client.s3_client
        bucket = r2_client.bucket_name
        s3_kwargs = {"Bucket": bucket, "Key": filename}
        status_code = 200
        headers = {
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000'
        }

        try:
            if range_header and range_header.startswith('bytes='):
                range_value = range_header.split('=')[1]
                start_str, end_str = (range_value.split('-') + [None])[:2]
                start = int(start_str) if start_str else 0
                head = s3.head_object(Bucket=bucket, Key=filename)
                total = head['ContentLength']
                end = int(end_str) if end_str else total - 1
                end = min(end, total - 1)
                if start > end:
                    raise HTTPException(status_code=416, detail='Invalid Range')
                s3_kwargs['Range'] = f'bytes={start}-{end}'
                status_code = 206
                headers.update({
                    'Content-Range': f'bytes {start}-{end}/{total}',
                    'Content-Length': str(end - start + 1)
                })
        except HTTPException:
            raise
        except Exception:
            # Ignore malformed range and serve full content
            pass

        try:
            response = s3.get_object(**s3_kwargs)
        except Exception as e:
            print(f"[ERROR] Failed to stream video {filename}: {e}")
            raise HTTPException(status_code=404, detail='Video not found')

        content_type = response.get('ContentType', 'video/mp4')
        if status_code == 200 and 'ContentLength' in response:
            headers['Content-Length'] = str(response['ContentLength'])

        def generate():
            for chunk in response['Body'].iter_chunks(chunk_size=8192):
                yield chunk

        return StreamingResponse(generate(), media_type=content_type, headers=headers, status_code=status_code)

    @router.get("/video/{filename}/signed")
    async def get_signed_video_url(filename: str, expires_in: int = 300):
        """Return a short-lived signed URL for direct R2 streaming (supports Range)."""
        try:
            r2_client = get_r2_client()
            s3 = r2_client.s3_client
            url = s3.generate_presigned_url(
                ClientMethod='get_object',
                Params={'Bucket': r2_client.bucket_name, 'Key': filename},
                ExpiresIn=max(60, min(3600, int(expires_in)))
            )
            return {"status": "success", "url": url, "expires_in": max(60, min(3600, int(expires_in)))}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating signed URL: {str(e)}")

    @router.get("/video/{filename}/download")
    async def download_video(filename: str):
        """
        Download a video file from R2 storage
        
        Args:
            filename: Name of the video file to download
            
        Returns:
            StreamingResponse: Video download
        """
        try:
            r2_client = get_r2_client()
            
            # Get the video file from R2
            try:
                response = r2_client.s3_client.get_object(
                    Bucket=r2_client.bucket_name,
                    Key=filename
                )
                
                # Get file info
                file_size = response['ContentLength']
                content_type = response.get('ContentType', 'video/mp4')
                
                # Create streaming response for download
                def generate():
                    for chunk in response['Body'].iter_chunks(chunk_size=8192):
                        yield chunk
                
                return StreamingResponse(
                    generate(),
                    media_type=content_type,
                    headers={
                        'Content-Length': str(file_size),
                        'Content-Disposition': f'attachment; filename="{filename}"',
                        'Cache-Control': 'public, max-age=31536000'
                    }
                )
                
            except Exception as e:
                print(f"[ERROR] Failed to download video {filename}: {e}")
                return {"error": "Video not found"}
                
        except Exception as e:
            print(f"[ERROR] Failed to download video: {e}")
            return {"error": "Failed to download video"}

    return router
