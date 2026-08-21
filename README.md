# Timeline Visualizer

A privacy-first, browser-native web application to visualize Google Maps Timeline exports. All location data is parsed and processed **entirely in your browser** — nothing is ever uploaded to any server.

## Features

### Core
- **Drag & drop** or file picker for Google Timeline JSON
- **Multi-format parser** — supports 2024+ `semanticSegments`, older `timelineObjects`, and legacy exports
- **Web Worker** parsing — large files are processed off the main thread with progress updates
- **Normalized data model** — raw Google JSON is never exposed to UI components

### Visualization
- **Interactive map** powered by MapLibre GL JS
- **Color-coded routes** by transportation mode (driving, walking, cycling, bus, train, flight, etc.)
- **Visit markers** rendered as circle layers on the map
- **Click-to-select** routes and visits with detail highlighting

### Navigation
- **Year / Month / Day** drill-down date filtering with pill buttons
- **Activity type filters** (checkboxes by transport mode)
- **Calendar heatmap** — GitHub-style contribution graph based on daily travel distance
- **Local search** across places, addresses, and activity types

### Statistics
- Total distance, duration, travel days
- Visit and route counts
- Transport mode breakdown with percentage bars
- Year-over-year comparison table

### Journey Timeline
- Day-grouped itinerary view with timestamps, duration, and distance
- Place details with semantic type and address
- Click-to-zoom on selected segments

### Replay
- Animated marker along route geometry
- Play, pause, stop controls
- Speed: 0.5x – 25x
- Camera-follow toggle
- Respects `prefers-reduced-motion`

### Export
- GeoJSON (routes as LineStrings, visits as Points)
- GPX
- KML
- CSV

### Privacy
- **No backend** — the entire application is static HTML/JS/CSS
- Timeline data never leaves the browser
- No analytics, no logging, no cloud storage
- Map tiles are fetched from an external provider (the default is Carto); that provider can infer viewed map areas from tile requests.

---

## Architecture

```
Google Timeline JSON
        │
        ▼
   Parser / Adapter (src/core/parser)
        │
        ▼
  Normalized Timeline Model (src/core/model.ts)
        │
        ├─► Map rendering (MapLibre GL JS)
        ├─► Statistics engine (src/core/statistics)
        ├─► Replay engine (src/core/replay)
        ├─► Calendar heatmap
        ├─► Filtering & search
        └─► Exporters (GeoJSON, GPX, KML, CSV)
```

### Key Design Decisions
- **Raw Google data never leaks into UI**: all components consume the normalized `TimelineSegment` model
- **Centralized state**: React Context store (`src/stores/TimelineStore.tsx`) replaces ad-hoc DOM events
- **Independent replay engine**: `ReplayEngine` class is UI-agnostic, using `requestAnimationFrame` and callbacks
- **Defensive parser**: malformed segments are skipped, not fatal; multiple timestamp/coordinate formats supported

---

## Setup

### Prerequisites
- Node.js 18+
- npm

### Install
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

The `dist/` directory can be deployed to any static hosting provider (GitHub Pages, Cloudflare Pages, Vercel, Netlify, etc.).

### Test
```bash
npm run test
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_MAP_STYLE_URL` | MapLibre GL style URL | `https://demotiles.maplibre.org/style.json` |

Example with a custom tile provider:
```bash
VITE_MAP_STYLE_URL="https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY" npm run dev
```

When deploying with a custom provider, update the deployed Content Security Policy to allow that provider's style, tile, sprite, and glyph domains. The bundled policy intentionally permits only the default Carto CDN.

---

## Supported Timeline Formats

### 2024+ Export (semanticSegments)
```json
{
  "semanticSegments": [
    {
      "startTime": "2024-03-15T09:00:00.000Z",
      "endTime": "2024-03-15T09:45:00.000Z",
      "activity": { "topCandidate": { "type": "IN_PASSENGER_VEHICLE" } },
      "timelinePath": [
        { "point": "geo:28.6139,77.2090", "time": "2024-03-15T09:00:00Z" }
      ]
    }
  ]
}
```

### Older Export (timelineObjects)
```json
{
  "timelineObjects": [
    {
      "placeVisit": {
        "location": { "latitudeE7": 286139000, "longitudeE7": 772090000 },
        "duration": { "startTimestampMs": "1696003600000" }
      }
    }
  ]
}
```

The parser automatically detects the format and normalizes all data.

---

## Project Structure

```
src/
├── app/App.tsx              # App shell & layout
├── components/
│   ├── upload/Upload.tsx     # Landing page + file upload
│   ├── map/MapView.tsx       # MapLibre GL map with layers
│   ├── filters/
│   │   ├── DateFilter.tsx    # Year/Month/Day navigation
│   │   └── ActivityFilter.tsx # Transport mode checkboxes
│   ├── statistics/Statistics.tsx  # Stats grid + breakdown
│   ├── calendar/CalendarHeatmap.tsx  # Travel heatmap
│   ├── visits/VisitList.tsx  # Day-grouped itinerary
│   ├── replay/ReplayControls.tsx  # Playback + export buttons
│   └── search/Search.tsx     # Local timeline search
├── core/
│   ├── model.ts              # Normalized data types
│   ├── parser/index.ts       # Multi-format parser
│   ├── geo.ts                # Haversine, interpolation, utils
│   ├── statistics/index.ts   # Statistics engine
│   ├── replay/index.ts       # ReplayEngine class
│   ├── exporters/            # GeoJSON, GPX, KML, CSV
│   └── storage/index.ts      # IndexedDB persistence
├── stores/TimelineStore.tsx   # Centralized React state
├── sample/demo-timeline.json  # Synthetic demo data
├── __tests__/                 # Vitest test suite (55 tests)
└── styles.css                 # Global dark theme
workers/
└── timeline.worker.ts         # Web Worker for parsing
```

---

## Performance

- **Web Worker parsing**: large JSON files (100MB+) are parsed off the main thread
- **Efficient map rendering**: GeoJSON sources + vector layers (no individual DOM markers)
- **Data-driven styling**: route colors use MapLibre `['get', 'color']` expressions
- **Memoized computations**: statistics, filters, and derived data use `useMemo`
- **Large data stays outside reactive state**: `TimelineData` lives in a `useRef`, not `useState`
- **Opt-in persistence**: normalized data is stored in IndexedDB only when the user enables “Remember this Timeline”

---

## CI status

[![CI](https://github.com/apurvk4/JourneyMap/actions/workflows/ci.yml/badge.svg)](https://github.com/apurvk4/JourneyMap/actions/workflows/ci.yml)

## Browser Support

- Chrome 90+
- Firefox 90+
- Edge 90+

---

## Demo Data

Click **"Load demo data"** on the landing page to explore the application with synthetic data (fictional coordinates in India, multiple activity types across 4 days).

**No real personal location data is included.**

---

## Limitations

- Map tile styling depends on the configured tile provider (demo tiles are basic)
- Video and PNG/SVG export are future work; GeoJSON, GPX, KML, and CSV are available now
- Service worker / offline mode not yet implemented
- Place names depend on what Google includes in the export (not reverse-geocoded)
- The application does not perform reverse geocoding to determine cities or countries

---

## Future Roadmap

- [ ] Video export via WebCodecs / ffmpeg.wasm
- [ ] PNG/SVG map snapshot export
- [ ] Service worker for offline support
- [ ] IndexedDB persistence toggle in settings
- [ ] Reverse geocoding for city/country estimation
- [ ] Cluster visualization for large visit datasets
- [ ] Route comparison between time periods

---

## Security & Privacy

This application processes **sensitive personal location data**. The architecture ensures:

- ✅ All processing happens in the browser
- ✅ No server-side upload or storage
- ✅ No analytics containing location data
- ✅ No location data in URLs or query parameters
- ✅ No third-party tracking of user coordinates
- ❌ Map tile requests are made to the configured tile provider (necessary for rendering)

---

## License

MIT
