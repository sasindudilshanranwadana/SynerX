import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const allowedOrigins = [
  'https://synerx.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // We'll validate origins in the handler
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  // Get the request origin
  const origin = req.headers.get('Origin') || '';

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
      }
    });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch tasks from the tasks table
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ issues: tasks || [] }),
      {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
        },
        status: 500
      }
    );
  }
});