# Manar - Render-ready Fullstack (React + Socket.IO)

This repository is prepared for deploying to Render.com with two services:
1. manar-backend (Node + Socket.IO) — real-time signaling
2. manar-frontend (Vite React) — chat UI

## Quick deploy steps (no local build required)
1. Create a new GitHub repository (or use your existing one).
2. Push the contents of this ZIP into the repo root.
   Example:
     git init
     git add .
     git commit -m "manar initial"
     git remote add origin https://github.com/yourusername/yourrepo.git
     git push -u origin main
3. On Render.com:
   - Connect your GitHub account.
   - Create a new Web Service named `manar-backend`, pick the repo and branch. In the "Build command" use `cd backend && npm install` and "Start command" use `cd backend && npm start`.
   - Create a second Static Site (or Web Service) named `manar-frontend`, point to same repo and branch. Configure build command `cd frontend && npm install && npm run build` and publish directory `frontend/dist`.
4. After both services deploy, set `VITE_API_BASE` in frontend environment to the backend's public URL (e.g., https://manar-backend.onrender.com) in Render's Env settings for the frontend service.
5. Open the frontend URL on two phones and test: enter user ids and peer ids and send messages.

## Notes
- This setup uses Socket.IO for real-time messaging. For true P2P media (WebRTC), you'll need to implement a TURN server and client WebRTC code.
- For production-grade privacy, implement end-to-end key exchange (Signal protocol) and consider not persisting messages on the server.
