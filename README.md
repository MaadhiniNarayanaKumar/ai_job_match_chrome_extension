# AI Job Match

Side panel for the local job-match API. It scores a posting against a resume and asks Gemini for a priority-ordered skill list.

## Try it in the browser

Start the API from `ai_job_match_chrome_extension_backend`, then from this folder:

```bash
python3 -m http.server 4173
```

Open http://127.0.0.1:4173/panel.html. Paste a resume and a posting, then use Score or Analyze. Read open tab is only available in Chrome.

## Load the extension

1. Chrome → Extensions → Developer mode → Load unpacked → this folder.
2. Click the toolbar icon. The side panel opens.
3. Paste or upload a resume, open a job tab, then choose Read open tab.

The API must be running at http://127.0.0.1:8000.
