import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

import { Slider } from '../components/slider';
import { controlEngine } from '../lib/realtime/engines/control-engine';
import {
    ACT_LIST,
    HUB_LIST,
    WALK_MINUTES_MAX,
    WALK_MINUTES_MIN,
    zoomFromSlider
} from '../lib/realtime/hub-presets';
import { useControlStore } from '../lib/realtime/stores/control-store';
import type { CorridorFilter, HexLayerMode } from '../lib/realtime/types';
import { computeFilteredMetrics, filterWalkingLinks } from '../lib/realtime/walking-dataset';

type ControlSearch = {
    operator: string;
};

const CORRIDOR_FILTERS: Array<{ value: CorridorFilter; label: string; dotClass: string }> = [
    { value: 'faster', label: 'Faster Walk (ΔT > 0)', dotClass: 'bg-amber-400' },
    { value: 'nudge_gold', label: 'Signpost Ready', dotClass: 'bg-amber-300' },
    { value: 'policy_priority', label: 'Traffic Bottlenecks', dotClass: 'bg-rose-500' },
    { value: 'parity', label: '≤3m Parity Swaps', dotClass: 'bg-teal-400' },
    { value: 'all', label: 'All 454 Links', dotClass: 'bg-slate-400' }
];

const HEX_MODES: Array<{ value: HexLayerMode; label: string }> = [
    { value: 'balance', label: 'Ped vs. Car Hex' },
    { value: 'pedestrian', label: '24h Footfall' },
    { value: 'off', label: 'Hex Off' }
];

export const Route = createFileRoute('/control')({
    validateSearch: (search: Record<string, unknown>): ControlSearch => ({
        operator: typeof search.operator === 'string' ? search.operator : 'A'
    }),
    component: ControlPage
});

function ControlPage() {
    const { operator } = Route.useSearch();

    useEffect(() => {
        controlEngine.bootstrapClient();
    }, []);

    const connection = useControlStore((state) => state.connection);
    const peerCount = useControlStore((state) => state.peerCount);
    const act = useControlStore((state) => state.act);
    const selectedHub = useControlStore((state) => state.selectedHub);
    const zoomSliderValue = useControlStore((state) => state.zoomSliderValue);
    const maxWalkMinutes = useControlStore((state) => state.maxWalkMinutes);
    const corridorFilter = useControlStore((state) => state.corridorFilter);
    const hexMode = useControlStore((state) => state.hexMode);
    const dataset = useControlStore((state) => state.dataset);

    const activeMetrics = useMemo(() => {
        if (!dataset) return null;
        const filtered = filterWalkingLinks(dataset.links, corridorFilter, maxWalkMinutes);
        return computeFilteredMetrics(filtered, selectedHub);
    }, [dataset, corridorFilter, maxWalkMinutes, selectedHub]);

    const currentZoom = zoomFromSlider(zoomSliderValue);
    const isConnected = connection === 'open';

    return (
        <main className="h-screen w-screen overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
            <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-1.5 p-2">
                {/* Operator Header */}
                <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
                    <div className="flex items-center gap-2.5">
                        <span className="relative inline-flex size-5 items-center justify-center">
                            <span className="size-4 rounded-full border-[3px] border-[#e32017]" />
                            <span className="absolute h-[3px] w-5 rounded-xs bg-[#0019a8] dark:bg-blue-500" />
                        </span>
                        <div>
                            <p className="font-mono-tabular text-[10px] font-semibold tracking-[0.16em] text-[var(--muted-foreground)] uppercase">
                                DO Broadcast Console · Unit {operator}
                            </p>
                            <h1 className="text-xs font-bold tracking-tight sm:text-sm">
                                Guided Story &amp; Spatial Parameter Deck
                            </h1>
                        </div>
                    </div>

                    <div className="font-mono-tabular flex items-center gap-2 text-[11px]">
                        {activeMetrics ? (
                            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-500 dark:text-amber-300">
                                {activeMetrics.count} links · {activeMetrics.fasterCount} faster
                            </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[var(--secondary-foreground)]">
                            <span
                                className={`size-2 rounded-full ${
                                    isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                                }`}
                            />
                            {isConnected ? `${peerCount} peers` : connection}
                        </span>
                    </div>
                </header>

                {/* Row 1: 4 Guided Narrative Story Acts */}
                <section
                    aria-label="Narrative Story Acts"
                    className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                >
                    {ACT_LIST.map((item) => {
                        const selected = act === item.act;
                        return (
                            <button
                                key={item.act}
                                type="button"
                                onClick={() => controlEngine.selectAct(item.act)}
                                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                                    selected
                                        ? 'border-amber-500 bg-amber-500/14 text-[var(--foreground)]'
                                        : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
                                }`}
                            >
                                <p className="font-mono-tabular text-[10px] font-bold tracking-wider text-amber-500 uppercase dark:text-amber-400">
                                    Act 0{item.act}
                                </p>
                                <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                                    {item.title}
                                </p>
                            </button>
                        );
                    })}
                </section>

                {/* Row 2: Camera Hubs, DS Filters, and Continuous Scrubbers */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                    {/* London Camera Presets & Pan Controls */}
                    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 sm:col-span-5">
                        <div className="mb-1 flex items-center justify-between">
                            <p className="font-mono-tabular text-[10px] font-semibold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
                                1 · Station Anchors &amp; Pan
                            </p>
                            <div className="font-mono-tabular inline-flex items-center gap-1 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => controlEngine.panWall(-1, 0)}
                                    className="cursor-pointer rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 hover:bg-[var(--accent)]"
                                    title="Pan wall west (left)"
                                >
                                    ←
                                </button>
                                <button
                                    type="button"
                                    onClick={() => controlEngine.panWall(0, 1)}
                                    className="cursor-pointer rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 hover:bg-[var(--accent)]"
                                    title="Pan wall north (up)"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    onClick={() => controlEngine.panWall(0, -1)}
                                    className="cursor-pointer rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 hover:bg-[var(--accent)]"
                                    title="Pan wall south (down)"
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    onClick={() => controlEngine.panWall(1, 0)}
                                    className="cursor-pointer rounded border border-[var(--border)] bg-[var(--secondary)] px-1.5 py-0.5 hover:bg-[var(--accent)]"
                                    title="Pan wall east (right)"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            {HUB_LIST.map((hub) => {
                                const active = selectedHub === hub.id;
                                return (
                                    <button
                                        key={hub.id}
                                        type="button"
                                        onClick={() => controlEngine.selectHub(hub.id)}
                                        className={`cursor-pointer truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                                            active
                                                ? 'border-amber-500/80 bg-amber-500 font-semibold text-slate-950'
                                                : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)]'
                                        }`}
                                        title={hub.label}
                                    >
                                        {hub.shortLabel}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Policy Quadrant & Hex Street Filters */}
                    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 sm:col-span-4">
                        <p className="font-mono-tabular mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-[var(--muted-foreground)] uppercase">
                            2 · Model Quadrant &amp; Hex Grid
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {CORRIDOR_FILTERS.map((f) => {
                                const active = corridorFilter === f.value;
                                return (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => controlEngine.setCorridorFilter(f.value)}
                                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                            active
                                                ? 'border-amber-500/70 bg-amber-500/18 font-semibold text-[var(--foreground)]'
                                                : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                        }`}
                                    >
                                        <span className={`size-2 rounded-full ${f.dotClass}`} />
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[var(--border)] pt-2">
                            {HEX_MODES.map((m) => {
                                const active = hexMode === m.value;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => controlEngine.setHexMode(m.value)}
                                        className={`cursor-pointer rounded-md border px-1.5 py-1 text-center text-[10px] font-semibold transition-colors ${
                                            active
                                                ? 'border-emerald-500/60 bg-emerald-500/18 text-emerald-600 dark:text-emerald-300'
                                                : 'border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)]'
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Continuous Throttled Scrubbers */}
                    <section className="flex flex-col justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 sm:col-span-3">
                        <div>
                            <div className="font-mono-tabular flex items-center justify-between text-[10px] font-semibold uppercase">
                                <span className="text-[var(--muted-foreground)]">Max Walk</span>
                                <span className="text-amber-500 dark:text-amber-400">
                                    ≤ {maxWalkMinutes} min
                                </span>
                            </div>
                            <Slider
                                min={WALK_MINUTES_MIN}
                                max={WALK_MINUTES_MAX}
                                step={1}
                                value={maxWalkMinutes}
                                ariaLabel="Maximum walk time in minutes"
                                onValueChange={(val) => controlEngine.setMaxWalkMinutes(val)}
                                onInteractionChange={(interacting) =>
                                    controlEngine.setWalkInteracting(interacting)
                                }
                            />
                        </div>

                        <div className="mt-1 border-t border-[var(--border)] pt-1.5">
                            <div className="font-mono-tabular flex items-center justify-between text-[10px] font-semibold uppercase">
                                <span className="text-[var(--muted-foreground)]">Wall Zoom</span>
                                <span className="text-[var(--foreground)]">
                                    {currentZoom.toFixed(1)}z
                                </span>
                            </div>
                            <Slider
                                min={0}
                                max={100}
                                step={1}
                                value={zoomSliderValue}
                                ariaLabel="Wall map zoom level"
                                onValueChange={(val) => controlEngine.setZoomSliderValue(val)}
                                onInteractionChange={(interacting) =>
                                    controlEngine.setZoomInteracting(interacting)
                                }
                            />
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
