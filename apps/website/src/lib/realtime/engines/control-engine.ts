import { throttle } from '@tanstack/pacer';

import {
    clampWalkMinutes,
    clampZoom,
    getHubMapView,
    isCorridorFilter,
    isHexLayerMode,
    isHubPresetId,
    isNarrativeAct,
    NARRATIVE_ACTS,
    SLIDER_MAX,
    SLIDER_MIN,
    sliderFromZoom,
    zoomFromSlider
} from '../hub-presets';
import { controlStore } from '../stores/control-store';
import type {
    BusMessage,
    ControlStoreState,
    ControlWalkSliderMessage,
    ControlZoomSliderMessage,
    CorridorFilter,
    HelloBusMessage,
    HexLayerMode,
    HubPresetId,
    NarrativeAct,
    ScreenAnalysisParamsMessage,
    ScreenMapViewMessage
} from '../types';
import { loadWalkingDataset } from '../walking-dataset';
import { BusEngine } from './bus-engine';

const SLIDER_BROADCAST_WAIT_MS = 90;

export class ControlEngine extends BusEngine<ControlStoreState> {
    private hasRequestedDataset = false;
    private panLonOffset = 0;
    private panLatOffset = 0;

    private readonly broadcastZoomThrottled = throttle(
        (sliderVal: number, zoom: number) => {
            const peerId = this.getPeerId() ?? undefined;
            this.send({
                type: 'control/zoom-slider',
                value: sliderVal,
                peerId
            });
            this.send({
                type: 'screen/map-view',
                hub: this.store.state.selectedHub,
                view: { zoom },
                peerId
            });
        },
        {
            wait: SLIDER_BROADCAST_WAIT_MS,
            leading: true,
            trailing: true
        }
    );

    private readonly broadcastWalkMinutesThrottled = throttle(
        (minutes: number) => {
            const peerId = this.getPeerId() ?? undefined;
            this.send({
                type: 'control/walk-slider',
                value: minutes,
                peerId
            });
            this.send({
                type: 'screen/analysis-params',
                maxWalkMinutes: minutes,
                peerId
            });
        },
        {
            wait: SLIDER_BROADCAST_WAIT_MS,
            leading: true,
            trailing: true
        }
    );

    private constructor() {
        super('control', controlStore);
    }

    bootstrapClient() {
        this.ensureConnected();
        void this.ensureDatasetLoaded();
    }

    static getInstance() {
        const globalObj = globalThis as typeof globalThis & {
            __controlEngineInstance?: ControlEngine;
        };
        if (!globalObj.__controlEngineInstance) {
            globalObj.__controlEngineInstance = new ControlEngine();
        }
        return globalObj.__controlEngineInstance;
    }

    async ensureDatasetLoaded() {
        if (typeof window === 'undefined') return;
        if (this.hasRequestedDataset || this.store.state.dataset) return;
        this.hasRequestedDataset = true;
        const dataset = await loadWalkingDataset();
        if (!dataset) {
            this.hasRequestedDataset = false;
            return;
        }
        this.store.setState((prev) => ({
            ...prev,
            dataset
        }));
    }

    selectAct(act: NarrativeAct) {
        const preset = NARRATIVE_ACTS[act].preset;
        const sliderVal = sliderFromZoom(preset.zoom);
        this.panLonOffset = 0;
        this.panLatOffset = 0;

        this.store.setState((prev) => ({
            ...prev,
            act: preset.act,
            selectedHub: preset.hub,
            zoomSliderValue: sliderVal,
            maxWalkMinutes: preset.maxWalkMinutes,
            corridorFilter: preset.corridorFilter,
            hexMode: preset.hexMode
        }));

        const peerId = this.getPeerId() ?? undefined;
        this.send({
            type: 'screen/map-view',
            hub: preset.hub,
            view: {
                ...getHubMapView(preset.hub),
                zoom: preset.zoom
            },
            peerId
        });
        this.send({
            type: 'screen/analysis-params',
            act: preset.act,
            corridorFilter: preset.corridorFilter,
            hexMode: preset.hexMode,
            maxWalkMinutes: preset.maxWalkMinutes,
            peerId
        });
    }

    selectHub(hub: HubPresetId) {
        const targetView = getHubMapView(hub);
        const nextSlider = sliderFromZoom(targetView.zoom);
        this.panLonOffset = 0;
        this.panLatOffset = 0;

        this.store.setState((prev) => ({
            ...prev,
            selectedHub: hub,
            zoomSliderValue: nextSlider
        }));

        this.send({
            type: 'screen/map-view',
            hub,
            view: targetView,
            peerId: this.getPeerId() ?? undefined
        });
    }

    panWall(dirX: -1 | 0 | 1, dirY: -1 | 0 | 1) {
        const currentZoom = zoomFromSlider(this.store.state.zoomSliderValue);
        const base = getHubMapView(this.store.state.selectedHub);
        // Scale geographic pan step cleanly with current zoom level
        const scale = Math.pow(2, 13 - currentZoom);
        this.panLonOffset = Math.max(
            -0.22,
            Math.min(0.22, this.panLonOffset + dirX * 0.022 * scale)
        );
        this.panLatOffset = Math.max(
            -0.14,
            Math.min(0.14, this.panLatOffset + dirY * 0.014 * scale)
        );

        this.send({
            type: 'screen/map-view',
            hub: this.store.state.selectedHub,
            view: {
                longitude: base.longitude + this.panLonOffset,
                latitude: base.latitude + this.panLatOffset,
                zoom: currentZoom
            },
            peerId: this.getPeerId() ?? undefined
        });
    }

    setCorridorFilter(corridorFilter: CorridorFilter) {
        let changed = false;
        this.store.setState((prev) => {
            if (prev.corridorFilter === corridorFilter) return prev;
            changed = true;
            return { ...prev, corridorFilter };
        });
        if (!changed) return;

        this.send({
            type: 'screen/analysis-params',
            corridorFilter,
            peerId: this.getPeerId() ?? undefined
        });
    }

    setHexMode(hexMode: HexLayerMode) {
        let changed = false;
        this.store.setState((prev) => {
            if (prev.hexMode === hexMode) return prev;
            changed = true;
            return { ...prev, hexMode };
        });
        if (!changed) return;

        this.send({
            type: 'screen/analysis-params',
            hexMode,
            peerId: this.getPeerId() ?? undefined
        });
    }

    setZoomInteracting(isZoomInteracting: boolean) {
        this.store.setState((prev) =>
            prev.isZoomInteracting === isZoomInteracting ? prev : { ...prev, isZoomInteracting }
        );
    }

    setZoomSliderValue(raw: number) {
        const clamped = Math.round(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, raw)));
        this.store.setState((prev) =>
            prev.zoomSliderValue === clamped ? prev : { ...prev, zoomSliderValue: clamped }
        );
        this.broadcastZoomThrottled(clamped, zoomFromSlider(clamped));
    }

    setWalkInteracting(isWalkInteracting: boolean) {
        this.store.setState((prev) =>
            prev.isWalkInteracting === isWalkInteracting ? prev : { ...prev, isWalkInteracting }
        );
    }

    setMaxWalkMinutes(raw: number) {
        const clamped = clampWalkMinutes(raw);
        this.store.setState((prev) =>
            prev.maxWalkMinutes === clamped ? prev : { ...prev, maxWalkMinutes: clamped }
        );
        this.broadcastWalkMinutesThrottled(clamped);
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'control/zoom-slider') {
            const msg = message as ControlZoomSliderMessage;
            if (typeof msg.value !== 'number') return;
            this.store.setState((prev) => {
                if (prev.isZoomInteracting) return prev;
                const clamped = Math.round(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, msg.value)));
                return prev.zoomSliderValue === clamped
                    ? prev
                    : { ...prev, zoomSliderValue: clamped };
            });
            return;
        }

        if (message.type === 'control/walk-slider') {
            const msg = message as ControlWalkSliderMessage;
            if (typeof msg.value !== 'number') return;
            this.store.setState((prev) => {
                if (prev.isWalkInteracting) return prev;
                const clamped = clampWalkMinutes(msg.value);
                return prev.maxWalkMinutes === clamped
                    ? prev
                    : { ...prev, maxWalkMinutes: clamped };
            });
            return;
        }

        if (message.type === 'screen/map-view') {
            const msg = message as ScreenMapViewMessage;
            this.store.setState((prev) => {
                const nextHub = isHubPresetId(msg.hub) ? msg.hub : prev.selectedHub;
                const nextSlider =
                    !prev.isZoomInteracting && typeof msg.view?.zoom === 'number'
                        ? sliderFromZoom(clampZoom(msg.view.zoom))
                        : prev.zoomSliderValue;
                if (prev.selectedHub === nextHub && prev.zoomSliderValue === nextSlider) {
                    return prev;
                }
                return {
                    ...prev,
                    selectedHub: nextHub,
                    zoomSliderValue: nextSlider
                };
            });
            return;
        }

        if (message.type === 'screen/analysis-params') {
            const msg = message as ScreenAnalysisParamsMessage;
            this.store.setState((prev) => {
                const nextAct = isNarrativeAct(msg.act) ? msg.act : prev.act;
                const nextFilter = isCorridorFilter(msg.corridorFilter)
                    ? msg.corridorFilter
                    : prev.corridorFilter;
                const nextHex = isHexLayerMode(msg.hexMode) ? msg.hexMode : prev.hexMode;
                const nextWalk =
                    !prev.isWalkInteracting && typeof msg.maxWalkMinutes === 'number'
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

    protected override onHello(hello: HelloBusMessage) {
        const state = hello.state;
        if (!state) return;

        this.store.setState((prev) => ({
            ...prev,
            act: isNarrativeAct(state.act) ? state.act : prev.act,
            selectedHub: isHubPresetId(state.hub) ? state.hub : prev.selectedHub,
            zoomSliderValue: sliderFromZoom(state.zoom),
            maxWalkMinutes: clampWalkMinutes(state.maxWalkMinutes),
            corridorFilter: isCorridorFilter(state.corridorFilter)
                ? state.corridorFilter
                : prev.corridorFilter,
            hexMode: isHexLayerMode(state.hexMode) ? state.hexMode : prev.hexMode
        }));
    }
}

export const controlEngine = ControlEngine.getInstance();
