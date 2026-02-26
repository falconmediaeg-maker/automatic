# Browser Automator

## Overview
A web-based browser automation tool that uses Puppeteer to perform repetitive actions in headless Chrome. Users can configure a URL, define a sequence of actions (click, type, select, wait, scroll, screenshot), set repetition count, and monitor real-time progress.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with Puppeteer for headless browser automation
- **Real-time updates**: Polling-based progress tracking (500ms interval)
- **Storage**: In-memory (no database needed - this is a task runner)

## Key Files
- `shared/schema.ts` - Action types, task config schema, progress types
- `client/src/pages/home.tsx` - Main UI with action builder, progress monitor, and logs
- `server/routes.ts` - API endpoints for start/stop/progress
- `server/automation.ts` - Puppeteer automation engine
- `server/storage.ts` - In-memory task state management

## API Endpoints
- `POST /api/task/start` - Start automation with config (url, actions, repetitions)
- `POST /api/task/stop` - Stop running automation
- `GET /api/task/progress` - Get current progress and logs

## Supported Actions
- **Click** - Click on element by CSS selector
- **Type** - Type text into element by CSS selector
- **Select** - Select dropdown option by value
- **Wait** - Wait for specified milliseconds
- **Scroll** - Scroll page by pixel amount
- **Screenshot** - Take a screenshot

## How It Works
1. Each repetition launches a fresh headless browser in incognito mode
2. Navigates to the target URL
3. Executes all configured actions in sequence
4. Closes the browser completely
5. Waits the configured delay, then opens a new browser for the next repetition
