# SynerX - Road Safety Analysis Platform

A comprehensive web application for analyzing road user behavior at level crossings using AI-powered computer vision technology.

## Overview

SynerX is a React-based frontend application that connects to a backend API for video processing and analysis. The platform enables traffic safety analysts to upload footage, track vehicle behavior, and generate detailed compliance reports.

## Features

- **Video Upload & Processing**: Upload traffic footage for AI-powered analysis
- **Real-time Analytics Dashboard**: Monitor traffic patterns and compliance metrics
- **Vehicle Detection & Tracking**: YOLOv8-based vehicle detection and behavior analysis
- **Violation Detection**: Automatic identification of safety violations
- **Interactive Playback**: Review processed videos with annotations
- **Report Generation**: Export detailed PDF reports with visualizations
- **User Authentication**: Secure login with Supabase Auth
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Charts**: Recharts, Chart.js, Plotly.js
- **Icons**: Lucide React
- **PDF Export**: jsPDF with autoTable

### Backend Integration
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Cloudflare R2
- **API**: REST API (FastAPI backend - separate repository)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API setup (see [`../backend/README.md`](../backend/README.md) for setup instructions)
- Supabase project with database configured
- Cloudflare R2 bucket
- Backend `.env` file configured with all required settings

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd synerx-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Cloudflare R2 Storage
   VITE_R2_ACCOUNT_ID=your_account_id
   VITE_R2_ACCESS_KEY_ID=your_access_key
   VITE_R2_SECRET_ACCESS_KEY=your_secret_key
   VITE_R2_BUCKET_NAME=your_bucket_name
   VITE_R2_PUBLIC_URL=https://your-bucket.r2.dev

   # Backend API
   VITE_BACKEND_URL=http://localhost:8000
   ```

4. **Set up the backend first** (Required for full functionality)
   
   Before running the frontend, make sure the backend is set up:
   - Navigate to the `backend/` directory
   - Follow the backend setup instructions in [`../backend/README.md`](../backend/README.md)
   - Ensure the backend `.env` file is configured with all required settings
   - The backend should be ready to run before starting the frontend

5. **Start the development server**

   **Option A: Run both frontend and backend together** (Recommended for full-stack development)
   ```bash
   npm run dev
   ```
   
   This command will start both:
   - Frontend at `http://localhost:5173`
   - Backend API at `http://localhost:8000`
   
   > **Note**: Make sure you've set up the backend first (see step 4 above)

   **Option B: Run frontend only** (If backend is already running separately)
   ```bash
   npm run frontend
   ```
   
   This will start only the frontend development server at `http://localhost:5173`
   
   > **Note**: Ensure the backend is already running at `http://localhost:8000` when using this option

### Building for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
synerx-frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Navigation.tsx
│   │   └── ...
│   ├── pages/           # Page components
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Upload.tsx
│   │   ├── Playback.tsx
│   │   ├── Analytics.tsx
│   │   └── Settings.tsx
│   ├── lib/             # Utilities and configurations
│   │   ├── supabase.ts  # Supabase client
│   │   ├── r2Config.ts  # R2 storage config
│   │   ├── types.ts     # TypeScript types
│   │   └── ...
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static assets
├── supabase/
│   ├── migrations/      # Database migrations
│   └── functions/       # Supabase Edge Functions
└── ...config files

```

## Key Features Explained

### Video Upload
- Drag-and-drop or click to upload video files
- Progress tracking during upload to R2 storage
- Automatic job submission to backend for processing

### Processing Queue
- Real-time status updates via WebSocket
- Progress tracking with percentage and messages
- Error handling and retry capabilities

### Analytics Dashboard
- Vehicle count statistics
- Compliance rate visualizations
- Historical trend analysis
- Violation type breakdown

### Video Playback
- Annotated video player
- Frame-by-frame review
- Violation timestamps
- Detection confidence scores

### Report Generation
- PDF export with charts and statistics
- Customizable date ranges
- Summary statistics and trends

## API Integration

The frontend communicates with a separate FastAPI backend that handles:
- Video processing with YOLOv8
- Vehicle detection and tracking
- Violation detection
- Database operations

**Backend endpoints used:**
- `POST /upload` - Upload video to R2
- `POST /process` - Start video processing
- `GET /jobs/{job_id}` - Get job status
- `GET /videos` - List all processed videos
- `WS /ws` - WebSocket for real-time updates

## Database Schema

The application uses the following Supabase tables:
- `videos` - Processed video metadata
- `users` - User authentication and profiles

See `supabase/migrations/` for complete schema.

## Deployment

### Netlify (Recommended)

The project includes a `netlify.toml` configuration:

1. Connect your repository to Netlify
2. Configure environment variables in Netlify dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the project: `npm run build`
2. Deploy the `dist/` directory to any static hosting service
3. Ensure environment variables are configured

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_R2_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `VITE_R2_ACCESS_KEY_ID` | R2 access key ID | Yes |
| `VITE_R2_SECRET_ACCESS_KEY` | R2 secret access key | Yes |
| `VITE_R2_BUCKET_NAME` | R2 bucket name | Yes |
| `VITE_R2_PUBLIC_URL` | R2 public URL | Yes |
| `VITE_BACKEND_URL` | Backend API URL | Yes |

## Troubleshooting

### Video Upload Issues
- Verify R2 credentials are correct
- Check CORS configuration on R2 bucket
- Ensure file size is within limits

### Processing Stuck
- Check backend API is running
- Verify WebSocket connection
- Check browser console for errors

### Authentication Issues
- Verify Supabase credentials
- Check Supabase dashboard for auth errors
- Ensure email confirmation is disabled (if using email auth)

## Development

### Code Style
- TypeScript for type safety
- Tailwind CSS for styling
- ESLint for code quality

### Adding New Features
1. Create components in `src/components/`
2. Add pages in `src/pages/`
3. Update routing in `App.tsx`
4. Add types to `src/lib/types.ts`

## Team

- **Sasindu Dilshan Ranwadana** - Team Leader
- **Quang Vinh Le**
- **Franco Octavio Jimenez Perez**
- **Janith Athuluwage**
- **Thiviru Thejan**
- **Risinu Cooray**

## Acknowledgments

- VicRoads
- Department of Transport
- V/Line
- Swinburne University of Technology

## License

This project is developed for Swinburne University of Technology.

## Support

For issues or questions, please contact the development team or create an issue in the repository.
