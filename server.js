import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Add CSP headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.atlassian.net"
  );
  next();
});

// Handle OPTIONS requests globally
app.options('*', (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy Jira endpoint
app.get('/proxy-jira', async (req, res) => {
  try {
    const email = process.env.ATLASSIAN_EMAIL;
    const token = process.env.ATLASSIAN_TOKEN;

    if (!email || !token) {
      console.error('Missing Atlassian credentials');
      return res.status(500).json({
        error: 'Missing Atlassian credentials',
        timestamp: new Date().toISOString()
      });
    }

    console.log('Using Jira credentials:', { email });

    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const jql = encodeURIComponent('project = PROJECT49 ORDER BY updated DESC');
    const apiUrl = `https://synerx.atlassian.net/rest/api/3/search?jql=${jql}&maxResults=50`;

    console.log('Fetching from Jira API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    const responseText = await response.text();
    console.log('Jira API response status:', response.status);
    console.log('Jira API response headers:', response.headers);
    
    if (!response.ok) {
      console.error('Jira API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      return res.status(response.status).json({
        error: 'Jira API error',
        detail: responseText,
        status: response.status,
        timestamp: new Date().toISOString()
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Jira response:', responseText);
      return res.status(500).json({
        error: 'Invalid JSON response from Jira',
        detail: responseText,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Jira API success - issues count:', data.issues?.length || 0);
    res.json(data);
  } catch (error) {
    console.error('Jira API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch Jira data',
      detail: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});