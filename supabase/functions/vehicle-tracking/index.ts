import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    console.log('🎯 Edge Function triggered');
    const json = await req.json();
    const videoId = json?.video_id;
    const videoUrl = json?.video_url;

    if (!videoId || !videoUrl) {
      console.error('❌ Missing required fields');
      return new Response(JSON.stringify({
        error: 'Missing required fields: video_id and video_url'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('📡 Forwarding to backend...');
    const response = await fetch("https://synerx.onrender.com/process-video/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders // ✅ Add CORS headers to actual fetch request
      },
      body: JSON.stringify({
        video_id: videoId,
        video_url: videoUrl
      })
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = { error: 'Failed to parse backend response' };
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('❌ Function Error:', err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
