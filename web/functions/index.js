const functions = require('firebase-functions');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

app.get('/proxy-jira', async (req, res) => {
  try {
    const email = functions.config().jira.email;
    const token = functions.config().jira.token;

    if (!email || !token) {
      console.error('Missing Atlassian credentials');
      return res.status(500).json({
        error: 'Missing Atlassian credentials',
        timestamp: new Date().toISOString()
      });
    }

    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const jql = encodeURIComponent('project = PROJECT49 ORDER BY updated DESC');
    const apiUrl = `https://synerx.atlassian.net/rest/api/3/search?jql=${jql}&maxResults=50`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return res.status(response.status).json({
        error: 'Jira API error',
        detail: errorText,
        status: response.status,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Jira API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch Jira data',
      detail: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

exports.api = functions.https.onRequest(app);