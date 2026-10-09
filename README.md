# CHAOS BUTTON

A small interactive decision game: describe a moment, reveal one of five fixed narrative outcomes, and decide what fits. The model classifies the input; all titles and descriptions are predefined in the browser.

## Architecture

- `index.html`, `styles.css`, `app.js` provide the responsive, accessible experience, confidence thresholds and local result copy.
- `api/decide.js` validates the input and makes one server-side Jev evaluation request. It only returns an allowed category and its probability map.
- `server.js` is a dependency-free local server that also serves `/api/decide`.

## Run locally

Requires Node.js 18 or later. No package installation is needed.

```powershell
$env:AI_GATEWAY_API_KEY="your-key-here"
node server.js
```

Open `http://localhost:3000`. The key is optional for viewing the page but required for a real reveal. For local development, `.env` is also supported and ignored by Git; copy `.env.example` and set the value locally.

## Configure and deploy to Vercel

1. Import this repository in Vercel as a new project. No build step is required.
2. Open **Settings → Environment Variables** and add `AI_GATEWAY_API_KEY` for the environments you use. Enter the credential directly in Vercel; do not put its value in source files, chat, or commits.
3. Redeploy after adding or changing the variable, then open the deployment URL and submit a situation.

The key is read only by `api/decide.js`. The browser calls `/api/decide`, never the AI gateway. The live integration has not been verified here because no API key was provided.

## Outcome behavior

At 80% confidence or above, the selected predefined outcome is revealed. From 55% through below 80%, the user chooses between the top two outcomes. Below 55%, the user chooses from all five. `intermission` is shown directly at any confidence. The confidence displayed comes from the evaluation response; it is not a prediction guarantee.
