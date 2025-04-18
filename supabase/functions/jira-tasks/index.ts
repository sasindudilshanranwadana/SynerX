import { serve } from "npm:@supabase/functions-js@2.1.5";

const allowedOrigins = [
  'https://synerx.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173'
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // We'll validate origins in the handler
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

const JIRA_EMAIL = "sdranwadana@gmail.com";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;

serve(async (req) => {
  // Get the request origin
  const origin = req.headers.get('Origin') || '';

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
      }
    });
  }

  try {
    // Encode credentials for Basic Auth
    const auth = btoa(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`);
    
    // Construct JQL query
    const jql = encodeURIComponent("project = PROJECT49 ORDER BY updated DESC");
    const apiUrl = `https://synerx.atlassian.net/rest/api/3/search?jql=${jql}&maxResults=50`;

    // Make request to Jira API
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform the response to match our Task interface
    const transformedData = {
      issues: data.issues.map((issue: any) => ({
        id: issue.id,
        project_id: issue.key,
        title: issue.fields.summary,
        description: issue.fields.description || '',
        status: mapJiraStatus(issue.fields.status.name),
        priority: mapJiraPriority(issue.fields.priority.name),
        type: mapJiraIssueType(issue.fields.issuetype.name),
        labels: issue.fields.labels || [],
        assignee: issue.fields.assignee?.displayName || null,
        created_at: issue.fields.created,
        updated_at: issue.fields.updated
      }))
    };

    return new Response(
      JSON.stringify(transformedData),
      { 
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
        }
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), 
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
        }
      }
    );
  }
});

function mapJiraStatus(status: string): 'to_do' | 'in_progress' | 'done' {
  const statusMap: Record<string, 'to_do' | 'in_progress' | 'done'> = {
    'To Do': 'to_do',
    'In Progress': 'in_progress',
    'Done': 'done'
  };
  return statusMap[status] || 'to_do';
}

function mapJiraPriority(priority: string): 'high' | 'medium' | 'low' {
  const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
    'Highest': 'high',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'Lowest': 'low'
  };
  return priorityMap[priority] || 'medium';
}

function mapJiraIssueType(type: string): 'task' | 'epic' | 'bug' | 'story' {
  const typeMap: Record<string, 'task' | 'epic' | 'bug' | 'story'> = {
    'Task': 'task',
    'Epic': 'epic',
    'Bug': 'bug',
    'Story': 'story'
  };
  return typeMap[type] || 'task';
}