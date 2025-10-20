from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
import time
from clients.supabase_client import supabase_manager
from clients.r2_storage_client import get_r2_client

router = APIRouter(prefix="/data", tags=["Data"])

def init_data_router():
    """Initialize the data router"""
    # Simple in-memory caches with short TTL to stabilize pagination and reduce refetches
    videos_cache = {}
    # Default cache TTL set to 1 minute; can be overridden per-request via cache_ttl query param
    VIDEOS_CACHE_TTL_SECONDS = 60
    
    @router.get("/tracking")
    async def get_tracking_data(limit: int = 100):
        """
        Get tracking results data from database
        
        Retrieves vehicle tracking data from the database including vehicle positions,
        speeds, compliance status, and timestamps.
        
        Args:
            limit: Maximum number of records to return (default: 100)
        
        Returns:
            dict: Tracking data with vehicle information and compliance metrics
        """
        try:
            # Get tracking data
            tracking_data = supabase_manager.get_tracking_data(limit=limit)
            
            return {
                "status": "success",
                "table": "tracking_results",
                "count": len(tracking_data),
                "limit": limit,
                "data": tracking_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch tracking data: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/vehicle-counts")
    async def get_vehicle_counts(limit: int = 100):
        """
        Get vehicle counts data from database
        
        Retrieves vehicle count data from the database including counts by vehicle type,
        timestamps, and location information.
        
        Args:
            limit: Maximum number of records to return (default: 100)
        
        Returns:
            dict: Vehicle count data with type breakdowns and timestamps
        """
        try:
            # Get vehicle counts
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=limit)
            
            return {
                "status": "success",
                "table": "vehicle_counts",
                "count": len(vehicle_counts),
                "limit": limit,
                "data": vehicle_counts
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch vehicle counts: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/tracking/filter")
    async def get_filtered_tracking_data(
        limit: int = 100,
        date_from: str = None,
        date_to: str = None,
        compliance: int = None,
        vehicle_type: str = None,
        weather_condition: str = None,
        video_id: int = None,
    ):
        """
        Get filtered tracking results data from database
        
        Retrieves filtered tracking data based on various criteria including date range,
        compliance status, vehicle type, and weather conditions.
        
        Args:
            limit: Maximum number of records to return (default: 100)
            date_from: Start date filter (YYYY-MM-DD format)
            date_to: End date filter (YYYY-MM-DD format)
            compliance: Compliance status filter (0 or 1)
            vehicle_type: Vehicle type filter (car, truck, bus, motorcycle)
            weather_condition: Weather condition filter
        
        Returns:
            dict: Filtered tracking data with applied filters information
        """
        try:
            # Get tracking data (optionally by video)
            tracking_data = supabase_manager.get_tracking_data(limit=1000, video_id=video_id)
            
            # Apply filters
            filtered_data = tracking_data
            # Filter by video_id if supplied (redundant when passed to DB, but safe)
            if video_id is not None:
                filtered_data = [item for item in filtered_data if item.get('video_id') == video_id]

            # Filter by date range
            if date_from:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
            
            if date_to:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
            
            # Filter by compliance
            if compliance is not None:
                filtered_data = [item for item in filtered_data if item.get('compliance') == compliance]
            
            # Filter by vehicle type
            if vehicle_type:
                filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
            
            # Filter by weather condition
            if weather_condition:
                filtered_data = [item for item in filtered_data if item.get('weather_condition') == weather_condition]
            
            # Apply limit
            filtered_data = filtered_data[:limit]
            
            return {
                "status": "success",
                "table": "tracking_results",
                "count": len(filtered_data),
                "limit": limit,
                "filters_applied": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "compliance": compliance,
                    "vehicle_type": vehicle_type,
                    "weather_condition": weather_condition,
                    "video_id": video_id,
                },
                "data": filtered_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch filtered tracking data: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/vehicle-counts/filter")
    async def get_filtered_vehicle_counts(
        limit: int = 100,
        date_from: str = None,
        date_to: str = None,
        vehicle_type: str = None,
        video_id: int = None,
    ):
        """
        Get filtered vehicle counts data from database
        
        Retrieves filtered vehicle count data based on various criteria including date range
        and vehicle type.
        
        Args:
            limit: Maximum number of records to return (default: 100)
            date_from: Start date filter (YYYY-MM-DD format)
            date_to: End date filter (YYYY-MM-DD format)
            vehicle_type: Vehicle type filter (car, truck, bus, motorcycle)
        
        Returns:
            dict: Filtered vehicle count data with applied filters information
        """
        try:
            # Get vehicle counts (optionally by video)
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000, video_id=video_id)
            
            # Apply filters
            filtered_data = vehicle_counts
            # Filter by video_id if supplied (redundant when passed to DB, but safe)
            if video_id is not None:
                filtered_data = [item for item in filtered_data if item.get('video_id') == video_id]

            # Filter by date range
            if date_from:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
            
            if date_to:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
            
            # Filter by vehicle type
            if vehicle_type:
                filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
            
            # Apply limit
            filtered_data = filtered_data[:limit]
            
            return {
                "status": "success",
                "table": "vehicle_counts",
                "count": len(filtered_data),
                "limit": limit,
                "filters_applied": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "vehicle_type": vehicle_type,
                    "video_id": video_id,
                },
                "data": filtered_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch filtered vehicle counts: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/summary/by-video/{video_id}")
    async def get_summary_by_video(video_id: int):
        """
        Get a combined payload: video details + tracking data + vehicle counts + totals.
        """
        try:
            video = supabase_manager.get_video_data(video_id)
            if not video:
                return {"status": "error", "error": "Video not found", "video_id": video_id}

            # The RPC returns tracking_data and vehicle_counts as JSON arrays already
            tracking_data = video.get("tracking_data") or []
            vehicle_counts = video.get("vehicle_counts") or []

            # Prepare a minimal video subset for convenience
            video_core = {
                "id": video.get("video_id") or video_id,
                "video_name": video.get("video_name"),
                "status": video.get("status"),
                "processed_url": video.get("processed_url"),
                "duration_seconds": video.get("processing_time"),
                "total_vehicles": video.get("total_vehicles"),
                "compliance_rate": video.get("compliance_rate"),
            }

            return {
                "status": "success",
                "video": video_core,
                "tracking_data": tracking_data,
                "vehicle_counts": vehicle_counts,
                "totals": {
                    "tracking": len(tracking_data),
                    "vehicle_counts": len(vehicle_counts),
                }
            }
        except Exception as e:
            print(f"[ERROR] Failed to get summary for video {video_id}: {e}")
            return {"status": "error", "error": str(e), "video_id": video_id}


    @router.get("/videos/filter")
    async def filter_videos(
        limit: int = 25,
        offset: int = 0,
        date_from: str = None,  # YYYY-MM-DD
        date_to: str = None,    # YYYY-MM-DD
        order_by: str = "created_at",
        order_desc: bool = True,
        cache_ttl: int = None,
        no_cache: bool = False,
    ):
        """Filter videos by date range and ordering with pagination."""
        try:
            effective_ttl = VIDEOS_CACHE_TTL_SECONDS if cache_ttl is None else max(0, int(cache_ttl))
            # Serve from cache when available and fresh
            cache_key = f"{date_from}|{date_to}|{order_by}|{order_desc}|{limit}|{offset}"
            now = time.time()
            cached = videos_cache.get(cache_key)
            if not no_cache and effective_ttl > 0 and cached and (now - cached["ts"]) <= effective_ttl:
                return JSONResponse(content=cached["payload"], headers={
                    "Cache-Control": f"public, max-age={effective_ttl}"
                })

            # Base filtered query for data page
            data_q = supabase_manager.client.table("videos").select("*")
            if date_from:
                data_q = data_q.gte("created_at", f"{date_from} 00:00:00")
            if date_to:
                data_q = data_q.lte("created_at", f"{date_to} 23:59:59")

            data_q = data_q.order(order_by, desc=order_desc).range(offset, offset + max(0, limit) - 1)
            data_res = data_q.execute()
            data = data_res.data or []

            # Separate count query (without range) to get total rows after filters
            count_q = supabase_manager.client.table("videos").select("id")
            if date_from:
                count_q = count_q.gte("created_at", f"{date_from} 00:00:00")
            if date_to:
                count_q = count_q.lte("created_at", f"{date_to} 23:59:59")
            # Order not needed for count
            count_res = count_q.execute()
            total_count = len(count_res.data or [])

            # Build pagination hrefs
            def build_href(new_offset: int):
                params = []
                if date_from:
                    params.append(("date_from", date_from))
                if date_to:
                    params.append(("date_to", date_to))
                if order_by:
                    params.append(("order_by", order_by))
                params.append(("order_desc", str(order_desc).lower()))
                params.append(("limit", str(limit)))
                params.append(("offset", str(max(0, new_offset))))
                query = "&".join([f"{k}={v}" for k, v in params])
                return f"/data/videos/filter?{query}"

            next_offset = offset + limit
            prev_offset = max(0, offset - limit)
            has_next = next_offset < total_count
            has_prev = offset > 0

            payload = {
                "status": "success",
                "table": "videos",
                "count": total_count,
                "limit": limit,
                "offset": offset,
                "order_by": order_by,
                "order_desc": order_desc,
                "next_href": build_href(next_offset) if has_next else None,
                "prev_href": build_href(prev_offset) if has_prev else None,
                "data": data,
            }

            # Store in cache when enabled
            if not no_cache and effective_ttl > 0:
                videos_cache[cache_key] = {"ts": now, "payload": payload}

            # Set appropriate cache headers
            headers = {"Cache-Control": f"public, max-age={effective_ttl}"} if (not no_cache and effective_ttl > 0) else {"Cache-Control": "no-store"}
            return JSONResponse(content=payload, headers=headers)
        except Exception as e:
            print(f"[ERROR] Failed to filter videos: {e}")
            return {"status": "error", "error": str(e), "data": []}
    @router.delete("/videos/{video_id}")
    async def delete_video(video_id: int):
        """
        Delete a video and its related data.
        """
        try:
            ok = supabase_manager.delete_video_record(video_id)
            if ok:
                return {"status": "success", "deleted": video_id}
            return {"status": "error", "error": "Failed to delete video"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.get("/video/{video_id}")
    async def stream_video(video_id: str, request: Request):
        """
        Stream video from R2 through the API
        This creates a persistent URL that works forever
        """
        try:
            # Get video record from database
            result = supabase_manager.client.table("videos").select("processed_url, video_name").eq("id", video_id).execute()
            
            if not result.data:
                raise HTTPException(status_code=404, detail="Video not found")
            
            video_data = result.data[0]
            processed_url = video_data.get('processed_url')
            video_name = video_data.get('video_name', 'video')
            
            if not processed_url:
                raise HTTPException(status_code=404, detail="No video file available")
            
            # Extract filename from URL
            filename = processed_url.split('/')[-1]
            
            # Get video from R2 (support HTTP Range)
            r2_client = get_r2_client()
            
            try:
                range_header = request.headers.get('range')
                s3 = r2_client.s3_client
                bucket = r2_client.bucket_name
                s3_kwargs = {"Bucket": bucket, "Key": filename}
                status_code = 200
                headers = {
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=3600",
                    "Content-Disposition": f"inline; filename=\"{video_name}\""
                }
                if range_header and range_header.startswith('bytes='):
                    # Parse Range: bytes=start-end
                    try:
                        range_value = range_header.split('=')[1]
                        start_str, end_str = (range_value.split('-') + [None])[:2]
                        start = int(start_str) if start_str else 0
                        # Get object size for Content-Range
                        head = s3.head_object(Bucket=bucket, Key=filename)
                        total = head['ContentLength']
                        end = int(end_str) if end_str else total - 1
                        end = min(end, total - 1)
                        if start > end:
                            raise ValueError('Invalid range')
                        s3_kwargs["Range"] = f"bytes={start}-{end}"
                        status_code = 206
                        headers.update({
                            "Content-Range": f"bytes {start}-{end}/{total}",
                            "Content-Length": str(end - start + 1)
                        })
                    except Exception:
                        # Ignore malformed range; serve full content
                        pass
                response = s3.get_object(**s3_kwargs)
                body = response['Body']
                media_type = response.get('ContentType', 'video/mp4')
                if status_code == 200 and 'ContentLength' in response:
                    headers["Content-Length"] = str(response['ContentLength'])

                def generate():
                    for chunk in body.iter_chunks(chunk_size=8192):
                        yield chunk

                return StreamingResponse(generate(), media_type=media_type, headers=headers, status_code=status_code)
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error streaming video: {str(e)}")
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting video: {str(e)}")

    @router.get("/video/{video_id}/signed")
    async def get_signed_video_url(video_id: str, expires_in: int = 300):
        """Return a short-lived signed URL to stream the processed video directly from R2 (supports byte-range and faster start)."""
        try:
            result = supabase_manager.client.table("videos").select("processed_url, video_name").eq("id", video_id).execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="Video not found")
            video_data = result.data[0]
            processed_url = video_data.get('processed_url')
            if not processed_url:
                raise HTTPException(status_code=404, detail="No video file available")
            filename = processed_url.split('/')[-1]
            r2_client = get_r2_client()
            s3 = r2_client.s3_client
            url = s3.generate_presigned_url(
                ClientMethod='get_object',
                Params={'Bucket': r2_client.bucket_name, 'Key': filename},
                ExpiresIn=max(60, min(3600, int(expires_in)))
            )
            return {"status": "success", "url": url, "expires_in": max(60, min(3600, int(expires_in)))}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating signed URL: {str(e)}")

    return router
