# NEARNECT

NearNect — Home service booking platform (frontend + Express API)

## Contents
- Frontend: static HTML/CSS/JS in root
- Server: `server/` (Express, Mongoose)
- Database: MongoDB

## Requirements
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Optional: Razorpay account for payments

## Quick setup (development)

1. Copy env example files and fill secrets (DO NOT COMMIT `.env`):

   - Root: copy `.env.example` -> `.env` and fill values
   - Server: copy `server/.env.example` -> `server/.env` and fill values

2. Install dependencies and run server:

```powershell
cd "C:\Users\Asus\OneDrive\Desktop\NEARNECT" 
npm install --workspaces --legacy-peer-deps # if using workspaces; otherwise run in server/
cd server
npm install
npm run dev   # or `node index.js` / use nodemon
```

3. Open frontend files from the project root in the browser (or serve them via a static server).

## Environment variables
Use `server/.env.example` and `.env.example` as a reference. Important variables:

- `MONGO_URI` – MongoDB connection string (use Atlas or local URI)
- `JWT_SECRET` – Strong random secret for JWT signing
- `EMAIL_USER`, `EMAIL_PASSWORD` – SMTP credentials (use app passwords)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` – Payment gateway keys

## Security notes
- Do NOT commit `.env` or any credentials. `.gitignore` already excludes envs.
- If secrets were ever committed, scrub history with `git filter-repo` or BFG. Ask me and I can prepare steps.

## Dev checklist
- [ ] Fill `server/.env` with production-safe secrets
- [ ] Protect `main` branch on GitHub (disable force push)
- [ ] Configure CI / deployment (Heroku, Vercel, or container)
- [ ] Rotate any credentials found in the repository (e.g., DB users, API keys)

## Contributing
Create feature branches, open PRs targeting `main`, and run lint/tests (if added).

---
_If you'd like, I can also add a minimal `package.json` script for running frontend via a static server, add a `.github/workflows` CI stub, or prepare a history-scrub PR to completely remove previously committed secrets._