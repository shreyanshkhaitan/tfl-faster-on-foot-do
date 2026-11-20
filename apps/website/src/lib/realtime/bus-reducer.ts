import {
    clampWalkMinutes,
    clampZoom,
    isCorridorFilter,
    isHexLayerMode,
    isHubPresetId,
    isNarrativeAct
} from './hub-presets';
import type {
    BusMessage,
    BusSharedState,
    ScreenAnalysisParamsMessage,
    ScreenMapViewMessage
} from './types';

/**
 * Pure, schema-validated state reducer for the `/bus` canonical snapshot.
 * Malformed or out-of-bounds fields are safely ignored so untrusted payloads
 * cannot corrupt shared wall state.
 */
export function applyMessageToSharedState(
    current: BusSharedState,
    payload: Partial<BusMessage>
): BusSharedState {
    if (payload.type === 'screen/map-view') {
        const msg = payload as Partial<ScreenMapViewMessage>;
        const nextHub = isHubPresetId(msg.hub) ? msg.hub : current.hub;
        const nextZoom =
            typeof msg.view?.zoom === 'number' && Number.isFinite(msg.view.zoom)
                ? clampZoom(msg.view.zoom)
                : current.zoom;
        const nextLon =
            typeof msg.view?.longitude === 'number' && Number.isFinite(msg.view.longitude)
                ? Math.round(msg.view.longitude * 100000) / 100000
                : isHubPresetId(msg.hub) && msg.hub !== current.hub
                  ? undefined
                  : current.longitude;
        const nextLat =
            typeof msg.view?.latitude === 'number' && Number.isFinite(msg.view.latitude)
                ? Math.round(msg.view.latitude * 100000) / 100000
                : isHubPresetId(msg.hub) && msg.hub !== current.hub
                  ? undefined
                  : current.latitude;

        if (
            nextHub === current.hub &&
            nextZoom === current.zoom &&
            nextLon === current.longitude &&
            nextLat === current.latitude
        ) {
            return current;
        }
        return {
            ...current,
            hub: nextHub,
            longitude: nextLon,
            latitude: nextLat,
            zoom: nextZoom
        };
    }

    if (payload.type === 'screen/analysis-params') {
        const msg = payload as Partial<ScreenAnalysisParamsMessage>;
        const nextAct = isNarrativeAct(msg.act) ? msg.act : current.act;
        const nextFilter = isCorridorFilter(msg.corridorFilter)
            ? msg.corridorFilter
            : current.corridorFilter;
        const nextHex = isHexLayerMode(msg.hexMode) ? msg.hexMode : current.hexMode;
        const nextWalk =
            typeof msg.maxWalkMinutes === 'number' && Number.isFinite(msg.maxWalkMinutes)
                ? clampWalkMinutes(msg.maxWalkMinutes)
                : current.maxWalkMinutes;

        if (
            nextAct === current.act &&
            nextFilter === current.corridorFilter &&
            nextHex === current.hexMode &&
            nextWalk === current.maxWalkMinutes
        ) {
            return current;
        }

        return {
            ...current,
            act: nextAct,
            corridorFilter: nextFilter,
            hexMode: nextHex,
            maxWalkMinutes: nextWalk
        };
    }

    return current;
}
