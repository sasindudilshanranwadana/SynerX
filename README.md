# Project 49 - Road Safety Analysis

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
3. Configure the following environment variables in `.env`:
   - Jira credentials:
     - `ATLASSIAN_EMAIL`
     - `ATLASSIAN_TOKEN`
   - Firebase configuration:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
   - Server configuration:
     - `PORT` (Optional, defaults to 4001)

4. Install dependencies:
   ```bash
   npm install
   ```
5. Start both frontend and backend servers:
   ```bash
   npm run dev:all
   ```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:4001`.

## Features

- Firebase Authentication with Google Sign-in
- Jira Integration for Project Management
- Real-time Updates
- Responsive Dashboard
- Dark/Light Theme Support

## API Endpoints

### GET /api/jira
Fetches issues from Jira with the JQL query: `project = SYNERX ORDER BY updated DESC`