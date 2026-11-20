import {
    clampWalkMinutes,
    clampZoom,
    getHubMapView,
    isCorridorFilter,
    isHexLayerMode,
    isHubPresetId,
    isNarrativeAct
} from '../hub-presets';
import { screenStore } from '../stores/screen-store';
import type {
    BusMessage,
    HelloBusMessage,
    ScreenAnalysisParamsMessage,
    ScreenMapViewMessage,
    ScreenMapViewState,
    ScreenStoreState
} from '../types';
import { loadWalkingDataset } from '../walking-dataset';
import { BusEngine } from './bus-engine';

export class ScreenEngine extends BusEngine<ScreenStoreState> {
    private hasAttemptedLoad = false;

    private constructor() {
        super('screen', screenStore);
    }

    bootstrapClient() {
        this.ensureConnected();
        void this.ensureDatasetLoaded();
    }

    static getInstance() {
        const globalObj = globalThis as typeof globalThis & {
            __screenEngineInstance?: ScreenEngine;
        };
        if (!globalObj.__screenEngineInstance) {
            globalObj.__screenEngineInstance = new ScreenEngine();
        }
        return globalObj.__screenEngineInstance;
    }

    async ensureDatasetLoaded() {
        if (typeof window === 'undefined') return;
        if (this.hasAttemptedLoad || this.store.state.dataset !== null) return;

        this.hasAttemptedLoad = true;
        this.store.setState((prev) => ({
            ...prev,
            isDatasetLoading: true
        }));

        const dataset = await loadWalkingDataset();
        if (!dataset) {
            this.hasAttemptedLoad = false;
            this.store.setState((prev) => ({
                ...prev,
                isDatasetLoading: false
            }));
            return;
        }

        this.store.setState((prev) => ({
            ...prev,
            dataset,
            isDatasetLoading: false
        }));
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'screen/map-view') {
            this.applyMapViewMessage(message as ScreenMapViewMessage);
            return;
        }

        if (message.type === 'screen/analysis-params') {
            this.applyAnalysisParams(message as ScreenAnalysisParamsMessage);
        }
    }

    protected override onHello(hello: HelloBusMessage) {
        if (!hello.state) return;
        this.applyMapViewMessage({
            type: 'screen/map-view',
            hub: hello.state.hub,
            view: {
                longitude: hello.state.longitude,
                latitude: hello.state.latitude,
                zoom: hello.state.zoom
            }
        });
        this.applyAnalysisParams({
            type: 'screen/analysis-params',
            act: hello.state.act,
            corridorFilter: hello.state.corridorFilter,
            hexMode: hello.state.hexMode,
            maxWalkMinutes: hello.state.maxWalkMinutes
        });
    }

    private applyMapViewMessage(msg: ScreenMapViewMessage) {
        this.store.setState((prev) => {
            let nextView: ScreenMapViewState = prev.mapView;
            let nextHub = prev.selectedHub;

            if (isHubPresetId(msg.hub)) {
                nextHub = msg.hub;
                nextView = {
                    ...nextView,
                    ...getHubMapView(msg.hub)
                };
            }

            if (msg.view && typeof msg.view === 'object') {
                const v = msg.view;
                nextView = {
                    ...nextView,
                    longitude:
                        typeof v.longitude === 'number' && Number.isFinite(v.longitude)
                            ? v.longitude
                            : nextView.longitude,
                    latitude:
                        typeof v.latitude === 'number' && Number.isFinite(v.latitude)
                            ? v.latitude
                            : nextView.latitude,
                    zoom:
                        typeof v.zoom === 'number' && Number.isFinite(v.zoom)
                            ? clampZoom(v.zoom)
                            : nextView.zoom,
                    bearing:
                        typeof v.bearing === 'number' && Number.isFinite(v.bearing)
                            ? v.bearing
                            : nextView.bearing,
                    pitch:
                        typeof v.pitch === 'number' && Number.isFinite(v.pitch)
                            ? v.pitch
                            : nextView.pitch
                };
            }

            return {
                ...prev,
                selectedHub: nextHub,
                mapView: nextView
            };
        });
    }

    private applyAnalysisParams(msg: ScreenAnalysisParamsMessage) {
        this.store.setState((prev) => {
            const nextAct = isNarrativeAct(msg.act) ? msg.act : prev.act;
            const nextFilter = isCorridorFilter(msg.corridorFilter)
                ? msg.corridorFilter
                : prev.corridorFilter;
            const nextHex = isHexLayerMode(msg.hexMode) ? msg.hexMode : prev.hexMode;
            const nextWalk =
                typeof msg.maxWalkMinutes === 'number' && Number.isFinite(msg.maxWalkMinutes)
                    ? clampWalkMinutes(msg.maxWalkMinutes)
                    : prev.maxWalkMinutes;

            if (
                prev.act === nextAct &&
                prev.corridorFilter === nextFilter &&
                prev.hexMode === nextHex &&
                prev.maxWalkMinutes === nextWalk
            ) {
                return prev;
            }

            return {
                ...prev,
                act: nextAct,
                corridorFilter: nextFilter,
                hexMode: nextHex,
                maxWalkMinutes: nextWalk
            };
        });
    }
}

export const screenEngine = ScreenEngine.getInstance();
