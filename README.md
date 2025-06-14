# Project 49 - Road Safety Analysis Platform

A comprehensive web application for analyzing road user behavior at level crossings using AI and computer vision technology.

## Features

- 🎥 Video Analysis: Process traffic footage using YOLOv8 for vehicle detection and tracking
- 📊 Real-time Analytics: Monitor and visualize traffic patterns and compliance metrics
- 📱 Responsive Design: Full mobile and desktop support
- 🔒 Secure Authentication: Email and Google sign-in options
- 📈 Progress Tracking: Kanban board for project management
- 📄 Report Generation: Export detailed safety analysis reports

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase, Edge Functions
- **Authentication**: Firebase Auth
- **AI/ML**: YOLOv8
- **Analytics**: Recharts
- **Storage**: Firebase Storage

<<<<<<< Updated upstream
## Access

https://synerx.netlify.app/
=======
## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   
   VITE_CONFLUENCE_TOKEN=
   VITE_PROJECT_KEY=
   VITE_JIRA_URL=
   
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
>>>>>>> Stashed changes

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── lib/           # Utilities and API functions
└── assets/        # Static assets

supabase/
├── functions/     # Edge Functions
└── migrations/    # Database migrations
```

## Key Features

### Video Analysis
- Upload and process traffic footage
- Real-time vehicle detection
- Violation detection and classification

### Analytics Dashboard
- Traffic flow visualization
- Compliance rate tracking
- Violation type breakdown
- Historical trend analysis

### Project Management
- Task tracking with Kanban board
- Progress monitoring
- Team collaboration features

### Report Generation
- PDF export functionality
- Customizable report templates
- Data visualization options

## Team

- Sasindu Dilshan Ranwadana (Team Leader)
- Quang Vinh Le
- Franco Octavio Jimenez Perez
- Janith Athuluwage
- Thiviru Thejan
- Risinu Cooray

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- VicRoads
- Department of Transport
- V/Line
<<<<<<< Updated upstream
- Swinburne University of Technology
=======
- Swinburne University of Technology
>>>>>>> Stashed changes
