export type NarrativeAct = 1 | 2 | 3 | 4;

export type CorridorFilter = 'all' | 'faster' | 'parity' | 'nudge_gold' | 'policy_priority';

export type HexLayerMode = 'off' | 'pedestrian' | 'balance';

export type HubPresetId =
    | 'overview'
    | 'south-kensington'
    | 'king-s-cross-saint-pancras'
    | 'oxford-circus'
    | 'bank'
    | 'waterloo'
    | 'whitechapel';

export type PolicyQuadrant = 'nudge_gold' | 'policy_priority' | 'parity_nudge' | 'rail_wins';

export type WalkingLink = {
    id: string;
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    start: [number, number];
    end: [number, number];
    line: string;
    lineColor: string;
    fromLines: string;
    toLines: string;
    walkMinutes: number;
    railMinutes: number;
    timeSavedMinutes: number;
    railHops: number;
    transfers: number;
    steps: number;
    kcal: number;
    straightKm: number;
    circuity: number;
    pedDensity: number;
    carPeopleKm: number;
    cycleKm: number;
    walkabilityScore: number;
    quadrant: PolicyQuadrant;
    isCrossLine: boolean;
    isOfficialQuicker: boolean;
};

export type WalkingStation = {
    id: string;
    name: string;
    position: [number, number];
    degree: number;
    fasterWalkCount: number;
    bestSavedMinutes: number;
};

export type MobilityHex = {
    id: number;
    polygon: Array<[number, number]>;
    pedDensity: number;
    carPeopleKm: number;
    cycleKm: number;
    pedNorm: number;
    carNorm: number;
    pedDominance: number;
};

export type DatasetSummary = {
    totalLinksModeled: number;
    totalStationsModeled: number;
    hexCellsExported: number;
    fasterOnFootCount: number;
    fasterOnFootPct: number;
    parityCount: number;
    nudgeGoldCount: number;
    policyPriorityCount: number;
    medianSavedWhenFasterMin: number;
    maxSavedMinutes: number;
    olsMinutesPerCrowKm: number;
    olsInterceptMinutes: number;
    olsRSquared: number;
    meanCircuity: number;
};

export type WalkingDataset = {
    meta: {
        title: string;
        source: string;
        summary: DatasetSummary;
    };
    stations: WalkingStation[];
    links: WalkingLink[];
    hexes: MobilityHex[];
};

export type ScreenMapViewState = {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
};

export type BusSharedState = {
    act: NarrativeAct;
    hub: HubPresetId;
    longitude?: number;
    latitude?: number;
    zoom: number;
    maxWalkMinutes: number;
    corridorFilter: CorridorFilter;
    hexMode: HexLayerMode;
};

export type BusMessage = {
    type: string;
    peerId?: string;
    peerCount?: number;
    [key: string]: unknown;
};

export type HelloBusMessage = BusMessage & {
    type: 'hello';
    peerId: string;
    peerCount?: number;
    state?: BusSharedState;
};

export type PeerLifecycleMessage = BusMessage & {
    type: 'peer' | 'bye';
    peerId: string;
    peerCount: number;
};

export type ScreenMapViewMessage = BusMessage & {
    type: 'screen/map-view';
    hub?: HubPresetId;
    view: Partial<ScreenMapViewState>;
};

export type ScreenAnalysisParamsMessage = BusMessage & {
    type: 'screen/analysis-params';
    act?: NarrativeAct;
    corridorFilter?: CorridorFilter;
    hexMode?: HexLayerMode;
    maxWalkMinutes?: number;
};

export type ControlZoomSliderMessage = BusMessage & {
    type: 'control/zoom-slider';
    value: number;
};

export type ControlWalkSliderMessage = BusMessage & {
    type: 'control/walk-slider';
    value: number;
};

export type EngineRole = 'screen' | 'control';

export type EngineConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type EngineStoreState = {
    role: EngineRole;
    peerId: string | null;
    peerCount: number;
    connection: EngineConnectionState;
    messageCount: number;
    lastMessageType: string | null;
    lastError: string | null;
};

export const DEFAULT_BUS_SHARED_STATE: BusSharedState = {
    act: 2,
    hub: 'overview',
    zoom: 12.6,
    maxWalkMinutes: 20,
    corridorFilter: 'faster',
    hexMode: 'balance'
};

export const createInitialEngineStoreState = (role: EngineRole): EngineStoreState => ({
    role,
    peerId: null,
    peerCount: 1,
    connection: 'idle',
    messageCount: 0,
    lastMessageType: null,
    lastError: null
});

export type ControlStoreState = EngineStoreState & {
    act: NarrativeAct;
    selectedHub: HubPresetId;
    zoomSliderValue: number;
    isZoomInteracting: boolean;
    maxWalkMinutes: number;
    isWalkInteracting: boolean;
    corridorFilter: CorridorFilter;
    hexMode: HexLayerMode;
    dataset: WalkingDataset | null;
};

export type ScreenStoreState = EngineStoreState & {
    act: NarrativeAct;
    selectedHub: HubPresetId;
    mapView: ScreenMapViewState;
    maxWalkMinutes: number;
    corridorFilter: CorridorFilter;
    hexMode: HexLayerMode;
    dataset: WalkingDataset | null;
    isDatasetLoading: boolean;
};

export const createInitialControlStoreState = (): ControlStoreState => ({
    ...createInitialEngineStoreState('control'),
    act: DEFAULT_BUS_SHARED_STATE.act,
    selectedHub: DEFAULT_BUS_SHARED_STATE.hub,
    zoomSliderValue: 38,
    isZoomInteracting: false,
    maxWalkMinutes: DEFAULT_BUS_SHARED_STATE.maxWalkMinutes,
    isWalkInteracting: false,
    corridorFilter: DEFAULT_BUS_SHARED_STATE.corridorFilter,
    hexMode: DEFAULT_BUS_SHARED_STATE.hexMode,
    dataset: null
});

export const createInitialScreenStoreState = (): ScreenStoreState => ({
    ...createInitialEngineStoreState('screen'),
    act: DEFAULT_BUS_SHARED_STATE.act,
    selectedHub: DEFAULT_BUS_SHARED_STATE.hub,
    mapView: {
        longitude: -0.1245,
        latitude: 51.5135,
        zoom: DEFAULT_BUS_SHARED_STATE.zoom,
        bearing: 0,
        pitch: 0
    },
    maxWalkMinutes: DEFAULT_BUS_SHARED_STATE.maxWalkMinutes,
    corridorFilter: DEFAULT_BUS_SHARED_STATE.corridorFilter,
    hexMode: DEFAULT_BUS_SHARED_STATE.hexMode,
    dataset: null,
    isDatasetLoading: false
});
