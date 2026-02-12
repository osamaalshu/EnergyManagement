# Energy Management Dashboard

A modular energy analytics dashboard built with React, TypeScript, and Vite. The application provides interactive visualization of energy consumption, cost trends, and savings analysis through configurable widgets and a responsive layout system.

The project is structured for maintainability, deployment stability, and future expansion toward real data integration.

---

## Overview

This dashboard is designed to support:

* Visualization of energy consumption metrics
* Savings and cost trend analysis
* Editable and responsive widget layouts
* Dark and light theme support
* Deployment on Netlify as a Single Page Application

The current implementation uses mock data and is structured to support future API integration.

---

## Technology Stack

* React 19
* TypeScript
* Vite
* Tailwind CSS
* Recharts
* react-grid-layout
* ESLint

Vite documentation:
[https://vite.dev/guide/](https://vite.dev/guide/)

Recharts documentation:
[https://recharts.org/en-US](https://recharts.org/en-US)

react-grid-layout documentation:
[https://github.com/react-grid-layout/react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)

---

## Project Structure

```
src/
  components/      Reusable UI components
  pages/           Route-level views (Dashboard, Savings)
  data/            Mock data sources
  lib/             Shared utilities and helpers
  App.tsx
  main.tsx
```

### Architectural Principles

* Pages compose reusable components rather than containing heavy logic.
* Widgets remain modular and isolated.
* Mock data is centralized under `src/data/`.
* Styling follows consistent Tailwind patterns.
* Dark mode is implemented using theme-aware styling.
* The application is prepared for route-based navigation if expanded.

---

## Core Features

### Dashboard

* Draggable and resizable widgets
* Edit mode toggle
* Layout organization functionality
* Chart-based energy visualizations

### Savings View

* Summary metric cards
* Cost trend and savings analysis charts
* Responsive grid layout

### Theme System

* Light and dark mode support
* Consistent styling patterns
* Chart theming aligned with application theme

---

## Running Locally

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Type checking

```bash
npm run typecheck
```

If `typecheck` is not defined, add the following script to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc -b --pretty false"
  }
}
```

### Production build

```bash
npm run build
```

The production output is generated in the `dist/` directory.

---

## Netlify Deployment

This application is deployed on Netlify as a Single Page Application.

### Required Settings

Build command:

```
npm run build
```

Publish directory:

```
dist
```

Node version:

```
20
```

### netlify.toml Configuration

A `netlify.toml` file should exist at the root of the repository:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

Netlify documentation:
[https://docs.netlify.com/frameworks/vite/](https://docs.netlify.com/frameworks/vite/)

---

## Development Guardrails

To maintain stability and prevent regressions:

* The application must build successfully before merging changes.
* No TypeScript or ESLint errors should be introduced.
* The build output directory must remain `dist/`.
* Layout changes must not cause widgets to overlap or disappear.
* Dark mode must remain readable and consistent.

Recommended scripts:

```json
{
  "scripts": {
    "check": "npm run lint && npm run typecheck && npm run build"
  }
}
```

---

## Future Enhancements

Planned improvements may include:

* Persistent layout storage
* API-based data integration
* Advanced filtering (date range, site, tariff)
* Alerting and anomaly detection
* Authentication and user preferences
* CI/CD enforcement via GitHub Actions

---

## License

This project is intended for internal development and experimentation unless otherwise specified.
