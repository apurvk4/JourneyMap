import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTimeline } from '../../stores/TimelineStore';
import { ACTIVITY_DISPLAY } from '../../core/model';
import type { Coordinate } from '../../core/model';
import { computeBounds } from '../../core/geo';
import { simplifyPolyline, epsilonForZoom } from '../../core/simplify';
import { ReplayEngine } from '../../core/replay';
import indiaBoundary from '../../assets/india-soi.json';

const UNIFIED_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-dark-tiles',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: 'carto-light-tiles',
      type: 'raster',
      source: 'carto-light',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Colors for routes by activity type
function getRouteColor(type: string | undefined): string {
  return ACTIVITY_DISPLAY[type ?? 'UNKNOWN']?.color ?? '#64748b';
}

/** Add India SOI boundary overlay to the map. Idempotent & self-healing. */
function addIndiaBoundaryLayer(map: maplibregl.Map, theme: string): void {
  if (!map.isStyleLoaded()) return;

  const isLight = theme === 'light';
  // High-contrast, solid, uniform boundary in both themes
  const lineColor = isLight ? '#1e40af' : '#bfdbfe';
  const glowColor = isLight ? 'rgba(37, 99, 235, 0.4)' : 'rgba(96, 165, 250, 0.45)';
  const fillColor = isLight ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.04)';

  if (!map.getSource('india-boundary')) {
    map.addSource('india-boundary', {
      type: 'geojson',
      data: indiaBoundary as GeoJSON.FeatureCollection,
    });
  }

  if (!map.getLayer('india-boundary-fill')) {
    map.addLayer({
      id: 'india-boundary-fill',
      type: 'fill',
      source: 'india-boundary',
      paint: {
        'fill-color': fillColor,
      },
    });
  } else {
    map.setPaintProperty('india-boundary-fill', 'fill-color', fillColor);
  }

  if (!map.getLayer('india-boundary-glow')) {
    map.addLayer({
      id: 'india-boundary-glow',
      type: 'line',
      source: 'india-boundary',
      paint: {
        'line-color': glowColor,
        'line-width': 5,
        'line-blur': 2,
      },
    });
  } else {
    map.setPaintProperty('india-boundary-glow', 'line-color', glowColor);
  }

  if (!map.getLayer('india-boundary-line')) {
    map.addLayer({
      id: 'india-boundary-line',
      type: 'line',
      source: 'india-boundary',
      paint: {
        'line-color': lineColor,
        'line-width': 2.5,
        'line-opacity': 1,
      },
    });
  } else {
    map.setPaintProperty('india-boundary-line', 'line-color', lineColor);
  }
}

function createActivityMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'custom-replay-marker marker-default';
  el.innerHTML = `
    <div class="marker-pulse-ring"></div>
    <div class="marker-icon-wrapper">
      <div class="marker-dot"></div>
    </div>
  `;
  return el;
}

function updateActivityMarkerElement(
  el: HTMLElement,
  activityType?: string,
  isFlight?: boolean,
  bearing?: number,
): void {
  const wrapper = el.querySelector('.marker-icon-wrapper') as HTMLElement | null;
  if (!wrapper) return;

  let activityClass = 'marker-default';
  let svgContent = '<div class="marker-dot"></div>';

  if (isFlight || activityType === 'FLYING') {
    activityClass = 'marker-flight';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
  } else if (activityType === 'IN_TRAIN' || activityType === 'TRAIN' || activityType === 'IN_SUBWAY' || activityType === 'IN_TRAM') {
    activityClass = 'marker-train';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`;
  } else if (activityType === 'BUS' || activityType === 'IN_BUS') {
    activityClass = 'marker-bus';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`;
  } else if (activityType === 'DRIVING' || activityType === 'MOTORCYCLING') {
    activityClass = 'marker-drive';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
  } else if (activityType === 'WALKING' || activityType === 'RUNNING') {
    activityClass = 'marker-walk';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>`;
  } else if (activityType === 'CYCLING') {
    activityClass = 'marker-cycle';
    svgContent = `<svg class="marker-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.4-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14.5V20h2v-6.5l-2.2-3.7zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>`;
  }

  el.className = `custom-replay-marker ${activityClass}`;
  if (wrapper.innerHTML !== svgContent) {
    wrapper.innerHTML = svgContent;
  }

  const svgEl = wrapper.querySelector('.marker-icon-svg') as HTMLElement | null;
  if (svgEl && bearing !== undefined) {
    svgEl.style.transform = `rotate(${Math.round(bearing)}deg)`;
  }
}

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const replayMarkerRef = useRef<maplibregl.Marker | null>(null);
  const replayMarkerElRef = useRef<HTMLDivElement | null>(null);
  const replayEngineRef = useRef<ReplayEngine | null>(null);
  const loadedReplaySourceRef = useRef<string>('');
  const { filteredSegments, segmentsByYear, totalPointCount, years, state, dispatch } = useTimeline();
  const createdLayersRef = useRef<string[]>(['selected-line', 'selected-point', 'selected-endpoints']);
  const createdSourcesRef = useRef<string[]>(['selected']);
  const isFlyingRef = useRef<boolean>(false);
  const initialReplayFlyDoneRef = useRef<boolean>(false);
  const lastAppliedThemeRef = useRef<string>(state.theme);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    try {
      lastAppliedThemeRef.current = state.theme;
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || UNIFIED_MAP_STYLE,
        center: [77.2, 28.6],
        zoom: 2,
        attributionControl: true,
      });
      map.addControl(new maplibregl.NavigationControl({}), 'top-right');
      map.on('load', () => {
        if (map.getLayer('carto-dark-tiles')) {
          map.setLayoutProperty('carto-dark-tiles', 'visibility', state.theme === 'dark' ? 'visible' : 'none');
        }
        if (map.getLayer('carto-light-tiles')) {
          map.setLayoutProperty('carto-light-tiles', 'visibility', state.theme === 'light' ? 'visible' : 'none');
        }
        addIndiaBoundaryLayer(map, state.theme);
      });
      mapRef.current = map;
      (window as unknown as { __map?: maplibregl.Map }).__map = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (e) {
      console.warn('Maplibre failed to initialize:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map tiles and boundary when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('carto-dark-tiles')) {
      map.setLayoutProperty('carto-dark-tiles', 'visibility', state.theme === 'dark' ? 'visible' : 'none');
    }
    if (map.getLayer('carto-light-tiles')) {
      map.setLayoutProperty('carto-light-tiles', 'visibility', state.theme === 'light' ? 'visible' : 'none');
    }
    addIndiaBoundaryLayer(map, state.theme);
  }, [state.theme]);

  // Build GeoJSON sources and layers from filtered segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      // Ensure official Survey of India boundary is present and matching current theme
      addIndiaBoundaryLayer(map, state.theme);

      // Remove old layers/sources
      for (const l of createdLayersRef.current) {
        if (map.getLayer(l)) map.removeLayer(l);
      }
      createdLayersRef.current = [];
      for (const s of createdSourcesRef.current) {
        if (map.getSource(s)) map.removeSource(s);
      }
      createdSourcesRef.current = [];

      if (filteredSegments.length === 0) return;

      const shouldSimplify = totalPointCount > 100000;
      const epsilon = shouldSimplify ? epsilonForZoom(map.getZoom()) : 0;
      
      for (const y of years) {
         const segs = segmentsByYear[y] || [];
         const routeFeatures = segs.filter(s => s.type === 'route' && s.points.length >= 2).map(s => {
           let pts = s.points.map(p => p.coordinate);
           if (shouldSimplify) pts = simplifyPolyline(pts, epsilon);
           const coords = pts.map(p => [p.longitude, p.latitude] as [number, number]);
           return {
             type: 'Feature' as const,
             geometry: { type: 'LineString' as const, coordinates: coords },
             properties: { id: s.id, color: getRouteColor(s.activity?.type), activity: s.activity?.type ?? 'UNKNOWN' }
           };
         });
         
         if (routeFeatures.length > 0) {
           const sId = `routes-${y}`;
           const lId = `routes-line-${y}`;
           map.addSource(sId, { type: 'geojson', data: { type: 'FeatureCollection', features: routeFeatures } });
           map.addLayer({
             id: lId, type: 'line', source: sId,
             paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 },
             layout: { 'line-cap': 'round', 'line-join': 'round' }
           });
           createdSourcesRef.current.push(sId);
           createdLayersRef.current.push(lId);
         }
         
         const visitFeatures = segs.filter(s => s.type === 'visit').map(s => {
           
           return {
             type: 'Feature' as const,
             geometry: { type: 'Point' as const, coordinates: [s.start.longitude, s.start.latitude] },
             properties: { id: s.id, name: s.place?.name ?? 'Visit', semanticType: s.place?.semanticType ?? '' }
           };
         });
         
         if (visitFeatures.length > 0) {
           const sId = `visits-${y}`;
           const lId = `visits-circle-${y}`;
           const clusterId = `visits-cluster-${y}`;
           const isClustered = visitFeatures.length > 500;
           
           map.addSource(sId, { 
             type: 'geojson', 
             data: { type: 'FeatureCollection', features: visitFeatures },
             cluster: isClustered, clusterMaxZoom: 14, clusterRadius: 50
           });
           map.addLayer({
             id: lId, type: 'circle', source: sId,
             paint: { 'circle-radius': 6, 'circle-color': '#f59e0b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
           });
           createdSourcesRef.current.push(sId);
           createdLayersRef.current.push(lId);
           
           if (isClustered) {
             map.addLayer({
               id: clusterId, type: 'symbol', source: sId, filter: ['has', 'point_count'],
               layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
               paint: { 'text-color': '#000000' }
             });
             createdLayersRef.current.push(clusterId);
           }
         }
      }

      // ── Fit bounds ──
      const allCoords: Coordinate[] = [];
      for (const s of filteredSegments) {
        if (s.type === 'visit') {
          allCoords.push(s.start);
        } else {
          for (const p of s.points) allCoords.push(p.coordinate);
        }
      }
      const bounds = computeBounds(allCoords);
      if (bounds) {
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 60, maxZoom: 15 },
        );
      }
    };

    const onStyleData = () => {
      if (map.isStyleLoaded()) {
        map.off('styledata', onStyleData);
        update();
      }
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.on('styledata', onStyleData);
    }

    return () => {
      map.off('styledata', onStyleData);
    };
  }, [filteredSegments, segmentsByYear, totalPointCount, years, state.theme]);

  // ── Click interactions ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onRouteClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        dispatch({ type: 'SELECT_SEGMENT', id: feature.properties.id as string });
      }
    };
    const onVisitClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        dispatch({ type: 'SELECT_SEGMENT', id: feature.properties.id as string });
      }
    };

    const cursorEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const cursorLeave = () => { map.getCanvas().style.cursor = ''; };

    const attach = () => {
      for (const id of createdLayersRef.current) {
        if (id.startsWith('routes-line-')) {
          map.on('click', id, onRouteClick);
          map.on('mouseenter', id, cursorEnter);
          map.on('mouseleave', id, cursorLeave);
        } else if (id.startsWith('visits-circle-')) {
          map.on('click', id, onVisitClick);
          map.on('mouseenter', id, cursorEnter);
          map.on('mouseleave', id, cursorLeave);
        }
      }
    };

    if (map.isStyleLoaded()) attach();
    else map.once('styledata', attach);

    return () => {
      for (const id of createdLayersRef.current) {
        if (id.startsWith('routes-line-')) {
          map.off('click', id, onRouteClick);
          map.off('mouseenter', id, cursorEnter);
          map.off('mouseleave', id, cursorLeave);
        } else if (id.startsWith('visits-circle-')) {
          map.off('click', id, onVisitClick);
          map.off('mouseenter', id, cursorEnter);
          map.off('mouseleave', id, cursorLeave);
        }
      }
    };
  }, [dispatch, filteredSegments]);

  // ── Highlight selected segment ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove old highlight
    if (map.getLayer('selected-line')) map.removeLayer('selected-line');
    if (map.getLayer('selected-point')) map.removeLayer('selected-point');
    if (map.getLayer('selected-endpoints')) map.removeLayer('selected-endpoints');
    if (map.getSource('selected')) map.removeSource('selected');

    if (!state.selectedSegmentId) return;

    const seg = filteredSegments.find((s) => s.id === state.selectedSegmentId);
    if (!seg) return;

    if (seg.type === 'route' && seg.points.length >= 2) {
      map.addSource('selected', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: seg.points.map((p) => [p.coordinate.longitude, p.coordinate.latitude]) },
              properties: { kind: 'route' },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [seg.start.longitude, seg.start.latitude] },
              properties: { kind: 'start' },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [seg.end.longitude, seg.end.latitude] },
              properties: { kind: 'end' },
            },
          ],
        } as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: 'selected-line',
        type: 'line',
        source: 'selected',
        paint: {
          'line-color': '#ffffff',
          'line-width': 6,
          'line-opacity': 0.5,
        },
      });
      map.addLayer({
        id: 'selected-endpoints',
        type: 'circle',
        source: 'selected',
        filter: ['in', ['get', 'kind'], ['literal', ['start', 'end']]],
        paint: {
          'circle-radius': 7,
          'circle-color': ['match', ['get', 'kind'], 'start', '#22c55e', '#ef4444'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      const bounds = computeBounds(seg.points.map((p) => p.coordinate));
      if (bounds) {
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 80, maxZoom: 16 },
        );
      }
    } else {
      map.addSource('selected', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [seg.start.longitude, seg.start.latitude],
          },
          properties: {},
        } as GeoJSON.Feature,
      });
      map.addLayer({
        id: 'selected-point',
        type: 'circle',
        source: 'selected',
        paint: {
          'circle-radius': 12,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.4,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });

      map.flyTo({
        center: [seg.start.longitude, seg.start.latitude],
        zoom: 15,
      });
    }
  }, [state.selectedSegmentId, filteredSegments]);

  // ── Replay engine ──
  useEffect(() => {
    const engine = new ReplayEngine();
    replayEngineRef.current = engine;

    engine.onUpdate((rs) => {
      const map = mapRef.current;
      if (!map) return;

      if (rs.position) {
        if (!replayMarkerRef.current) {
          const el = createActivityMarkerElement();
          replayMarkerElRef.current = el;
          updateActivityMarkerElement(el, rs.activityType, rs.isFlight, rs.bearing);
          replayMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([rs.position.longitude, rs.position.latitude])
            .addTo(map);
        } else {
          replayMarkerRef.current.setLngLat([rs.position.longitude, rs.position.latitude]);
          if (replayMarkerElRef.current) {
            updateActivityMarkerElement(replayMarkerElRef.current, rs.activityType, rs.isFlight, rs.bearing);
          }
        }

        if (state.replay.follow && rs.isPlaying) {
          const currentZoom = map.getZoom();
          const targetZoom = rs.isFlight ? 6.5 : (rs.activityType === 'IN_TRAIN' ? 10 : 14);

          // 1. Initial fly-in on replay start if zoomed out to continent/world level
          if (!initialReplayFlyDoneRef.current || currentZoom < 10) {
            initialReplayFlyDoneRef.current = true;
            isFlyingRef.current = true;
            engine.freeze();
            map.flyTo({
              center: [rs.position.longitude, rs.position.latitude],
              zoom: targetZoom,
              speed: 1.2,
              curve: 1.4,
              essential: true,
            });
            map.once('moveend', () => {
              isFlyingRef.current = false;
              engine.unfreeze();
            });
          } else if (!isFlyingRef.current) {
            // Keep marker dead center on screen at all times while camera follows trajectory!
            map.jumpTo({
              center: [rs.position.longitude, rs.position.latitude],
            });
            if (Math.abs(currentZoom - targetZoom) > 1.2) {
              map.easeTo({ zoom: targetZoom, duration: 400 });
            }
          }
        }
      }

      if (!rs.isPlaying && engine.getState().progress === 1) {
        dispatch({ type: 'SET_REPLAY', partial: { isPlaying: false } });
      }
    });

    return () => {
      engine.unfreeze();
      engine.destroy();
      replayMarkerRef.current?.remove();
      replayMarkerRef.current = null;
    };
  }, [dispatch, state.replay.follow]);

  // ── Preload points & manage replay engine ──
  useEffect(() => {
    const engine = replayEngineRef.current;
    if (!engine) return;

    const sourceKey = state.selectedSegmentId ? `seg_${state.selectedSegmentId}` : `filters_${filteredSegments.length}`;
    if (loadedReplaySourceRef.current !== sourceKey) {
      let segmentsToLoad;
      if (state.selectedSegmentId) {
        const seg = filteredSegments.find((s) => s.id === state.selectedSegmentId);
        segmentsToLoad = seg ? [seg] : [];
      } else {
        segmentsToLoad = filteredSegments;
      }
      if (segmentsToLoad.length > 0) {
        engine.load(segmentsToLoad);
        loadedReplaySourceRef.current = sourceKey;
      }
    }

    if (state.replay.isPlaying) {
      engine.play(state.replay.speed);
    } else {
      engine.pause();
      initialReplayFlyDoneRef.current = false;
      isFlyingRef.current = false;
    }
  }, [state.replay.isPlaying, state.replay.speed, state.selectedSegmentId, filteredSegments, dispatch]);

  useEffect(() => {
    replayEngineRef.current?.setSpeed(state.replay.speed);
  }, [state.replay.speed]);

  // Expose engine on the map container for ReplayControls to access
  useEffect(() => {
    if (mapContainerRef.current) {
      (mapContainerRef.current as HTMLDivElement & { __replayEngine?: ReplayEngine }).__replayEngine =
        replayEngineRef.current ?? undefined;
    }
  }, []);

  return <div ref={mapContainerRef} className="map-container" />;
}
