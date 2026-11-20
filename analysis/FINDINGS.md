# Data Science Methodology & Empirical Findings

## 1. Datasets Combined (`walking.data.tfl.gov.uk` + TfL Unified API)

- **Zones 1–3 Rail Walk Network**: 441 adjacent station pairs across Tube, DLR, Overground, Elizabeth line, and National Rail.
- **Cross-Line Shortcuts**: 52 inter-line station pairs with street walking times and pedometer step counts.
- **London Hexagonal Mobility Grid (`HAM_Cyn_Ped_HexData_v2.shp`)**: 15,041 spatial hexagons in OSGB36 (`EPSG:27700`) recording 24-hour weekday pedestrian density (`PD_24hou_1`), AM-peak highway people-km (`PEOPLEKM_1`), and cycle-km (`CycleKM14`).
- **Data Hygiene Audit**: Automated reconciliation against TfL's 20-line route sequence API caught and corrected **6 clerical typos** inside TfL's official spreadsheets (notably Row 282 of the Zones 1–3 sheet, which blended _Chalk Farm_ and _Belsize Park_ into `"Belsize Farm"`, alongside `"Caldedonian Road"`, `"Mornington Cresecent"`, `"Kiburn Park"`, `"Canonsbury"`, and `"Tuffnell Park"`).

## 2. Network & Spatial Models

1. **State-Expanded Transit Graph ($G$)**: Constructed in `networkx` with platform nodes `(station, line)` and street portals `(station, STREET)`. Edge weights incorporate empirical vertical escalator/shaft access penalties (3.4 min per end on deep-level Tube; 2.5 min sub-surface/Elizabeth; 2.7 min Overground/DLR/NR), track run times + 0.45 min dwell, and **4.5-minute intra-station line transfer penalties**.
2. **Street Circuity OLS Model**: Regressing official street walking minutes on Haversine crow-flies distance across $N = 456$ corridors yields:
   $$T_{\text{walk}} = 14.57\, d_{\text{crow}(\text{km})} + 0.92 \quad (R^2 = 0.724)$$
   corresponding to a mean Central London street circuity (detour factor) of **$\bar{\tau} = 1.24\times$**.
3. **Hexagonal Street Comfort Join**: Sampling 9 points in `EPSG:27700` meters along each walking vector intersects underlying mobility hexagons to score active-travel comfort vs. motor-traffic exposure (`walkabilityScore` $\in [0, 100]$).

## 3. Key Policy Findings for _Data for Humanity_

- **83 corridors (18.2%)** across Zones 1–3 are **strictly faster on foot** ($\Delta T > 0$) than descending into the rail network, saving a median of **4.8 minutes** (and up to **+32.7 minutes** on cross-line doglegs).
- Another **58 corridors** sit inside a **3-minute parity window** ($-3 \le \Delta T \le 0$ min), representing zero-cost peak-crowding relief swaps.
- **Two-Quadrant Policy Split**:
    - **70 "Immediate Nudge" Corridors (`nudge_gold`)**: Faster on foot _and_ routed through high-pedestrian, lower-traffic streets—solvable today via better station exit wayfinding.
    - **13 "Healthy Streets Priority" Corridors (`policy_priority`)**: Faster on foot geometrically, _yet_ exposed to heavy AM-peak vehicle people-km—pinpointing exact Central/Inner London links where wider pavements and pedestrian crossings unlock latent active travel.

## 4. Top 12 Highest Time-Saving Walking Shortcuts

| Corridor                            | Street Walk | Modeled Rail | Net Time Saved | Transfers Avoided | Steps | Street Comfort |
| :---------------------------------- | :---------: | :----------: | :------------: | :---------------: | :---: | :------------: |
| New Cross ↔ Deptford Bridge         |    8 min    |   40.7 min   | **+32.7 min**  |         2         |  800  |     44/100     |
| Kentish Town West ↔ Chalk Farm      |    8 min    |   37.6 min   | **+29.6 min**  |         2         |  800  |     57/100     |
| Hampstead Heath ↔ Belsize Park      |    8 min    |   37.5 min   | **+29.5 min**  |         2         |  800  |     63/100     |
| Finchley Road & Frognal ↔ Hampstead |   11 min    |   36.8 min   | **+25.8 min**  |         2         | 1,100 |     49/100     |
| Kentish Town West ↔ Camden Town     |   12 min    |   35.1 min   | **+23.1 min**  |         2         | 1,200 |     66/100     |
| Shepherd's Bush ↔ Wood Lane         |   10 min    |   33.0 min   | **+23.0 min**  |         1         | 1,000 |     60/100     |
| South Hampstead ↔ Finchley Road     |    8 min    |   30.7 min   | **+22.7 min**  |         1         |  800  |     50/100     |
| Goldhawk Road ↔ Shepherd's Bush     |    8 min    |   30.3 min   | **+22.3 min**  |         2         |  800  |     61/100     |
| South Hampstead ↔ St. John's Wood   |   12 min    |   33.2 min   | **+21.2 min**  |         2         | 1,200 |     41/100     |
| Camden Road ↔ Mornington Crescent   |   11 min    |   31.6 min   | **+20.6 min**  |         2         | 1,100 |     63/100     |
| Latimer Road ↔ Shepherd's Bush      |   14 min    |   31.2 min   | **+17.2 min**  |         1         | 1,400 |     54/100     |
| Shoreditch High Street ↔ Old Street |   12 min    |   26.1 min   | **+14.1 min**  |         2         | 1,200 |     63/100     |
