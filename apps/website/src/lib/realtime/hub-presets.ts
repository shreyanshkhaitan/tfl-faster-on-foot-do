import type {
    BusSharedState,
    CorridorFilter,
    HexLayerMode,
    HubPresetId,
    NarrativeAct,
    ScreenMapViewState
} from './types';

export type HubMetadata = {
    id: HubPresetId;
    label: string;
    shortLabel: string;
    stationKey: string | null;
    view: ScreenMapViewState;
};

export const HUB_PRESETS: Record<HubPresetId, HubMetadata> = {
    overview: {
        id: 'overview',
        label: 'Central London Core',
        shortLabel: 'Zones 1–2',
        stationKey: null,
        view: {
            longitude: -0.1245,
            latitude: 51.5135,
            zoom: 12.6,
            bearing: 0,
            pitch: 0
        }
    },
    'south-kensington': {
        id: 'south-kensington',
        label: 'South Kensington (Imperial)',
        shortLabel: 'Imperial / SW7',
        stationKey: 'south-kensington',
        view: {
            longitude: -0.1738,
            latitude: 51.4941,
            zoom: 13.7,
            bearing: 0,
            pitch: 0
        }
    },
    'king-s-cross-saint-pancras': {
        id: 'king-s-cross-saint-pancras',
        label: "King's Cross & Camden",
        shortLabel: "King's Cross",
        stationKey: 'king-s-cross-saint-pancras',
        view: {
            longitude: -0.1335,
            latitude: 51.5365,
            zoom: 13.3,
            bearing: 0,
            pitch: 0
        }
    },
    'oxford-circus': {
        id: 'oxford-circus',
        label: 'Oxford Circus & West End',
        shortLabel: 'West End',
        stationKey: 'oxford-circus',
        view: {
            longitude: -0.1416,
            latitude: 51.5152,
            zoom: 13.8,
            bearing: 0,
            pitch: 0
        }
    },
    bank: {
        id: 'bank',
        label: 'Bank & City Square Mile',
        shortLabel: 'Bank / City',
        stationKey: 'bank',
        view: {
            longitude: -0.0942,
            latitude: 51.5138,
            zoom: 14.0,
            bearing: 0,
            pitch: 0
        }
    },
    waterloo: {
        id: 'waterloo',
        label: 'Waterloo & South Bank',
        shortLabel: 'Waterloo',
        stationKey: 'waterloo',
        view: {
            longitude: -0.1132,
            latitude: 51.5055,
            zoom: 13.8,
            bearing: 0,
            pitch: 0
        }
    },
    whitechapel: {
        id: 'whitechapel',
        label: 'Whitechapel & Shoreditch',
        shortLabel: 'East End',
        stationKey: 'whitechapel',
        view: {
            longitude: -0.0685,
            latitude: 51.5225,
            zoom: 13.6,
            bearing: 0,
            pitch: 0
        }
    }
};

export type ActMetadata = {
    act: NarrativeAct;
    tag: string;
    title: string;
    thesis: string;
    preset: BusSharedState;
};

export const NARRATIVE_ACTS: Record<NarrativeAct, ActMetadata> = {
    1: {
        act: 1,
        tag: 'ACT 01 · TOPOLOGICAL HABIT',
        title: 'The Subterranean Reflex',
        thesis: 'Each line connects two nearby London stations (456 total). Harry Beck’s Tube diagram tricks commuters into going underground even for 600m hops.',
        preset: {
            act: 1,
            hub: 'overview',
            zoom: 12.4,
            maxWalkMinutes: 25,
            corridorFilter: 'all',
            hexMode: 'off'
        }
    },
    2: {
        act: 2,
        tag: 'ACT 02 · GEOMETRIC ILLUSION',
        title: '83 Journeys Faster on Foot',
        thesis: 'Gold & red arcs connect station pairs where street walking beats taking the train door-to-door—saving a median 4.8 min (up to +32.7 min on cross-line doglegs).',
        preset: {
            act: 2,
            hub: 'overview',
            zoom: 12.6,
            maxWalkMinutes: 20,
            corridorFilter: 'faster',
            hexMode: 'balance'
        }
    },
    3: {
        act: 3,
        tag: 'ACT 03 · STREET REALM EQUITY',
        title: 'Healthy Streets vs. Busy Traffic',
        thesis: 'Comparing street hexagons separates 70 pleasant walks (gold) from 13 traffic-heavy shortcuts (red)—showing exactly where TfL should improve pavements & crossings.',
        preset: {
            act: 3,
            hub: 'oxford-circus',
            zoom: 13.4,
            maxWalkMinutes: 18,
            corridorFilter: 'policy_priority',
            hexMode: 'balance'
        }
    },
    4: {
        act: 4,
        tag: 'ACT 04 · LOCAL ISOCHRONE',
        title: 'South Kensington & Campus Walkshed',
        thesis: 'Around Imperial College, teal arcs mark 58 "almost-tied" walks (within ≤3 min of the Tube) that relieve peak crowding and add healthy daily steps.',
        preset: {
            act: 4,
            hub: 'south-kensington',
            zoom: 13.7,
            maxWalkMinutes: 18,
            corridorFilter: 'all',
            hexMode: 'pedestrian'
        }
    }
};

export const HUB_LIST: HubMetadata[] = Object.values(HUB_PRESETS);
export const ACT_LIST: ActMetadata[] = [
    NARRATIVE_ACTS[1],
    NARRATIVE_ACTS[2],
    NARRATIVE_ACTS[3],
    NARRATIVE_ACTS[4]
];

export function isHubPresetId(value: unknown): value is HubPresetId {
    return typeof value === 'string' && value in HUB_PRESETS;
}

export function isNarrativeAct(value: unknown): value is NarrativeAct {
    return value === 1 || value === 2 || value === 3 || value === 4;
}

export function isCorridorFilter(value: unknown): value is CorridorFilter {
    return (
        value === 'all' ||
        value === 'faster' ||
        value === 'parity' ||
        value === 'nudge_gold' ||
        value === 'policy_priority'
    );
}

export function isHexLayerMode(value: unknown): value is HexLayerMode {
    return value === 'off' || value === 'pedestrian' || value === 'balance';
}

export function getHubMapView(hub: HubPresetId): ScreenMapViewState {
    return HUB_PRESETS[hub].view;
}

export const MAP_ZOOM_MIN = 11.2;
export const MAP_ZOOM_MAX = 15.6;
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 100;
export const WALK_MINUTES_MIN = 5;
export const WALK_MINUTES_MAX = 28;

export function clampZoom(zoom: number): number {
    if (!Number.isFinite(zoom)) return 12.6;
    return Math.round(Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zoom)) * 100) / 100;
}

export function clampWalkMinutes(minutes: number): number {
    if (!Number.isFinite(minutes)) return 20;
    return Math.round(Math.min(WALK_MINUTES_MAX, Math.max(WALK_MINUTES_MIN, minutes)));
}

export function zoomFromSlider(sliderValue: number): number {
    const clamped = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, sliderValue));
    const t = (clamped - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
    return clampZoom(MAP_ZOOM_MIN + t * (MAP_ZOOM_MAX - MAP_ZOOM_MIN));
}

export function sliderFromZoom(zoom: number): number {
    const z = clampZoom(zoom);
    const t = (z - MAP_ZOOM_MIN) / (MAP_ZOOM_MAX - MAP_ZOOM_MIN);
    return Math.round(SLIDER_MIN + t * (SLIDER_MAX - SLIDER_MIN));
}
