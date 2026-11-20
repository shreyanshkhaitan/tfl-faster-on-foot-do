import {
    ArrowsClockwiseIcon,
    ArrowsInSimpleIcon,
    ArrowsOutSimpleIcon,
    ArrowSquareOutIcon,
    CubeFocusIcon,
    GridFourIcon,
    MoonIcon,
    PlugsConnectedIcon,
    PlugsIcon,
    SunIcon,
    XIcon
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '../lib/theme-provider';

type WallScreen = {
    c: number;
    r: number;
    id: string;
};

type WallLayoutMode = 'curved' | 'flat';

const WALL_COLS = 3;
const WALL_ROWS = 2;

export const Route = createFileRoute('/')({
    component: HomePage
});

function HomePage() {
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';

    const [layoutMode, setLayoutMode] = useState<WallLayoutMode>('curved');
    const [wallMaximized, setWallMaximized] = useState(false);
    const [enlargedScreen, setEnlargedScreen] = useState<WallScreen | null>(null);
    const [disconnectedById, setDisconnectedById] = useState<Record<string, boolean>>({});
    const [refreshNonceById, setRefreshNonceById] = useState<Record<string, number>>({});
    const [disconnectedControlById, setDisconnectedControlById] = useState<Record<string, boolean>>(
        {}
    );
    const [refreshControlNonceById, setRefreshControlNonceById] = useState<Record<string, number>>(
        {}
    );

    useEffect(() => {
        if (!enlargedScreen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEnlargedScreen(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enlargedScreen]);

    const wallScreensByColumn = useMemo(() => {
        return Array.from({ length: WALL_COLS }, (_, c) =>
            Array.from(
                { length: WALL_ROWS },
                (__, r): WallScreen => ({
                    c,
                    r,
                    id: `${r}-${c}`
                })
            )
        );
    }, []);

    const controlPanels = [
        { id: 'a', label: 'Operator Tablet A · Story & Lens', src: '/control?operator=A' },
        { id: 'b', label: 'Operator Tablet B · Collaborative Sync', src: '/control?operator=B' }
    ];

    const toggleDisconnect = (id: string) => {
        setDisconnectedById((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const refreshFrame = (id: string) => {
        setRefreshNonceById((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    };

    const buildScreenSrc = (screen: WallScreen) => {
        const nonce = refreshNonceById[screen.id] ?? 0;
        const disconnected = disconnectedById[screen.id] ?? false;
        return disconnected
            ? `/noop?v=${nonce}`
            : `/screen?c=${screen.c}&r=${screen.r}&cols=${WALL_COLS}&rows=${WALL_ROWS}&v=${nonce}`;
    };

    const toggleControlDisconnect = (id: string) => {
        setDisconnectedControlById((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const refreshControlFrame = (id: string) => {
        setRefreshControlNonceById((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    };

    const buildControlSrc = (panel: (typeof controlPanels)[number]) => {
        const nonce = refreshControlNonceById[panel.id] ?? 0;
        const disconnected = disconnectedControlById[panel.id] ?? false;
        return disconnected ? `/noop?v=${nonce}` : `${panel.src}&v=${nonce}`;
    };

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-3 px-4 py-3 text-[var(--foreground)] md:h-screen md:overflow-hidden md:px-6">
            {/* Top Architectural Masthead */}
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="relative inline-flex size-7 items-center justify-center">
                        <span className="size-6 rounded-full border-4 border-[#e32017]" />
                        <span className="absolute h-1.5 w-7 rounded-xs bg-[#0019a8] dark:bg-blue-500" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-extrabold tracking-tight md:text-lg">
                                Faster on Foot · Imperial Data Observatory
                            </h1>
                            <span className="font-mono-tabular hidden rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-500 uppercase sm:inline-block dark:text-amber-300">
                                TfL Open Data × NetworkX
                            </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">
                            454 Zone 1–3 rail corridors &amp; 1,500 OSGB36 street mobility hexagons
                            synchronized across distributed wall nodes.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Simulator Mode Toggle: 313° Curved Enclosure vs Flat Matrix */}
                    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5">
                        <button
                            type="button"
                            onClick={() => setLayoutMode('curved')}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                layoutMode === 'curved'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            <CubeFocusIcon size={14} weight="duotone" />
                            313° Curved Room
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutMode('flat')}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                layoutMode === 'flat'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            <GridFourIcon size={14} weight="duotone" />
                            Flat 2×3 Matrix
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setWallMaximized((prev) => !prev)}
                        className="font-mono-tabular inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--card-foreground)] hover:bg-[var(--accent)]"
                        title={
                            wallMaximized
                                ? 'Show operator consoles below wall'
                                : 'Maximize 6-screen wall stage'
                        }
                    >
                        {wallMaximized ? (
                            <>
                                <ArrowsInSimpleIcon size={13} weight="bold" />
                                <span>Show Tablets</span>
                            </>
                        ) : (
                            <>
                                <ArrowsOutSimpleIcon size={13} weight="bold" />
                                <span>Maximize Wall</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => window.open('/screen', '_blank', 'noopener,noreferrer')}
                        className="font-mono-tabular hidden cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--card-foreground)] hover:bg-[var(--accent)] sm:inline-flex"
                        title="Open full-screen standalone Deck.GL display"
                    >
                        <span>Deck.GL Tab</span>
                        <ArrowSquareOutIcon size={13} weight="duotone" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                        className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 text-[var(--card-foreground)] hover:bg-[var(--accent)]"
                    >
                        {isDark ? (
                            <SunIcon size={16} weight="duotone" />
                        ) : (
                            <MoonIcon size={16} weight="duotone" />
                        )}
                    </button>
                </div>
            </header>

            {/* Data Observatory Multi-Screen Wall Stage */}
            <section className="relative flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[#06080b] p-3 shadow-inner">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono-tabular text-[11px] tracking-wider uppercase">
                        {layoutMode === 'curved'
                            ? '313° Wraparound Enclosure Preview · Hover any tile (including middle) to enlarge'
                            : 'Orthographic Wall Debugger · 2 Rows × 3 Columns'}
                    </span>
                    <span className="font-mono-tabular rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                        WebSocket /bus · Iframe-Safe MapLibre Path
                    </span>
                </div>

                {/*
                  True Triptych Hinge Geometry:
                  - Middle column (col 1) sits flush at Z = 0 so it never shrinks or falls behind
                    the pointer hit-testing plane (fixing hover/enlarge on middle screens).
                  - Left (col 0) & Right (col 2) columns hinge inward from their inner seams
                    (`right center` and `left center`), keeping seam heights 100% matched at Z >= 0.
                */}
                <div
                    className="m-auto flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden py-1"
                    style={{
                        perspective: layoutMode === 'curved' ? '1500px' : 'none'
                    }}
                >
                    <div
                        className="grid aspect-[8/3] max-h-full w-auto max-w-full grid-cols-3 gap-0 transition-transform duration-500"
                        style={{
                            height: '100%',
                            transformStyle: 'preserve-3d',
                            transform: layoutMode === 'curved' ? 'scale(0.93)' : 'scale(1)'
                        }}
                    >
                        {wallScreensByColumn.map((colScreens, colIdx) => {
                            const angleDeg = colIdx === 0 ? 18 : colIdx === 2 ? -18 : 0;
                            const columnTransform =
                                layoutMode === 'curved' ? `rotateY(${angleDeg}deg)` : 'none';

                            return (
                                <div
                                    key={`col-${colIdx}`}
                                    className="grid h-full min-h-0 grid-rows-2 transition-transform duration-500 ease-out"
                                    style={{
                                        transform: columnTransform,
                                        transformOrigin:
                                            colIdx === 0
                                                ? 'right center'
                                                : colIdx === 2
                                                  ? 'left center'
                                                  : 'center center'
                                    }}
                                >
                                    {colScreens.map((screen) => (
                                        <MiniWallScreen
                                            key={screen.id}
                                            c={screen.c}
                                            r={screen.r}
                                            src={buildScreenSrc(screen)}
                                            disconnected={disconnectedById[screen.id] ?? false}
                                            onEnlarge={() => setEnlargedScreen(screen)}
                                            onToggleDisconnect={() => toggleDisconnect(screen.id)}
                                            onRefresh={() => refreshFrame(screen.id)}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Dual Handheld Operator Consoles (collapsible when Wall is Maximized) */}
            {!wallMaximized ? (
                <section className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {controlPanels.map((panel) => (
                            <article
                                key={panel.id}
                                className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]"
                            >
                                <div className="flex items-center justify-between border-b border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">
                                    <span>{panel.label}</span>
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                window.open(
                                                    buildControlSrc(panel),
                                                    '_blank',
                                                    'noopener,noreferrer'
                                                )
                                            }
                                            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] hover:bg-[var(--accent)]"
                                            aria-label="Open control in new tab"
                                            title="Open control in new tab"
                                        >
                                            <ArrowSquareOutIcon size={12} weight="duotone" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleControlDisconnect(panel.id)}
                                            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] hover:bg-[var(--accent)]"
                                            aria-label={
                                                disconnectedControlById[panel.id]
                                                    ? 'Reconnect control'
                                                    : 'Disconnect control'
                                            }
                                            title={
                                                disconnectedControlById[panel.id]
                                                    ? 'Reconnect control'
                                                    : 'Disconnect control'
                                            }
                                        >
                                            {disconnectedControlById[panel.id] ? (
                                                <PlugsConnectedIcon size={12} weight="duotone" />
                                            ) : (
                                                <PlugsIcon size={12} weight="duotone" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => refreshControlFrame(panel.id)}
                                            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--card)] p-1 text-[var(--card-foreground)] hover:bg-[var(--accent)]"
                                            aria-label="Refresh control iframe"
                                            title="Refresh control iframe"
                                        >
                                            <ArrowsClockwiseIcon size={12} weight="duotone" />
                                        </button>
                                    </div>
                                </div>
                                <div className="h-[245px] bg-[var(--background)] md:h-[26vh] md:min-h-[215px]">
                                    <iframe
                                        src={buildControlSrc(panel)}
                                        title={panel.label}
                                        className="h-full w-full border-0"
                                    />
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* In-Page Enlarged Screen Modal (inspect any individual tile at large 16:9 scale) */}
            {enlargedScreen ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => setEnlargedScreen(null)}
                >
                    <div
                        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#090b0f] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 text-xs text-slate-200">
                            <span className="font-mono-tabular font-semibold">
                                ENLARGED DISPLAY NODE · COLUMN {enlargedScreen.c} · ROW{' '}
                                {enlargedScreen.r} (1920×1080)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        window.open(
                                            buildScreenSrc(enlargedScreen),
                                            '_blank',
                                            'noopener,noreferrer'
                                        )
                                    }
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    <span>Open Deck.GL Tab</span>
                                    <ArrowSquareOutIcon size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEnlargedScreen(null)}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                                >
                                    <XIcon size={13} weight="bold" />
                                    <span>Close (Esc)</span>
                                </button>
                            </div>
                        </div>
                        <div className="aspect-video w-full bg-[#090b0f]">
                            <ScaledFullHdFrame
                                src={buildScreenSrc(enlargedScreen)}
                                title={`Enlarged wall screen c${enlargedScreen.c} r${enlargedScreen.r}`}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}

type MiniWallScreenProps = {
    c: number;
    r: number;
    src: string;
    disconnected: boolean;
    onEnlarge: () => void;
    onToggleDisconnect: () => void;
    onRefresh: () => void;
};

function MiniWallScreen({
    c,
    r,
    src,
    disconnected,
    onEnlarge,
    onToggleDisconnect,
    onRefresh
}: MiniWallScreenProps) {
    return (
        <div className="group relative h-full w-full overflow-hidden border border-slate-900/90 bg-[#090b0f]">
            <ScaledFullHdFrame src={src} title={`Wall screen c${c} r${r}`} />

            {/* Bottom-center hover bar: never collides with corner HUD cards on outer tiles */}
            <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-700/90 bg-slate-950/92 px-2 py-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                <span className="font-mono-tabular pr-1 text-[10px] font-semibold text-amber-400">
                    c{c}·r{r}
                </span>
                <button
                    type="button"
                    onClick={onEnlarge}
                    className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-100 hover:border-amber-400 hover:text-amber-300"
                    aria-label={`Enlarge screen c${c} r${r}`}
                    title="Enlarge this screen"
                >
                    <ArrowsOutSimpleIcon size={13} weight="bold" />
                </button>
                <button
                    type="button"
                    onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
                    className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-100 hover:bg-slate-800"
                    aria-label="Open screen in new tab"
                    title="Open standalone Deck.GL node in new tab"
                >
                    <ArrowSquareOutIcon size={13} weight="duotone" />
                </button>
                <button
                    type="button"
                    onClick={onToggleDisconnect}
                    className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-100 hover:bg-slate-800"
                    aria-label={disconnected ? 'Reconnect screen' : 'Disconnect screen'}
                    title={disconnected ? 'Reconnect screen' : 'Disconnect screen'}
                >
                    {disconnected ? (
                        <PlugsConnectedIcon size={13} weight="duotone" />
                    ) : (
                        <PlugsIcon size={13} weight="duotone" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="cursor-pointer rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-100 hover:bg-slate-800"
                    aria-label="Refresh screen iframe"
                    title="Refresh screen iframe"
                >
                    <ArrowsClockwiseIcon size={13} weight="duotone" />
                </button>
            </div>
        </div>
    );
}

function ScaledFullHdFrame({ src, title }: { src: string; title: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        const updateScale = () => {
            setScale(node.clientWidth / 1920);
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden">
            <iframe
                src={src}
                title={title}
                scrolling="no"
                className="pointer-events-none absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left"
                style={{ transform: `scale(${scale})` }}
            />
        </div>
    );
}
