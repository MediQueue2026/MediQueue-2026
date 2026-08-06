# MediQueue — Medical Center Management System

**MediQueue** is an intelligent web-based Medical Center Management System designed to eliminate overcrowded waiting rooms, enforce hourly appointment limits, track doctor delays in real-time, and manage repeat no-shows through automated late-number queue assignments.

---

## 🏗️ Repository Architecture

The project is structured into two decoupled sub-directories:

```
MediQueue-2026/
├── frontend/                     # React 19 + TypeScript + Vite + Tailwind v4 + React Router v6
│   ├── src/
│   │   ├── components/           # Reusable UI & Modal components
│   │   ├── context/              # AuthContext & State management
│   │   ├── pages/                # Isolated Page Modules for Team Members
│   │   │   ├── LandingPage.tsx   # ① Public Landing Page & Map Search
│   │   │   ├── PatientDashboard.tsx # ② Patient Portal & Slot Booking
│   │   │   ├── DoctorPanel.tsx   # ③ Doctor Management & Delay Notice
│   │   │   ├── ReceptionistDesk.tsx # ④ Reception Desk & Walk-in Tokens
│   │   │   ├── AdminPanel.tsx    # ⑤ System Admin Console
│   │   │   └── TvDisplayPage.tsx # Public Waiting Room Screen
│   │   ├── App.tsx               # Main Router Setup
│   │   └── index.css             # Glassmorphism & Modern Utility Design System
│   └── package.json
│
├── backend/                      # Node.js + Express + Supabase REST API Server
│   ├── src/
│   │   ├── config/               # Supabase SDK & Flexible Twilio/Mock Provider
│   │   ├── controllers/          # Business logic controllers per feature
│   │   ├── middleware/           # JWT Auth & Role-Based Access Control (RBAC)
│   │   ├── services/             # Core business rules (Slot Limiter, No-Show Penalty, SMS)
│   │   ├── db/
│   │   │   └── schema.sql        # Supabase PostgreSQL DDL Script
│   │   └── server.js             # Express API Server Entry Point
│   └── package.json
└── README.md
```

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, React Router v6.
- **Backend**: Node.js, Express.js, `@supabase/supabase-js`, Twilio SDK (Pluggable with Mock SMS fallback).
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Storage).

---

## 👥 6-Member Team Task Allocation Matrix

To prevent code overwrites and Git merge conflicts, each team member is assigned ownership over specific pages and backend services:

| Member | Focus Area | Frontend Files Owned | Backend Files Owned | Key BRD / FR Requirements |
|---|---|---|---|---|
| **Member 1 (Lead)** | **Auth & Shared Setup** | `src/context/AuthContext.tsx`, `src/routes/` | `middleware/authMiddleware.js`, `db/schema.sql` | Role-Based Access Control, Auth Security |
| **Member 2** | **Public Landing & Map** | `src/pages/LandingPage.tsx` | `controllers/centerController.js` | BR-04, FR-05, FR-11 (Medical Center Map & Search) |
| **Member 3** | **Patient Dashboard & Booking** | `src/pages/PatientDashboard.tsx` | `controllers/appointmentController.js`, `services/slotLimiterService.js` | BR-01, BR-06, FR-02, FR-08, FR-09 (Slot Booking & Records) |
| **Member 4** | **Doctor Panel & Delays** | `src/pages/DoctorPanel.tsx` | `controllers/doctorController.js`, `services/notificationService.js` | BR-05, FR-06, FR-07, FR-12 (Status Updates & Delays) |
| **Member 5** | **Receptionist & SMS** | `src/pages/ReceptionistDesk.tsx`, `src/pages/TvDisplayPage.tsx` | `services/noShowService.js`, `config/notification.js` | BR-03, FR-04, FR-07 (Walk-in Tokens & Repeat No-Shows) |
| **Member 6** | **Admin Panel & Rules** | `src/pages/AdminPanel.tsx` | `controllers/adminController.js` | BR-02, BR-07, FR-10, FR-12 (Max Slots & System Roster) |

---

## ⚡ Quick Start Guide (Local Setup)

### Prerequisites
Make sure you have installed:
- [Node.js (v18 or higher)](https://nodejs.org/)
- [Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-org/MediQueue-2026.git
cd MediQueue-2026
```

---

### Step 2: Environment Variables Setup (`.env`)

#### 1. Backend Environment Setup:
Copy `.env.example` to `.env` inside the `backend` folder:
```bash
cd backend
cp .env.example .env
```
Open `backend/.env` and configure your credentials:
```env
PORT=5000
NODE_ENV=development

# Supabase Project Credentials (from supabase.com)
SUPABASE_URL=https://your-supabase-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Notification Provider Config ('mock' for local dev, 'twilio' for real SMS)
NOTIFICATION_PROVIDER=mock

# Twilio Config (Optional if NOTIFICATION_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

#### 2. Frontend Environment Setup:
Copy `.env.example` to `.env` inside the `frontend` folder:
```bash
cd ../frontend
cp .env.example .env
```

---

### Step 3: Database Setup (Supabase SQL Migration)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Open your Supabase Project Dashboard → **SQL Editor**.
3. Open `backend/src/db/schema.sql` from this repository, copy all contents, and click **Run**.
4. This initializes all 6 PostgreSQL tables (`users`, `medical_centers`, `doctors`, `appointments`, `doctor_subscriptions`, `health_records`).

---

### Step 4: Running the Applications Locally

#### Option A: Running the Frontend Client
```bash
cd frontend
npm install
npm run dev
```
Open your browser at **`http://localhost:8443`**.
- You can navigate between pages using the top Dev Bar or directly visit `/`, `/patient`, `/doctor`, `/receptionist`, `/admin`, or `/tv-display`.

#### Option B: Running the Backend API Server
Open a separate terminal window:
```bash
cd backend
npm install
npm run dev
```
The REST API server will run on **`http://localhost:5000`** with live auto-reload via Nodemon.

---

### Step 5: Building for Production
To verify that your code compiles cleanly before submitting a pull request:
```bash
cd frontend
npm run build
```

---

## 🤝 Contribution Guidelines for Team Members

1. **Never edit someone else's page directly**: Work inside your assigned file in `frontend/src/pages/` and controller in `backend/src/controllers/`.
2. **Keep `.env` private**: Never commit your `.env` file to Git (`.env` is strictly listed in `.gitignore`).
3. **Git Branching Workflow**:
   ```bash
   git checkout -b feature/member-name-feature
   git add .
   git commit -m "feat: add patient slot selection component"
   git push origin feature/member-name-feature
   ```
