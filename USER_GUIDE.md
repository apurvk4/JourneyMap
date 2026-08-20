# Google Timeline Visualizer — Comprehensive User Guide

Welcome to **Google Timeline Visualizer**, a privacy-first, client-side web application designed to explore, analyze, animate, and export your Google Maps Timeline location history.

All processing occurs **100% locally within your browser** using Web Workers, MapLibre GL, and modern HTML5 APIs. Your location history data is never sent to any external server or third-party service.

---

## Table of Contents
1. [Getting Started](#1-getting-started)
   - [Loading Your Own Google Takeout Data](#loading-your-own-google-takeout-data)
   - [Exploring with Sample Demo Data](#exploring-with-sample-demo-data)
   - [Device Storage & Persistence](#device-storage--persistence)
2. [Interface Layout Overview](#2-interface-layout-overview)
3. [Header Controls](#3-header-controls)
   - [Theme Toggle (Dark / Light Mode)](#theme-toggle-dark--light-mode)
   - [Dataset Management](#dataset-management)
4. [Sidebar Filters & Panels](#4-sidebar-filters--panels)
   - [1. Search](#1-search)
   - [2. Date Filter & Navigation](#2-date-filter--navigation)
   - [3. Activities & Segment Type Filters](#3-activities--segment-type-filters)
   - [4. Statistics & Mode Breakdown](#4-statistics--mode-breakdown)
   - [5. Calendar Heatmap](#5-calendar-heatmap)
   - [6. Timeline Itinerary List](#6-timeline-itinerary-list)
5. [Interactive Map Experience](#5-interactive-map-experience)
   - [Survey of India Official Boundaries](#survey-of-india-official-boundaries)
   - [Route Polylines & Visit Halos](#route-polylines--visit-halos)
   - [Selected Route Start & End Markers](#selected-route-start--end-markers)
6. [Timeline Replay & Animation Engine](#6-timeline-replay--animation-engine)
   - [Playback Controls](#playback-controls)
   - [Dynamic Vehicle Badges & Instantaneous Heading Rotation](#dynamic-vehicle-badges--instantaneous-heading-rotation)
   - [Camera Follow Tracking](#camera-follow-tracking)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Data Export Options](#7-data-export-options)
   - [Available Formats (GeoJSON, GPX, KML, CSV)](#available-formats)
   - [Whole Dataset vs. Selected Segment Export](#whole-dataset-vs-selected-segment-export)
8. [Privacy & Security Guarantee](#8-privacy--security-guarantee)

---

## 1. Getting Started

When you first open Google Timeline Visualizer, you are greeted by the clean landing screen:

![Landing Page](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/01_landing.png)

### Loading Your Own Google Takeout Data
1. Export your location history from [Google Takeout](https://takeout.google.com/) under **Location History (Timeline)** in JSON format.
2. Drag and drop your `Timeline.json` (or semantic `Records.json` / `year_month.json`) file into the dashed box.
3. Alternatively, click **Choose a file** to select your file from your local disk.
4. Parsing happens in a background Web Worker with live progress indicators. Any corrupted records are safely skipped without halting import.

### Exploring with Sample Demo Data
- Click **Load demo data** at the bottom of the landing card to immediately load a rich multi-modal dataset featuring flights, trains, road trips, walking, and cycling across India.

### Device Storage & Persistence
- **"Remember this Timeline on this device (optional)"**: Check this box on the landing page if you want your parsed data stored locally in your browser's IndexedDB storage.
- If unchecked, your timeline remains strictly in RAM memory and clears as soon as you close or refresh the tab.

---

## 2. Interface Layout Overview

Once data is loaded, the application transitions to the main dashboard:

![Dark Dashboard Overview](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/02_dashboard_dark.png)

The interface consists of four primary areas:
1. **Top Header**: Application title, privacy notice, theme selector, and dataset management actions.
2. **Left Sidebar**: 6 vertically stacked interactive cards for filtering, statistics, search, calendar analysis, and segment itinerary.
3. **Main Map View**: Hardware-accelerated MapLibre GL map rendering all routes, visits, Survey of India boundaries, and animated replay markers.
4. **Bottom Replay Bar / Footer**: Playback controls, speed selector, progress scrubber, camera follow toggle, and export buttons.

---

## 3. Header Controls

### Theme Toggle (Dark / Light Mode)
You can seamlessly switch between **Dark Matter** and **Light Voyager** themes.

| Dark Theme | Light Theme |
| :--- | :--- |
| ![Dark Dashboard](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/02_dashboard_dark.png) | ![Light Dashboard](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/03_dashboard_light.png) |

- **🌙 Dark**: High-contrast, dark-mode styling optimized for low-light environments and vibrant route lines.
- **☀️ Light**: Clean, high-readability light-mode styling with subtle topographic shading.
- Your theme preference is preserved across sessions via cookie and local storage.

### Dataset Management
- **Status Indicator**: Displays current file status (e.g. `Timeline loaded` or `Restored from cache`).
- **Clear timeline data**: Clears active data from memory and wipes local IndexedDB cache.
- **Load different file**: Opens file picker to replace the current timeline with a new file without reloading the page.

---

## 4. Sidebar Filters & Panels

### 1. Search
Search across all places, semantic categories, addresses, and activities in your timeline.

![Search Filter](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/04_search.png)

- Type 2 or more characters (e.g. `Restaurant`, `Work`, `Jaipur`, `Flight`).
- Matching results display with friendly labels and occurrence counters (e.g., `3 occurrences`).
- **Clicking any result** automatically centers and zooms the map onto that location and highlights it in the timeline.

---

### 2. Date Filter & Navigation
Drill down hierarchically into specific timeframes with intuitive pill selectors and navigation arrows.

| 1. Year Selection | 2. Month Drill-down | 3. Single Day Selection |
| :--- | :--- | :--- |
| ![Date Year Filter](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/08_date_year.png) | ![Date Month Filter](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/09_date_month.png) | ![Date Day Filter](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/10_date_day.png) |

- **Date Range Summary**: Displays the active date range (e.g., `3/1/2024 – 3/31/2024` or `All history`).
- **Previous (`‹`) & Next (`›`) Buttons**: Shift the active date window forward or backward by its exact duration (e.g., jump from March to April).
- **Show all**: Resets date filtering back to your entire timeline history.
- **Today Button**: Instantly filters data to the current local day.
- **Year Pills**: Select a specific calendar year.
- **Month Pills**: Select a month (months with no recorded data are automatically disabled).
- **Day Pills**: Select an individual day to isolate single-day journeys.

---

### 3. Activities & Segment Type Filters
Filter your timeline by mode of transport and segment type.

| Filter Routes Only | Filter Flight Activity Only |
| :--- | :--- |
| ![Routes Only](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/05_routes_only.png) | ![Flight Filter](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/07_flight_filter.png) |

- **`[Routes]` & `[Visits]` Pills**: Toggle whether to show moving journeys (`Routes`), stationary places (`Visits`), or both.
- **Activity Checkboxes**: Toggle individual modes:
  - 🚗 **Driving**: Blue (`#3b82f6`)
  - 🚶 **Walking / Running**: Green (`#22c55e`)
  - 🚲 **Cycling**: Amber (`#f59e0b`)
  - 🚆 **Train / Metro / Tram**: Cyan (`#06b6d4`)
  - 🚌 **Bus**: Purple (`#8b5cf6`)
  - ✈️ **Flight**: Rose (`#f43f5e`)
  - 📍 **Visits**: Muted Slate (`#94a3b8`)
- **Show all Button**: Appears whenever any filter is active, allowing 1-click filter reset.

---

### 4. Statistics & Mode Breakdown
Get instant analytical insights calculated dynamically over your filtered dataset.

![Statistics Panel](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/13_statistics.png)

- **Summary Metric Grid**:
  - **Total distance**: Total kilometers/meters traveled.
  - **Total duration**: Moving/transit duration (stationary visit time is excluded for accurate travel metrics).
  - **Travel days**: Number of distinct days with recorded movement.
  - **Visits**: Total stationary place visits.
  - **Routes**: Total transit trips.
  - **Segments**: Combined total of all records.
- **Transport Modes**: Ranked progress bars indicating the distance percentage share of each transportation mode.
- **By Year Table**: Multi-year comparison table showing year-over-year travel distance, days, and segment count.

---

### 5. Calendar Heatmap
A GitHub-style contribution heatmap representing your daily travel activity.

![Calendar Heatmap](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/14_calendar_heatmap.png)

- Each square cell represents **1 calendar day**.
- **Color Intensity**: Darker blue indicates higher travel distance for that day.
- **Hover**: Displays tooltip with exact date and distance (e.g. `2024-03-16: 240.0 km`).
- **Click**: Immediately filters the entire dashboard and map to that single day.

---

### 6. Timeline Itinerary List
A chronological, grouped itinerary of all filtered journeys and place visits.

![Timeline List & Route Detail](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/12_segment_selected.png)

- **Date Grouping**: Sticky headers group events by date (e.g. `Fri, Mar 15, 2024`).
- **Card Items**: Shows activity badge, title, time span (`09:00 AM — 09:45 AM`), duration, and distance.
- **Click to Inspect**:
  - **For Routes**: Expands an inline drawer showing start/end latitude and longitude coordinates to 5 decimal places, verified activity type, distance, and duration.
  - **For Visits**: Expands address and verified semantic category (e.g. `Work`, `Restaurant`, `Hotel`).
  - Automatically highlights the corresponding geometry on the map with glowing start/end pins.

---

## 5. Interactive Map Experience

The map visualization is powered by MapLibre GL with custom vector layers:

### Survey of India Official Boundaries
The map incorporates official Survey of India boundary data (`india-soi.json`), ensuring accurate and legally compliant representations of Indian territories across Jammu & Kashmir, Ladakh, and Arunachal Pradesh in both dark and light modes.

### Route Polylines & Visit Halos
- **Flight Arcs**: Long-distance high-speed flights render as elegant parabolic 3D great-circle arcs rather than straight lines.
- **Route Lines**: Rendered with rounded caps and antialiased coloring matched to activity type.
- **Automatic Clustering**: Large datasets with >500 visits cluster into circle counts to maintain 60 FPS performance.

### Selected Route Start & End Markers
When any route is selected, the map highlights the trajectory and renders clear destination markers:
- 🟢 **Green Circle (`#22c55e`)**: Exact starting coordinate of the route.
- 🔴 **Red Circle (`#ef4444`)**: Exact ending/arrival coordinate of the route.

---

## 6. Timeline Replay & Animation Engine

Experience your location history as an animated, cinematic journey.

| Replay in Motion (Following Camera) | Replay Controls & Scrubber |
| :--- | :--- |
| ![Replay Playing](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/16_replay_playing.png) | ![Replay Paused](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/17_replay_paused.png) |

### Playback Controls
- **▶ Play / ⏸ Pause**: Starts or pauses timeline animation.
- **⏹ Stop**: Halts playback and resets time to the beginning of the filtered dataset.
- **Speed Selector**: Choose from `0.5x`, `1x`, `2x`, `5x`, `10x`, or `25x` playback speeds.
- **Progress Scrubber**: Drag the slider to scrub instantly to any timestamp in your trip.
- **Time & Percentage Display**: Displays current virtual timestamp (e.g., `Mar 15, 2024 02:37 PM`) and completion percentage (`xx.x%`).

### Dynamic Vehicle Badges & Instantaneous Heading Rotation
As the replay progresses, the marker icon dynamically updates to reflect the active activity mode and rotates smoothly along the forward tangent heading:
- ✈️ **Flight**: Airplane badge rotates towards destination along curved flight arc.
- 🚆 **Train**: Cyan train badge.
- 🚌 **Bus**: Purple bus badge.
- 🚗 **Driving**: Blue vehicle badge pointing in direction of motion.
- 🚶 **Walking**: Green walking pedestrian badge.
- 🚲 **Cycling**: Amber bicyclist badge.

### Camera Follow Tracking
- Check the **Follow** checkbox in the replay bar to lock the map camera to the moving marker.
- The engine automatically adjusts camera zoom: smooth wide-angle views for high-speed flights and closer zoom for street-level urban walks and drives.

### Keyboard Shortcuts
Use your keyboard to control playback without touching the mouse:
- `Space`: Toggle Play / Pause.
- `←` (Left Arrow): Step backward by 5%.
- `→` (Right Arrow): Step forward by 5%.
- `↑` (Up Arrow): Increase playback speed.
- `↓` (Down Arrow): Decrease playback speed.

---

## 7. Data Export Options

Export your timeline data in standard open GIS formats for use in Google Earth, QGIS, Strava, or spreadsheet software.

![Export Toolbar](/home/apurvk/.gemini/antigravity/brain/8e8cfc07-bfc5-4214-8d5c-c3d68d22ce8f/18_export_buttons.png)

### Available Formats
1. **🎬 Video (`.mp4` / `.webm`)**: Export animated journey videos with camera tracking, vehicle markers with directional heading, and HUD telemetry badges.
   - **Duration Presets**: 15s (Reels / Stories), 30s (Social / Timeline Overview), 60s (Cinematic Recap), or Custom duration (3s - 300s).
   - **Resolution Presets**: 1080p Full HD (1920×1080), 720p HD (1280×720), or Viewport Match.
   - **HUD Telemetry Overlay**: Includes live date/time badges, transport mode indicator, and bottom progress bar.
   - **Real-Time Progress & Cancellation**: View live completion percentage and cancel anytime.
2. **GeoJSON (`.geojson`)**: Standard RFC 7946 GeoJSON `FeatureCollection` with `LineString` routes and `Point` visits, including bounding boxes and properties.
3. **GPX (`.gpx`)**: GPS Exchange Format 1.1 with `<trk>` tracklogs for routes and `<wpt>` waypoints for visits with ISO timestamps.
4. **KML (`.kml`)**: Google Earth KML 2.2 with colored route styles, timestamps, and extended metadata.
5. **CSV (`.csv`)**: RFC 4180 flat spreadsheet format with latitude, longitude, addresses, distance, duration, and activity names.

### Whole Dataset vs. Selected Segment Export
- **Full View Export**: When no segment is selected, clicking any export button downloads all currently filtered timeline segments.
- **Single Segment Export**: When a route or visit is selected in the timeline list, the export buttons automatically update to **Selected Video**, **Selected GeoJSON**, **Selected GPX**, **Selected KML**, and **Selected CSV**, allowing you to export or record just that specific trip.

---

## 8. Privacy & Security Guarantee

- 🔒 **Zero Data Transmission**: Your files are read and processed entirely in memory inside your browser using JavaScript and Web Workers.
- 🛡️ **No Tracking or Analytics**: No tracking cookies, external telemetry, or analytics scripts are loaded.
- 💾 **Controlled Persistence**: Data is only cached in browser IndexedDB if you explicitly enable the optional "Remember this Timeline" checkbox. Disabling it or clicking "Clear timeline data" immediately purges all local storage.
- 🗺️ **Public Map Tiles**: Basemaps are retrieved from CARTO CDN tile servers; no location history or personal metadata is ever sent in tile requests.

---

*Enjoy exploring your travels with Google Timeline Visualizer!*
