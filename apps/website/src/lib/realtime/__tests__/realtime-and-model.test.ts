import { describe, expect, it } from 'vite-plus/test';

import rawDatasetText from '../../../../public/data/tfl-walking-ds.json?raw';
import { applyMessageToSharedState } from '../bus-reducer';
import { clampWalkMinutes, clampZoom, sliderFromZoom, zoomFromSlider } from '../hub-presets';
import { DEFAULT_BUS_SHARED_STATE } from '../types';
import {
    computeFilteredMetrics,
    deriveScreenMapView,
    filterWalkingLinks,
    validateWalkingDataset
} from '../walking-dataset';

describe('DO WebSocket /bus state reducer & payload sanitization', () => {
    it('preserves canonical reference when inbound messages are malformed or no-op', () => {
        const initial = { ...DEFAULT_BUS_SHARED_STATE };
        expect(applyMessageToSharedState(initial, { type: 'unknown/event' })).toBe(initial);
        expect(
            applyMessageToSharedState(initial, {
                type: 'screen/map-view',
                hub: 'atlantis' as never,
                view: { zoom: Number.NaN }
            })
        ).toBe(initial);
    });

    it('clamps out-of-range zoom and walk-minute updates deterministically', () => {
        const afterMap = applyMessageToSharedState(DEFAULT_BUS_SHARED_STATE, {
            type: 'screen/map-view',
            hub: 'south-kensington',
            view: { zoom: 99 }
        });
        expect(afterMap.hub).toBe('south-kensington');
        expect(afterMap.zoom).toBe(clampZoom(99));

        const afterParams = applyMessageToSharedState(afterMap, {
            type: 'screen/analysis-params',
            act: 3,
            corridorFilter: 'policy_priority',
            hexMode: 'pedestrian',
            maxWalkMinutes: 2
        });
        expect(afterParams.act).toBe(3);
        expect(afterParams.corridorFilter).toBe('policy_priority');
        expect(afterParams.hexMode).toBe('pedestrian');
        expect(afterParams.maxWalkMinutes).toBe(clampWalkMinutes(2));
    });

    it('round-trips zoom <-> slider transforms consistently across operator tablets', () => {
        for (const slider of [0, 25, 50, 75, 100]) {
            const z = zoomFromSlider(slider);
            expect(sliderFromZoom(z)).toBeCloseTo(slider, 0);
        }
    });
});

describe('Multi-screen DO wall viewport projection math', () => {
    it('projects symmetric geographic offsets around the canonical wall center', () => {
        const base = {
            longitude: -0.1245,
            latitude: 51.5135,
            zoom: 13,
            bearing: 0,
            pitch: 0
        };

        const leftTop = deriveScreenMapView(base, 0, 0, 3, 2);
        const centerTop = deriveScreenMapView(base, 1, 0, 3, 2);
        const rightBottom = deriveScreenMapView(base, 2, 1, 3, 2);

        expect(centerTop.longitude).toBeCloseTo(base.longitude, 5);
        expect(leftTop.longitude).toBeLessThan(base.longitude);
        expect(rightBottom.longitude).toBeGreaterThan(base.longitude);
        expect(leftTop.latitude).toBeGreaterThan(base.latitude);
        expect(rightBottom.latitude).toBeLessThan(base.latitude);
    });
});

describe('Python-generated TfL walking & hex spatial dataset integrity', () => {
    const rawJson = JSON.parse(rawDatasetText) as unknown;
    const validated = validateWalkingDataset(rawJson);

    it('validates the canonical TfL dataset without dropping records', () => {
        expect(validated).not.toBeNull();
        if (!validated) return;

        expect(validated.links.length).toBeGreaterThan(400);
        expect(validated.stations.length).toBeGreaterThan(300);
        expect(validated.hexes.length).toBe(1500);
        expect(validated.meta.summary.olsRSquared).toBeGreaterThan(0.65);
    });

    it('filters faster-on-foot corridors and identifies South Kensington spotlight', () => {
        if (!validated) throw new Error('Dataset missing');

        const fasterUnder20 = filterWalkingLinks(validated.links, 'faster', 20);
        expect(fasterUnder20.length).toBeGreaterThan(50);
        expect(fasterUnder20.every((l) => l.timeSavedMinutes > 0 && l.walkMinutes <= 20)).toBe(
            true
        );

        const imperialMetrics = computeFilteredMetrics(validated.links, 'south-kensington');
        expect(imperialMetrics.spotlightLink).not.toBeNull();
        expect(
            imperialMetrics.spotlightLink?.fromId === 'south-kensington' ||
                imperialMetrics.spotlightLink?.toId === 'south-kensington'
        ).toBe(true);
    });
});
