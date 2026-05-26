# Job Search HQ

A personal job search management dashboard — lightweight, offline-first, zero dependencies.

## Features

- **Checklist** — setup to-do list with progress bar (resume, LinkedIn, STAR stories, etc.)
- **Pipeline** — Kanban drag-and-drop board across 5 stages: Researching → Applied → Phone screen → Onsite → Offer
- **Projects** — project tracker with status cycling (Not Started / In Progress / Done)
- **Interview Prep** — categorized checklist by topic and weight (Behavioral, System Design, Org/Strategy, Coding)
- **Notes** — timestamped free-text notes (recruiter intel, comp data, interview debriefs)

All data lives in `data.json` and is loaded/saved locally — nothing leaves your machine.

## Getting Started

**Requires:** Node.js

```bash
git clone <repo-url>
cd job-search-hq
node scripts/server.js
```

Then open **http://localhost:8080** in your browser.

> ⚠️ Open via `http://localhost:8080`, not by double-clicking `index.html`. The save feature requires the local server.

## Usage

| Action | How |
|---|---|
| Load data | Opens automatically from `data.json` on startup |
| Save changes | Click **💾 Save** in the toolbar — writes directly to `data.json` |
| Export a copy | Click **Export JSON** — downloads a copy to your Downloads folder |
| Move an application | Drag the card to a different pipeline column |
| Cycle project status | Click the coloured dot next to the project name |

## Project Structure

```
job-search-hq/
├── index.html          # UI — HTML + CSS
├── data.json           # Your data (checklist, pipeline, projects, prep, notes)
├── scripts/
│   ├── main.js         # All app logic (render, state, file load/save)
│   └── server.js       # Local HTTP server — serves files + handles POST /save
└── README.md
```

## How Save Works

The browser fetches `data.json` on load (`GET /data.json`) and POSTs back on save (`POST /save`). The server writes the payload directly to `data.json` on disk — no cloud, no account, no sync.

## Data Format

`data.json` schema:

```json
{
  "checklist": [{ "id": "c1", "text": "...", "done": false }],
  "pipeline":  [{ "id": "a1", "company": "...", "role": "...", "level": "Staff", "stage": "Applied" }],
  "projects":  [{ "id": "p1", "name": "...", "desc": "...", "status": "In Progress" }],
  "prep": {
    "behavioral": [{ "id": "b1", "text": "...", "done": false }],
    "sysdesign":  [{ "id": "s1", "text": "...", "done": false }],
    "coding":     [{ "id": "co1", "text": "...", "done": false }],
    "strategy":   [{ "id": "st1", "text": "...", "done": false }]
  },
  "notes": [{ "id": "id123", "text": "...", "ts": "5/25/2026, 12:00:00 PM" }]
}
```

Pipeline stages: `Researching` | `Applied` | `Phone screen` | `Onsite` | `Offer`

Project statuses: `Not Started` | `In Progress` | `Done`
