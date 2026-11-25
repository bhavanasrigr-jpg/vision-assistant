# Vision Assistant

An accessible visual assistant built with React, Vite, and an optional FastAPI AI backend. It includes a real browser camera workflow, in-browser OCR, speech input/output, local activity history, configurable accessibility settings, and clearly labeled demo responses when an AI service is not configured.

> **Important:** Scene descriptions and object detection require the optional backend and a compatible vision model. Without it, responses are explicitly marked as demonstrations and do not analyze the submitted image. The app is not a safety device; do not rely on it to detect hazards or make urgent decisions.

## Features

- Demo sign-in screen with email/password fields, password visibility toggle, remember-me, and a password-recovery explanation. No real accounts are created and passwords are never saved or sent; this is a UI gate, not security.
- Responsive dashboard with working navigation to all features.
- Camera permission flow, live preview, camera switching where supported, still capture, and image upload.
- Scene-description and object-detection API integration points; images are only submitted after the user presses the analysis action.
- OCR using Tesseract.js in the browser. OCR images are not sent to the backend or stored.
- Speech synthesis controls, and Web Speech API speech recognition where supported with a text-input alternative.
- Local-only activity summaries, searchable history, feature filters, detail view, and deletion.
- Persisted voice, language, camera, theme, and accessibility preferences.
- Keyboard navigation, visible focus, screen-reader labels, reduced-motion support, large controls, and an accessibility mode.

## Requirements

- Node.js 18+ and npm.
- Python 3.10+ for the optional API backend.
- A modern browser. Camera and microphone access require permission and a secure context; `localhost` is treated as secure by browsers.

## Run the frontend

From the project root:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). OCR downloads the Tesseract.js worker and English language data the first time it is used, so an internet connection is needed for that initial load.

To enter the demo, use any valid email address and a non-empty password. “Remember me” stores only the demo session and email on this device. Without it, the demo session lasts for the current browser tab. Use the profile menu to sign out.

### Run from VS Code

Open the project root folder in VS Code. After installing the backend dependencies below, select **Terminal → Run Task → Vision Assistant: Run locally** to start both services in dedicated terminals. Open `http://127.0.0.1:5173` in a browser.

## Run the optional backend

In a second terminal from the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` and set `VISION_API_KEY` and `VISION_MODEL` for an OpenAI-compatible Chat Completions endpoint. `VISION_API_URL` defaults to the OpenAI API base URL; set it to your provider's compatible base URL if needed. Do not put credentials in frontend environment variables or commit `.env`.

Start the API from the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

Health check: `http://localhost:8000/api/health`. The frontend calls `http://localhost:8000` by default. To use another backend origin, create a root `.env` with `VITE_API_BASE_URL=http://your-backend-host:8000` and restart Vite.

### API endpoints

- `GET /api/health` — service status and whether AI credentials are configured.
- `POST /api/vision/describe` — image scene description (base64 image data URL).
- `POST /api/vision/detect` — object names (base64 image data URL).
- `POST /api/assistant/ask` — text question and answer.
- `POST /api/ocr/read` — reserved endpoint; returns `501` because OCR is performed locally by the browser.

The backend validates image type and size (10 MiB default), bounds question length, reports upstream errors, and only reads credentials from environment configuration. Change `MAX_IMAGE_BYTES` and `CORS_ORIGINS` in the backend environment as appropriate.

## Build for production

```powershell
npm run build
npm run preview
```

## Deploy the frontend to GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. Push the project to a GitHub repository on the `main` branch, then in **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. The workflow builds Vite using the repository name as its Pages base path and publishes the frontend.

GitHub Pages hosts static files only. The published frontend works in demo mode (including browser OCR and browser speech features) until a compatible FastAPI backend is deployed separately. To connect one, set the repository Actions variable `VITE_API_BASE_URL` to the public HTTPS URL of the backend. Configure the backend's `CORS_ORIGINS` to include the GitHub Pages origin and set model credentials as environment secrets on the backend host; do not put API keys in GitHub Pages variables or frontend code.

## Privacy notes

- The camera starts only after the user requests it. No continuous camera frames are uploaded.
- A still image is submitted to the backend only after selecting the analysis action. Configured AI providers receive that image for processing.
- Images are not written to local storage or activity history. OCR is local to the browser.
- History stores activity type, time, query, result summary, and status on this device. Clear it from History or Settings.
- Avoid capturing sensitive personal information. Demo mode is not genuine AI analysis.
