import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { Map, type MapRef } from '@vis.gl/react-maplibre';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { screenEngine } from '../lib/realtime/engines/screen-engine';
import { HUB_PRESETS, NARRATIVE_ACTS } from '../lib/realtime/hub-presets';
import { useScreenStore } from '../lib/realtime/stores/screen-store';
import type {
    HexLayerMode,
    MobilityHex,
    PolicyQuadrant,
    ScreenMapViewState,
    WalkingLink,
    WalkingStation
} from '../lib/realtime/types';
import {
    computeFilteredMetrics,
    deriveScreenMapView,
    filterWalkingLinks
} from '../lib/realtime/walking-dataset';

import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_WALL_COLS = 3;
const DEFAULT_WALL_ROWS = 2;
const MAP_TRANSITION_DURATION_MS = 1100;
const REVEAL_DURATION_MS = 950;
const DECK_CURVE_STEPS = 40;
const FALLBACK_CURVE_STEPS = 24;
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const HEX_SOURCE_ID = 'do-hex-source';
const HEX_FILL_LAYER_ID = 'do-hex-fill';
const HEX_LINE_LAYER_ID = 'do-hex-outline';
const CORRIDORS_SOURCE_ID = 'do-corridors-source';
const CORRIDORS_GLOW_LAYER_ID = 'do-corridors-glow';
const CORRIDORS_LAYER_ID = 'do-corridors-line';
const STATIONS_SOURCE_ID = 'do-stations-source';
const STATIONS_LAYER_ID = 'do-stations-circle';
const STATIONS_LABEL_LAYER_ID = 'do-stations-label';

type DeckSegment = {
    id: string;
    source: [number, number];
    target: [number, number];
    width: number;
    color: [number, number, number, number];
    t: number;
    link: WalkingLink;
};

type GeoJsonSourceHandle = {
    setData: (data: unknown) => void;
};

export const Route = createFileRoute('/screen')({
    component: ScreenPage
});

function ScreenPage() {
    const { search } = useLocation();
    const searchParams = (search as Record<string, unknown>) ?? {};

    const hasExplicitGrid = searchParams.c !== undefined || searchParams.r !== undefined;
    const wallCols = parsePositiveInt(
        searchParams.cols,
        hasExplicitGrid ? DEFAULT_WALL_COLS : 1,
        16
    );
    const wallRows = parsePositiveInt(
        searchParams.rows,
        hasExplicitGrid ? DEFAULT_WALL_ROWS : 1,
        8
    );
    const screenC = parseScreenCoordinate(searchParams.c, wallCols, 0);
    const screenR = parseScreenCoordinate(searchParams.r, wallRows, 0);

    const act = useScreenStore((state) => state.act);
    const selectedHub = useScreenStore((state) => state.selectedHub);
    const mapView = useScreenStore((state) => state.mapView);
    const maxWalkMinutes = useScreenStore((state) => state.maxWalkMinutes);
    const corridorFilter = useScreenStore((state) => state.corridorFilter);
    const hexMode = useScreenStore((state) => state.hexMode);
    const dataset = useScreenStore((state) => state.dataset);

    const [isClient, setIsClient] = useState(false);
    const [useDeckWrapper, setUseDeckWrapper] = useState(false);
    const [animatedBaseView, setAnimatedBaseView] = useState<ScreenMapViewState>(mapView);
    const [deckRevealProgress, setDeckRevealProgress] = useState(1);
    const [mapInstance, setMapInstance] = useState<ReturnType<MapRef['getMap']> | null>(null);

    const viewAnimRef = useRef<number | null>(null);
    const revealAnimRef = useRef<number | null>(null);
    const animatedViewRef = useRef<ScreenMapViewState>(mapView);

    const setMapRef = useCallback((instance: MapRef | null) => {
        setMapInstance(instance?.getMap() ?? null);
    }, []);

    useEffect(() => {
        screenEngine.bootstrapClient();
        const standalone = window.self === window.top;
        setUseDeckWrapper(standalone);
        const frame = requestAnimationFrame(() => {
            setIsClient(true);
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        animatedViewRef.current = animatedBaseView;
    }, [animatedBaseView]);

    useEffect(() => {
        if (!isClient) return;

        if (viewAnimRef.current !== null) {
            cancelAnimationFrame(viewAnimRef.current);
            viewAnimRef.current = null;
        }

        const from = animatedViewRef.current;
        const to = mapView;
        const startTime = performance.now();

        const step = (now: number) => {
            const linearT = Math.min(1, (now - startTime) / MAP_TRANSITION_DURATION_MS);
            const eased = easeInOutCubic(linearT);
            setAnimatedBaseView(interpolateMapView(from, to, eased));

            if (linearT < 1) {
                viewAnimRef.current = requestAnimationFrame(step);
            } else {
                viewAnimRef.current = null;
            }
        };

        viewAnimRef.current = requestAnimationFrame(step);

        return () => {
            if (viewAnimRef.current !== null) {
                cancelAnimationFrame(viewAnimRef.current);
                viewAnimRef.current = null;
            }
        };
    }, [isClient, mapView]);

    const localScreenMapView = useMemo(
        () => deriveScreenMapView(animatedBaseView, screenC, screenR, wallCols, wallRows),
        [animatedBaseView, screenC, screenR, wallCols, wallRows]
    );

    const activeLinks = useMemo(() => {
        if (!dataset) return [];
        return filterWalkingLinks(dataset.links, corridorFilter, maxWalkMinutes);
    }, [dataset, corridorFilter, maxWalkMinutes]);

    const metrics = useMemo(
        () => computeFilteredMetrics(activeLinks, selectedHub),
        [activeLinks, selectedHub]
    );

    const spotlightId = metrics.spotlightLink?.id ?? null;

    const activeStationIds = useMemo(() => {
        const set = new Set<string>();
        for (const link of activeLinks) {
            set.add(link.fromId);
            set.add(link.toId);
        }
        return set;
    }, [activeLinks]);

    const visibleStations = useMemo(() => {
        if (!dataset) return [];
        return dataset.stations.filter((st) => activeStationIds.has(st.id));
    }, [dataset, activeStationIds]);

    const visibleHexes = useMemo(() => {
        if (!dataset || hexMode === 'off') return [];
        return dataset.hexes;
    }, [dataset, hexMode]);

    // Deck.GL geometry (used when screen runs as a standalone top-level window)
    const deckSegments = useMemo(
        () => buildDeckSegments(activeLinks, spotlightId),
        [activeLinks, spotlightId]
    );

    useEffect(() => {
        if (!isClient || !useDeckWrapper) return;

        if (revealAnimRef.current !== null) {
            cancelAnimationFrame(revealAnimRef.current);
            revealAnimRef.current = null;
        }

        setDeckRevealProgress(0);
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / REVEAL_DURATION_MS);
            setDeckRevealProgress(easeOutCubic(t));
            if (t < 1) {
                revealAnimRef.current = requestAnimationFrame(tick);
            } else {
                revealAnimRef.current = null;
            }
        };
        revealAnimRef.current = requestAnimationFrame(tick);

        return () => {
            if (revealAnimRef.current !== null) {
                cancelAnimationFrame(revealAnimRef.current);
                revealAnimRef.current = null;
            }
        };
    }, [activeLinks, isClient, useDeckWrapper]);

    const revealedDeckSegments = useMemo(
        () => deckSegments.filter((seg) => seg.t <= deckRevealProgress),
        [deckSegments, deckRevealProgress]
    );

    const deckLayers = useMemo(() => {
        if (!useDeckWrapper) return [];

        const hexLayer = new PolygonLayer<MobilityHex>({
            id: 'do-deck-hexes',
            data: visibleHexes,
            getPolygon: (d) => d.polygon,
            filled: true,
            stroked: true,
            lineWidthMinPixels: 0.6,
            getLineColor: (d) => hexStrokeRgba(d, hexMode),
            getFillColor: (d) => hexFillRgba(d, hexMode),
            pickable: false,
            updateTriggers: {
                getFillColor: [hexMode],
                getLineColor: [hexMode]
            }
        });

        const arcLayer = new LineLayer<DeckSegment>({
            id: 'do-deck-corridors',
            data: revealedDeckSegments,
            getSourcePosition: (d) => d.source,
            getTargetPosition: (d) => d.target,
            getWidth: (d) => d.width,
            widthUnits: 'pixels',
            getColor: (d) => d.color,
            pickable: true
        });

        const stationLayer = new ScatterplotLayer<WalkingStation>({
            id: 'do-deck-stations',
            data: visibleStations,
            getPosition: (d) => d.position,
            getRadius: (d) => (d.fasterWalkCount > 0 ? 5.5 + Math.min(5, d.fasterWalkCount) : 4),
            radiusUnits: 'pixels',
            stroked: true,
            lineWidthMinPixels: 2,
            getFillColor: (d) => (d.fasterWalkCount > 0 ? [245, 158, 11, 245] : [15, 23, 42, 235]),
            getLineColor: (d) =>
                d.fasterWalkCount > 0 ? [254, 243, 199, 255] : [148, 163, 184, 210],
            pickable: true
        });

        return [hexLayer, arcLayer, stationLayer];
    }, [hexMode, revealedDeckSegments, useDeckWrapper, visibleHexes, visibleStations]);

    // GeoJSON payloads for the iframe-safe MapLibre renderer
    const hexesGeoJson = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: visibleHexes.map((hx) => ({
                type: 'Feature' as const,
                properties: {
                    fillColor: hexFillCss(hx, hexMode),
                    fillOpacity: hexFillAlpha(hx, hexMode),
                    strokeColor: hexStrokeCss(hx, hexMode)
                },
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [hx.polygon]
                }
            }))
        }),
        [visibleHexes, hexMode]
    );

    const corridorsGeoJson = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: activeLinks.map((link) => {
                const isSpotlight = link.id === spotlightId;
                return {
                    type: 'Feature' as const,
                    properties: {
                        color: quadrantHexColor(link.quadrant, isSpotlight),
                        width: corridorPixelWidth(link, isSpotlight),
                        opacity: link.quadrant === 'rail_wins' && !isSpotlight ? 0.42 : 0.94,
                        glowOpacity:
                            isSpotlight || link.timeSavedMinutes > 0
                                ? isSpotlight
                                    ? 0.45
                                    : 0.22
                                : 0
                    },
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: createCurvePoints(
                            link.start,
                            link.end,
                            FALLBACK_CURVE_STEPS,
                            Math.max(1, link.timeSavedMinutes)
                        )
                    }
                };
            })
        }),
        [activeLinks, spotlightId]
    );

    const stationsGeoJson = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: visibleStations.map((st) => ({
                type: 'Feature' as const,
                properties: {
                    label: st.fasterWalkCount > 0 ? st.name : '',
                    radius: st.fasterWalkCount > 0 ? 5.5 + Math.min(4.5, st.fasterWalkCount) : 3.8,
                    fill: st.fasterWalkCount > 0 ? '#f59e0b' : '#0f172a',
                    stroke: st.fasterWalkCount > 0 ? '#fef3c7' : '#94a3b8'
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: st.position
                }
            }))
        }),
        [visibleStations]
    );

    // Imperative MapLibre layer sync (creates sources once, updates in-place via setData)
    useEffect(() => {
        if (!isClient || useDeckWrapper || !mapInstance) return;

        let fadeFrame: number | null = null;

        const syncMapLayers = () => {
            if (!mapInstance.isStyleLoaded()) return;

            const existingHex = mapInstance.getSource(HEX_SOURCE_ID) as
                | GeoJsonSourceHandle
                | undefined;
            if (!existingHex) {
                mapInstance.addSource(HEX_SOURCE_ID, {
                    type: 'geojson',
                    data: hexesGeoJson as never
                });
                mapInstance.addLayer({
                    id: HEX_FILL_LAYER_ID,
                    type: 'fill',
                    source: HEX_SOURCE_ID,
                    paint: {
                        'fill-color': ['get', 'fillColor'],
                        'fill-opacity': ['get', 'fillOpacity']
                    }
                });
                mapInstance.addLayer({
                    id: HEX_LINE_LAYER_ID,
                    type: 'line',
                    source: HEX_SOURCE_ID,
                    paint: {
                        'line-color': ['get', 'strokeColor'],
                        'line-width': 0.8,
                        'line-opacity': 0.32
                    }
                });
            } else {
                existingHex.setData(hexesGeoJson);
            }

            const existingCorridors = mapInstance.getSource(CORRIDORS_SOURCE_ID) as
                | GeoJsonSourceHandle
                | undefined;
            if (!existingCorridors) {
                mapInstance.addSource(CORRIDORS_SOURCE_ID, {
                    type: 'geojson',
                    data: corridorsGeoJson as never
                });
                mapInstance.addLayer({
                    id: CORRIDORS_GLOW_LAYER_ID,
                    type: 'line',
                    source: CORRIDORS_SOURCE_ID,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': ['*', ['get', 'width'], 2.6],
                        'line-opacity': ['get', 'glowOpacity'],
                        'line-blur': 4
                    }
                });
                mapInstance.addLayer({
                    id: CORRIDORS_LAYER_ID,
                    type: 'line',
                    source: CORRIDORS_SOURCE_ID,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': ['get', 'width'],
                        'line-opacity': ['get', 'opacity']
                    }
                });
            } else {
                existingCorridors.setData(corridorsGeoJson);
                // Gentle opacity breath on dataset filter transitions (vertigo-safe, no flashing)
                const start = performance.now();
                const animateIn = (now: number) => {
                    const t = easeOutCubic(Math.min(1, (now - start) / 550));
                    if (mapInstance.getLayer(CORRIDORS_LAYER_ID)) {
                        mapInstance.setPaintProperty(CORRIDORS_LAYER_ID, 'line-opacity', [
                            '*',
                            ['get', 'opacity'],
                            0.35 + 0.65 * t
                        ]);
                    }
                    if (t < 1) {
                        fadeFrame = requestAnimationFrame(animateIn);
                    }
                };
                fadeFrame = requestAnimationFrame(animateIn);
            }

            const existingStations = mapInstance.getSource(STATIONS_SOURCE_ID) as
                | GeoJsonSourceHandle
                | undefined;
            if (!existingStations) {
                mapInstance.addSource(STATIONS_SOURCE_ID, {
                    type: 'geojson',
                    data: stationsGeoJson as never
                });
                mapInstance.addLayer({
                    id: STATIONS_LAYER_ID,
                    type: 'circle',
                    source: STATIONS_SOURCE_ID,
                    paint: {
                        'circle-radius': ['get', 'radius'],
                        'circle-color': ['get', 'fill'],
                        'circle-stroke-color': ['get', 'stroke'],
                        'circle-stroke-width': 2
                    }
                });
                mapInstance.addLayer({
                    id: STATIONS_LABEL_LAYER_ID,
                    type: 'symbol',
                    source: STATIONS_SOURCE_ID,
                    minzoom: 12.2,
                    layout: {
                        'text-field': ['get', 'label'],
                        'text-font': ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular'],
                        'text-size': 13,
                        'text-offset': [0, 1.15],
                        'text-anchor': 'top',
                        'text-optional': true
                    },
                    paint: {
                        'text-color': '#f8fafc',
                        'text-halo-color': '#090b0f',
                        'text-halo-width': 2
                    }
                });
            } else {
                existingStations.setData(stationsGeoJson);
            }
        };

        syncMapLayers();
        mapInstance.on('load', syncMapLayers);

        return () => {
            mapInstance.off('load', syncMapLayers);
            if (fadeFrame !== null) {
                cancelAnimationFrame(fadeFrame);
            }
        };
    }, [corridorsGeoJson, hexesGeoJson, isClient, mapInstance, stationsGeoJson, useDeckWrapper]);

    const actInfo = NARRATIVE_ACTS[act];
    const hubInfo = HUB_PRESETS[selectedHub];
    const summary = dataset?.meta.summary;

    const isStandaloneSingle = wallCols === 1 && wallRows === 1;
    const showMasthead = isStandaloneSingle || (screenC === 0 && screenR === 0);
    const showTelemetry = isStandaloneSingle || (screenC === wallCols - 1 && screenR === 0);
    const showLegend =
        !isStandaloneSingle && wallRows >= 2 && screenC === 0 && screenR === wallRows - 1;
    const showSpotlight =
        isStandaloneSingle ||
        (wallRows >= 2 && screenC === wallCols - 1 && screenR === wallRows - 1);

    const handleDeckViewStateChange = useCallback(
        (params: { viewState: Record<string, unknown> }) => {
            if (viewAnimRef.current !== null) {
                cancelAnimationFrame(viewAnimRef.current);
                viewAnimRef.current = null;
            }
            const vs = params.viewState;
            setAnimatedBaseView((prev) => ({
                longitude: typeof vs.longitude === 'number' ? vs.longitude : prev.longitude,
                latitude: typeof vs.latitude === 'number' ? vs.latitude : prev.latitude,
                zoom: typeof vs.zoom === 'number' ? vs.zoom : prev.zoom,
                bearing: typeof vs.bearing === 'number' ? vs.bearing : prev.bearing,
                pitch: typeof vs.pitch === 'number' ? vs.pitch : prev.pitch
            }));
        },
        []
    );

    return (
        <main
            className={`relative h-screen w-screen overflow-hidden bg-[#090b0f] text-slate-100 select-none ${
                useDeckWrapper ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
            }`}
        >
            {/* Map Canvas */}
            <div className="absolute inset-0 z-10">
                {isClient && useDeckWrapper ? (
                    <DeckGL
                        controller={true}
                        viewState={localScreenMapView}
                        onViewStateChange={handleDeckViewStateChange}
                        layers={deckLayers}
                        getTooltip={({ object }) => {
                            if (!object || typeof object !== 'object') return null;
                            if ('link' in object) {
                                const lnk = (object as DeckSegment).link;
                                const verdict =
                                    lnk.timeSavedMinutes > 0
                                        ? `Walking is +${lnk.timeSavedMinutes} min FASTER than rail`
                                        : lnk.timeSavedMinutes >= -3
                                          ? `Almost tied (Train is only ${Math.abs(lnk.timeSavedMinutes)} min faster)`
                                          : `Train is ${Math.abs(lnk.timeSavedMinutes)} min faster`;
                                return {
                                    text: `${lnk.fromName} ↔ ${lnk.toName} (${lnk.line})\nWalk: ${lnk.walkMinutes} min (${lnk.steps} steps)  |  Train: ${lnk.railMinutes} min (${lnk.transfers} changes)\n${verdict} · Street Comfort: ${lnk.walkabilityScore}/100`,
                                    style: {
                                        backgroundColor: '#090b0f',
                                        color: '#f8fafc',
                                        border: '1px solid rgba(245, 158, 11, 0.55)',
                                        borderRadius: '8px',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: '12px',
                                        lineHeight: '1.45',
                                        whiteSpace: 'pre-line',
                                        padding: '8px 12px'
                                    }
                                };
                            }
                            const st = object as WalkingStation;
                            if (typeof st.name !== 'string') return null;
                            return {
                                text: `Station: ${st.name}\n${st.fasterWalkCount} faster-on-foot links connected here`,
                                style: {
                                    backgroundColor: '#090b0f',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(245, 158, 11, 0.45)',
                                    borderRadius: '8px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-line',
                                    padding: '6px 10px'
                                }
                            };
                        }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Map reuseMaps attributionControl={false} mapStyle={MAP_STYLE} />
                    </DeckGL>
                ) : null}

                {isClient && !useDeckWrapper ? (
                    <Map
                        ref={setMapRef}
                        reuseMaps
                        attributionControl={false}
                        mapStyle={MAP_STYLE}
                        longitude={localScreenMapView.longitude}
                        latitude={localScreenMapView.latitude}
                        zoom={localScreenMapView.zoom}
                        bearing={localScreenMapView.bearing}
                        pitch={localScreenMapView.pitch}
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : null}
            </div>

            {/* Subtle architectural vignette keeping bezel seams unified */}
            <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_8vh_rgba(9,11,15,0.55)]" />

            {/* Top-Left Tile (c=0, r=0): Narrative Act Masthead — sized in fluid vh for 10m DO viewing */}
            {showMasthead ? (
                <aside
                    className="pointer-events-none absolute top-[3.6vh] left-[2.6vw] z-30 max-w-[82vw] rounded-[1.4vh] border border-slate-200/15 bg-[#090b0f]/88 p-[2.6vh] backdrop-blur-md"
                    style={{ width: isStandaloneSingle ? 'min(44vw, 640px)' : '86%' }}
                >
                    <div className="mb-[1.2vh] flex items-center gap-[1.2vh]">
                        {/* TfL Roundel-inspired geometric emblem */}
                        <span className="relative inline-flex size-[3.2vh] shrink-0 items-center justify-center">
                            <span className="size-[2.8vh] rounded-full border-[0.55vh] border-[#e32017]" />
                            <span className="absolute h-[0.65vh] w-[3.2vh] rounded-xs bg-[#0019a8]" />
                        </span>
                        <span className="font-mono-tabular text-[clamp(0.85rem,2vh,1.7rem)] font-semibold tracking-[0.16em] text-amber-400 uppercase">
                            {actInfo.tag}
                        </span>
                    </div>

                    <h1 className="text-[clamp(1.6rem,4.8vh,4.2rem)] leading-[1.06] font-extrabold tracking-tight text-white">
                        {actInfo.title}
                    </h1>

                    <p className="mt-[1.2vh] text-[clamp(0.95rem,2.25vh,1.85rem)] leading-[1.38] font-normal text-slate-300">
                        {actInfo.thesis}
                    </p>
                </aside>
            ) : null}

            {/* Top-Right Tile (c=max, r=0): Quantitative Model Readout */}
            {showTelemetry ? (
                <aside
                    className="pointer-events-none absolute top-[3.6vh] right-[2.6vw] z-30 rounded-[1.4vh] border border-slate-200/15 bg-[#090b0f]/88 p-[2.6vh] backdrop-blur-md"
                    style={{ width: isStandaloneSingle ? 'min(38vw, 520px)' : '86%' }}
                >
                    <div className="flex items-center justify-between border-b border-slate-200/10 pb-[1.2vh]">
                        <span className="font-mono-tabular text-[clamp(0.8rem,1.9vh,1.5rem)] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                            FOCUS · {hubInfo.shortLabel}
                        </span>
                        <span className="font-mono-tabular rounded-full border border-amber-400/35 bg-amber-400/12 px-[1.4vh] py-[0.3vh] text-[clamp(0.75rem,1.75vh,1.4rem)] font-semibold text-amber-300">
                            ≤ {maxWalkMinutes} MIN WALK
                        </span>
                    </div>

                    <div className="mt-[1.8vh] grid grid-cols-3 gap-[1.6vh]">
                        <div>
                            <p className="text-[clamp(0.75rem,1.7vh,1.35rem)] font-medium text-slate-400 uppercase">
                                Corridors
                            </p>
                            <p className="font-mono-tabular mt-[0.3vh] text-[clamp(1.5rem,4.5vh,3.8rem)] leading-none font-bold text-white">
                                {metrics.count}
                            </p>
                        </div>
                        <div>
                            <p className="text-[clamp(0.75rem,1.7vh,1.35rem)] font-medium text-slate-400 uppercase">
                                Faster Walk
                            </p>
                            <p className="font-mono-tabular mt-[0.3vh] text-[clamp(1.5rem,4.5vh,3.8rem)] leading-none font-bold text-amber-400">
                                {metrics.fasterCount}
                            </p>
                        </div>
                        <div>
                            <p className="text-[clamp(0.75rem,1.7vh,1.35rem)] font-medium text-slate-400 uppercase">
                                Median ΔT
                            </p>
                            <p className="font-mono-tabular mt-[0.3vh] text-[clamp(1.5rem,4.5vh,3.8rem)] leading-none font-bold text-emerald-400">
                                {metrics.medianSavedMinutes > 0
                                    ? `+${metrics.medianSavedMinutes}`
                                    : metrics.medianSavedMinutes}
                                <span className="ml-[0.3vh] text-[2.2vh] font-medium text-slate-400">
                                    m
                                </span>
                            </p>
                        </div>
                    </div>

                    {summary ? (
                        <div className="font-mono-tabular mt-[1.8vh] flex items-center justify-between border-t border-slate-200/10 pt-[1.2vh] text-[clamp(0.72rem,1.65vh,1.3rem)] text-slate-400">
                            <span>OLS R² = {summary.olsRSquared}</span>
                            <span>Street Circuity τ = {summary.meanCircuity}×</span>
                            <span>{useDeckWrapper ? 'DECK.GL' : 'MAPLIBRE'}</span>
                        </div>
                    ) : null}
                </aside>
            ) : null}

            {/* Bottom-Left Tile (c=0, r=max): Semantic Cartographic Key */}
            {showLegend ? (
                <aside
                    className="pointer-events-none absolute bottom-[3.6vh] left-[2.6vw] z-30 rounded-[1.4vh] border border-slate-200/15 bg-[#090b0f]/88 p-[2.4vh] backdrop-blur-md"
                    style={{ width: '86%' }}
                >
                    <p className="font-mono-tabular mb-[1.4vh] text-[clamp(0.8rem,1.85vh,1.5rem)] font-semibold tracking-[0.15em] text-slate-400 uppercase">
                        HOW TO READ EACH STATION-TO-STATION ARC
                    </p>
                    <div className="grid grid-cols-2 gap-x-[2vh] gap-y-[1.2vh] text-[clamp(0.85rem,2.05vh,1.65rem)]">
                        <div className="flex items-center gap-[1.1vh]">
                            <span className="h-[0.9vh] w-[3.2vh] rounded-full bg-amber-400" />
                            <span className="font-medium text-slate-100">
                                Walk Beats Tube · Great Street (70)
                            </span>
                        </div>
                        <div className="flex items-center gap-[1.1vh]">
                            <span className="h-[0.9vh] w-[3.2vh] rounded-full bg-rose-500" />
                            <span className="font-medium text-slate-100">
                                Walk Beats Tube · Busy Cars (13)
                            </span>
                        </div>
                        <div className="flex items-center gap-[1.1vh]">
                            <span className="h-[0.9vh] w-[3.2vh] rounded-full bg-teal-400" />
                            <span className="font-medium text-slate-300">
                                Almost Tied · ≤3m of Tube (58)
                            </span>
                        </div>
                        <div className="flex items-center gap-[1.1vh]">
                            <span className="h-[0.9vh] w-[3.2vh] rounded-full bg-slate-500" />
                            <span className="font-medium text-slate-400">
                                Tube Wins (&gt;3m Faster)
                            </span>
                        </div>
                    </div>
                </aside>
            ) : null}

            {/* Bottom-Right Tile (c=max, r=max): Top Shortcut Spotlight */}
            {showSpotlight && metrics.spotlightLink ? (
                <aside
                    className="pointer-events-none absolute right-[2.6vw] bottom-[3.6vh] z-30 rounded-[1.4vh] border border-amber-400/30 bg-[#090b0f]/90 p-[2.4vh] backdrop-blur-md"
                    style={{ width: isStandaloneSingle ? 'min(42vw, 560px)' : '86%' }}
                >
                    <div className="flex items-center justify-between">
                        <span className="font-mono-tabular text-[clamp(0.78rem,1.8vh,1.45rem)] font-semibold tracking-[0.14em] text-amber-400 uppercase">
                            SPOTLIGHT CORRIDOR · {metrics.spotlightLink.line}
                        </span>
                        <span className="font-mono-tabular text-[clamp(0.78rem,1.8vh,1.45rem)] text-slate-300">
                            Comfort {metrics.spotlightLink.walkabilityScore}/100
                        </span>
                    </div>

                    <h2 className="mt-[0.8vh] truncate text-[clamp(1.25rem,3.3vh,2.7rem)] font-bold text-white">
                        {metrics.spotlightLink.fromName} ↔ {metrics.spotlightLink.toName}
                    </h2>

                    <div className="font-mono-tabular mt-[1.2vh] flex items-baseline gap-[2.2vh] text-[clamp(0.9rem,2.2vh,1.8rem)]">
                        <span className="text-amber-300">
                            Walk <strong>{metrics.spotlightLink.walkMinutes}m</strong>
                        </span>
                        <span className="text-slate-400">
                            Rail <strong>{metrics.spotlightLink.railMinutes}m</strong>
                        </span>
                        <span className="ml-auto font-bold text-emerald-400">
                            {metrics.spotlightLink.timeSavedMinutes >= 0
                                ? `Saves +${metrics.spotlightLink.timeSavedMinutes}m`
                                : `${metrics.spotlightLink.timeSavedMinutes}m vs Tube`}
                        </span>
                    </div>
                </aside>
            ) : null}
        </main>
    );
}

function parsePositiveInt(value: unknown, fallback: number, max: number): number {
    const parsed =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(max, parsed);
}

function parseScreenCoordinate(value: unknown, size: number, fallback: number): number {
    if (value === null || value === undefined) {
        return Math.min(size - 1, Math.max(0, fallback));
    }
    const parsed =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(parsed)) {
        return Math.min(size - 1, Math.max(0, fallback));
    }
    return Math.min(size - 1, Math.max(0, parsed));
}

function quadrantHexColor(quadrant: PolicyQuadrant, isSpotlight: boolean): string {
    if (isSpotlight) return '#fde047';
    switch (quadrant) {
        case 'nudge_gold':
            return '#f59e0b';
        case 'policy_priority':
            return '#f43f5e';
        case 'parity_nudge':
            return '#14b8a6';
        case 'rail_wins':
        default:
            return '#475569';
    }
}

function quadrantRgba(
    quadrant: PolicyQuadrant,
    t: number,
    isSpotlight: boolean
): [number, number, number, number] {
    if (isSpotlight) {
        return [253, 224, 71, 255];
    }
    switch (quadrant) {
        case 'nudge_gold':
            return [
                Math.round(lerp(245, 253, t)),
                Math.round(lerp(158, 224, t)),
                Math.round(lerp(11, 71, t)),
                240
            ];
        case 'policy_priority':
            return [
                Math.round(lerp(244, 251, t)),
                Math.round(lerp(63, 146, t)),
                Math.round(lerp(94, 60, t)),
                240
            ];
        case 'parity_nudge':
            return [
                Math.round(lerp(20, 94, t)),
                Math.round(lerp(184, 234, t)),
                Math.round(lerp(166, 212, t)),
                215
            ];
        case 'rail_wins':
        default:
            return [71, 85, 105, 115];
    }
}

function corridorPixelWidth(link: WalkingLink, isSpotlight: boolean): number {
    if (isSpotlight) return 7;
    if (link.timeSavedMinutes > 0) {
        return Math.min(6, 2.8 + link.timeSavedMinutes * 0.12);
    }
    if (link.quadrant === 'parity_nudge') {
        return 2.6;
    }
    return 1.6;
}

function hexFillCss(hx: MobilityHex, mode: HexLayerMode): string {
    if (mode === 'pedestrian') {
        return hx.pedNorm > 0.55 ? '#10b981' : '#0ea5e9';
    }
    if (hx.pedDominance >= 0.06) return '#10b981';
    if (hx.pedDominance <= -0.1) return '#ef4444';
    return '#64748b';
}

function hexStrokeCss(hx: MobilityHex, mode: HexLayerMode): string {
    if (mode === 'pedestrian') return '#34d399';
    return hx.pedDominance >= 0 ? '#34d399' : '#f87171';
}

function hexFillAlpha(hx: MobilityHex, mode: HexLayerMode): number {
    if (mode === 'pedestrian') {
        return Math.min(0.32, 0.05 + hx.pedNorm * 0.28);
    }
    return Math.min(0.28, 0.06 + Math.abs(hx.pedDominance) * 0.26);
}

function hexFillRgba(hx: MobilityHex, mode: HexLayerMode): [number, number, number, number] {
    const alpha = Math.round(hexFillAlpha(hx, mode) * 255);
    if (mode === 'pedestrian') {
        return hx.pedNorm > 0.55 ? [16, 185, 129, alpha] : [14, 165, 233, alpha];
    }
    if (hx.pedDominance >= 0.06) return [16, 185, 129, alpha];
    if (hx.pedDominance <= -0.1) return [239, 68, 68, alpha];
    return [100, 116, 139, Math.round(alpha * 0.65)];
}

function hexStrokeRgba(hx: MobilityHex, mode: HexLayerMode): [number, number, number, number] {
    if (mode === 'pedestrian') return [52, 211, 153, 70];
    return hx.pedDominance >= 0 ? [52, 211, 153, 75] : [248, 113, 113, 75];
}

function buildDeckSegments(links: WalkingLink[], spotlightId: string | null): DeckSegment[] {
    const segments: DeckSegment[] = [];
    for (const link of links) {
        const isSpotlight = link.id === spotlightId;
        const points = createCurvePoints(
            link.start,
            link.end,
            DECK_CURVE_STEPS,
            Math.max(1, link.timeSavedMinutes)
        );
        const width = corridorPixelWidth(link, isSpotlight);
        const denom = Math.max(1, points.length - 2);
        for (let i = 0; i < points.length - 1; i++) {
            const t = i / denom;
            segments.push({
                id: `${link.id}-${i}`,
                source: points[i],
                target: points[i + 1],
                width,
                color: quadrantRgba(link.quadrant, t, isSpotlight),
                t,
                link
            });
        }
    }
    return segments;
}

function createCurvePoints(
    start: [number, number],
    end: [number, number],
    steps: number,
    emphasis: number
): Array<[number, number]> {
    const [sx, sy] = start;
    const [ex, ey] = end;
    const dx = ex - sx;
    const dy = ey - sy;
    const length = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));

    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const px = -dy / length;
    const py = dx / length;

    const bow = Math.min(0.012, length * (0.14 + Math.min(0.14, emphasis * 0.008)));
    const cx = mx + px * bow;
    const cy = my + py * bow;

    const points: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const omt = 1 - t;
        points.push([
            omt * omt * sx + 2 * omt * t * cx + t * t * ex,
            omt * omt * sy + 2 * omt * t * cy + t * t * ey
        ]);
    }
    return points;
}

function interpolateMapView(
    from: ScreenMapViewState,
    to: ScreenMapViewState,
    t: number
): ScreenMapViewState {
    return {
        longitude: lerp(from.longitude, to.longitude, t),
        latitude: lerp(from.latitude, to.latitude, t),
        zoom: lerp(from.zoom, to.zoom, t),
        bearing: lerp(from.bearing, to.bearing, t),
        pitch: lerp(from.pitch, to.pitch, t)
    };
}

function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}
