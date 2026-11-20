import { WebMercatorViewport } from '@deck.gl/core';

import { HUB_PRESETS } from './hub-presets';
import type {
    CorridorFilter,
    HubPresetId,
    MobilityHex,
    PolicyQuadrant,
    ScreenMapViewState,
    WalkingDataset,
    WalkingLink,
    WalkingStation
} from './types';

const DATASET_URL = '/data/tfl-walking-ds.json';

export const CANONICAL_SCREEN_WIDTH = 1920;
export const CANONICAL_SCREEN_HEIGHT = 1080;

let datasetRequest: Promise<WalkingDataset | null> | null = null;

export async function loadWalkingDataset(): Promise<WalkingDataset | null> {
    if (typeof window === 'undefined') return null;

    if (!datasetRequest) {
        datasetRequest = (async () => {
            try {
                const response = await fetch(DATASET_URL, {
                    headers: { accept: 'application/json' }
                });
                if (!response.ok) return null;
                const raw = (await response.json()) as unknown;
                return validateWalkingDataset(raw);
            } catch {
                return null;
            }
        })();
    }

    const result = await datasetRequest;
    if (result === null) {
        // Allow retry if transient load failed.
        datasetRequest = null;
    }
    return result;
}

const VALID_QUADRANTS = new Set<PolicyQuadrant>([
    'nudge_gold',
    'policy_priority',
    'parity_nudge',
    'rail_wins'
]);

export function validateWalkingDataset(raw: unknown): WalkingDataset | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const candidate = raw as Record<string, unknown>;
    if (
        typeof candidate.meta !== 'object' ||
        candidate.meta === null ||
        !Array.isArray(candidate.links) ||
        !Array.isArray(candidate.stations) ||
        !Array.isArray(candidate.hexes)
    ) {
        return null;
    }

    const links: WalkingLink[] = [];
    for (const item of candidate.links) {
        if (typeof item !== 'object' || item === null) continue;
        const l = item as Partial<WalkingLink>;
        if (
            typeof l.id !== 'string' ||
            typeof l.fromId !== 'string' ||
            typeof l.fromName !== 'string' ||
            typeof l.toId !== 'string' ||
            typeof l.toName !== 'string' ||
            !isCoordinatePair(l.start) ||
            !isCoordinatePair(l.end) ||
            typeof l.walkMinutes !== 'number' ||
            typeof l.railMinutes !== 'number' ||
            typeof l.timeSavedMinutes !== 'number' ||
            typeof l.walkabilityScore !== 'number' ||
            typeof l.quadrant !== 'string' ||
            !VALID_QUADRANTS.has(l.quadrant as PolicyQuadrant)
        ) {
            continue;
        }
        links.push({
            id: l.id,
            fromId: l.fromId,
            fromName: l.fromName,
            toId: l.toId,
            toName: l.toName,
            start: [l.start[0], l.start[1]],
            end: [l.end[0], l.end[1]],
            line: typeof l.line === 'string' ? l.line : 'Tube',
            lineColor: typeof l.lineColor === 'string' ? l.lineColor : '#94A3B8',
            fromLines: typeof l.fromLines === 'string' ? l.fromLines : '',
            toLines: typeof l.toLines === 'string' ? l.toLines : '',
            walkMinutes: l.walkMinutes,
            railMinutes: l.railMinutes,
            timeSavedMinutes: l.timeSavedMinutes,
            railHops: typeof l.railHops === 'number' ? l.railHops : 1,
            transfers: typeof l.transfers === 'number' ? l.transfers : 0,
            steps: typeof l.steps === 'number' ? l.steps : l.walkMinutes * 100,
            kcal: typeof l.kcal === 'number' ? l.kcal : Math.round(l.walkMinutes * 4.2),
            straightKm: typeof l.straightKm === 'number' ? l.straightKm : 0.8,
            circuity: typeof l.circuity === 'number' ? l.circuity : 1.24,
            pedDensity: typeof l.pedDensity === 'number' ? l.pedDensity : 0,
            carPeopleKm: typeof l.carPeopleKm === 'number' ? l.carPeopleKm : 0,
            cycleKm: typeof l.cycleKm === 'number' ? l.cycleKm : 0,
            walkabilityScore: l.walkabilityScore,
            quadrant: l.quadrant as PolicyQuadrant,
            isCrossLine: Boolean(l.isCrossLine),
            isOfficialQuicker: Boolean(l.isOfficialQuicker)
        });
    }

    const stations: WalkingStation[] = [];
    for (const item of candidate.stations) {
        if (typeof item !== 'object' || item === null) continue;
        const s = item as Partial<WalkingStation>;
        if (
            typeof s.id !== 'string' ||
            typeof s.name !== 'string' ||
            !isCoordinatePair(s.position)
        ) {
            continue;
        }
        stations.push({
            id: s.id,
            name: s.name,
            position: [s.position[0], s.position[1]],
            degree: typeof s.degree === 'number' ? s.degree : 1,
            fasterWalkCount: typeof s.fasterWalkCount === 'number' ? s.fasterWalkCount : 0,
            bestSavedMinutes: typeof s.bestSavedMinutes === 'number' ? s.bestSavedMinutes : 0
        });
    }

    const hexes: MobilityHex[] = [];
    for (const item of candidate.hexes) {
        if (typeof item !== 'object' || item === null) continue;
        const h = item as Partial<MobilityHex>;
        if (typeof h.id !== 'number' || !Array.isArray(h.polygon) || h.polygon.length < 3) {
            continue;
        }
        const ring: Array<[number, number]> = [];
        for (const pt of h.polygon) {
            if (isCoordinatePair(pt)) {
                ring.push([pt[0], pt[1]]);
            }
        }
        if (ring.length < 3) continue;
        hexes.push({
            id: h.id,
            polygon: ring,
            pedDensity: typeof h.pedDensity === 'number' ? h.pedDensity : 0,
            carPeopleKm: typeof h.carPeopleKm === 'number' ? h.carPeopleKm : 0,
            cycleKm: typeof h.cycleKm === 'number' ? h.cycleKm : 0,
            pedNorm: typeof h.pedNorm === 'number' ? h.pedNorm : 0,
            carNorm: typeof h.carNorm === 'number' ? h.carNorm : 0,
            pedDominance: typeof h.pedDominance === 'number' ? h.pedDominance : 0
        });
    }

    const meta = candidate.meta as WalkingDataset['meta'];
    return {
        meta,
        stations,
        links,
        hexes
    };
}

function isCoordinatePair(val: unknown): val is [number, number] {
    return (
        Array.isArray(val) &&
        val.length === 2 &&
        typeof val[0] === 'number' &&
        Number.isFinite(val[0]) &&
        typeof val[1] === 'number' &&
        Number.isFinite(val[1])
    );
}

export function filterWalkingLinks(
    links: WalkingLink[],
    filter: CorridorFilter,
    maxWalkMinutes: number
): WalkingLink[] {
    return links.filter((link) => {
        if (link.walkMinutes > maxWalkMinutes) return false;
        switch (filter) {
            case 'faster':
                return link.timeSavedMinutes > 0;
            case 'parity':
                return link.timeSavedMinutes >= -3 && link.timeSavedMinutes <= 0;
            case 'nudge_gold':
                return link.quadrant === 'nudge_gold';
            case 'policy_priority':
                return link.quadrant === 'policy_priority';
            case 'all':
            default:
                return true;
        }
    });
}

export type FilteredMetrics = {
    count: number;
    fasterCount: number;
    meanWalkMinutes: number;
    medianSavedMinutes: number;
    totalPotentialSteps: number;
    spotlightLink: WalkingLink | null;
};

export function computeFilteredMetrics(
    links: WalkingLink[],
    selectedHub: HubPresetId
): FilteredMetrics {
    if (links.length === 0) {
        return {
            count: 0,
            fasterCount: 0,
            meanWalkMinutes: 0,
            medianSavedMinutes: 0,
            totalPotentialSteps: 0,
            spotlightLink: null
        };
    }

    const faster = links.filter((l) => l.timeSavedMinutes > 0);
    const totalWalk = links.reduce((acc, l) => acc + l.walkMinutes, 0);
    const totalSteps = links.reduce((acc, l) => acc + l.steps, 0);

    const sortedDeltas = links.map((l) => l.timeSavedMinutes).sort((a, b) => a - b);
    const mid = Math.floor(sortedDeltas.length / 2);
    const medianSaved =
        sortedDeltas.length % 2 === 0
            ? (sortedDeltas[mid - 1] + sortedDeltas[mid]) / 2
            : sortedDeltas[mid];

    const hubMeta = HUB_PRESETS[selectedHub];
    let spotlightPool = links;
    if (hubMeta.stationKey) {
        const directMatches = links.filter(
            (l) => l.fromId === hubMeta.stationKey || l.toId === hubMeta.stationKey
        );
        if (directMatches.length > 0) {
            spotlightPool = directMatches;
        } else {
            // Pick links geographically closest to the selected hub anchor
            const [hx, hy] = [hubMeta.view.longitude, hubMeta.view.latitude];
            spotlightPool = [...links]
                .sort((a, b) => {
                    const da = (a.start[0] - hx) ** 2 + (a.start[1] - hy) ** 2;
                    const db = (b.start[0] - hx) ** 2 + (b.start[1] - hy) ** 2;
                    return da - db;
                })
                .slice(0, 8);
        }
    }

    const spotlightLink =
        [...spotlightPool].sort((a, b) => b.timeSavedMinutes - a.timeSavedMinutes)[0] ?? null;

    return {
        count: links.length,
        fasterCount: faster.length,
        meanWalkMinutes: Math.round((totalWalk / links.length) * 10) / 10,
        medianSavedMinutes: Math.round(medianSaved * 10) / 10,
        totalPotentialSteps: totalSteps,
        spotlightLink
    };
}

export function deriveScreenMapView(
    baseView: ScreenMapViewState,
    c: number,
    r: number,
    wallCols: number,
    wallRows: number
): ScreenMapViewState {
    const viewport = new WebMercatorViewport({
        longitude: baseView.longitude,
        latitude: baseView.latitude,
        zoom: baseView.zoom,
        bearing: baseView.bearing,
        pitch: baseView.pitch,
        width: CANONICAL_SCREEN_WIDTH,
        height: CANONICAL_SCREEN_HEIGHT
    });

    const [centerX, centerY] = viewport.project([baseView.longitude, baseView.latitude]);
    const pixelOffsetX = (c + 0.5 - wallCols / 2) * CANONICAL_SCREEN_WIDTH;
    const pixelOffsetY = (r + 0.5 - wallRows / 2) * CANONICAL_SCREEN_HEIGHT;

    const [longitude, latitude] = viewport.unproject([
        centerX + pixelOffsetX,
        centerY + pixelOffsetY
    ]);

    return {
        ...baseView,
        longitude,
        latitude
    };
}
