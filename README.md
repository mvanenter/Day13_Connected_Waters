# Connected Waters 🌊
### #30DayMapChallenge 2026 · Day 13 — Interactions

**[Explore the interactive map](https://mvanenter.github.io/Day13_Connected_Waters/)**

**Connected Waters** explores how individual river reaches connect across the **Ashley / Rakahuri catchment, Canterbury, Aotearoa New Zealand**. Click a river line to see the tributaries feeding into it and the downstream route to the coast. The theme of **Interactions** is represented by the connections between river segments: one selected reach is part of a much larger drainage network.

The project combines **ArcGIS Pro, Python/ArcPy, network tracing and geospatial QA/QC** with an interactive **Leaflet** website hosted on GitHub Pages. A companion static cartographic poster, *The Anatomy of a River*, communicates the same idea through a living-veins-inspired watercolour design.

## Explore the map

- **Select a reach** to highlight upstream tributaries in teal, the downstream route in orange and the selected segment in navy with a white casing.
- **Switch trace mode** between Both, Upstream and Downstream.
- **Inspect metrics** for reach counts, mapped lengths, stream order, selected segment length and reported cumulative catchment area.
- **Explore the outlet** to show the connected network feeding into the Ashley/Rakahuri river mouth.
- **Switch basemaps** between **Soft** (subdued OpenStreetMap tiles, default for stream legibility) and **Streets** (full OpenStreetMap detail).
- Use the responsive river explorer on desktop or mobile; open **Method & QA** for the analysis checks.

## Source data

The river network came from the **REC2 (River Environment Classification 2) River Lines** ArcGIS feature service, originally developed by **NIWA (now part of Earth Sciences New Zealand)**:

- [REC2 River Lines ArcGIS Feature Service — layer used](https://services3.arcgis.com/fp1tibNcN9mbExhG/ArcGIS/rest/services/REC2_Layers/FeatureServer/0)
- [REC2 information — NIWA](https://niwa.co.nz/freshwater/river-environment-classification-2)
- **Selected outlet:** `HydroID = 593451`, `NextDownID = -1`
- **Core connectivity attributes:** `HydroID` uniquely identifies a river reach; `NextDownID` points to the immediately downstream reach; `-1` denotes a terminal outlet in the extracted network.
- **Additional source/export fields used:** `StreamOrde`, `CUM_AREA`, `length_km`.

**Attribution and permissions:** River data: REC2 / NIWA (now Earth Sciences New Zealand). Release metadata indicates **CC BY-NC 4.0** for a REC2 version, but the terms applicable to the *exact hosted service and derived extract* should be checked with the data provider. The GeoJSON is published here for a non-commercial portfolio demonstration; its availability does not imply unrestricted redistribution or commercial reuse. Do not treat the river data as LINZ-owned without evidence from the source metadata.

**Background tiles:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), subject to the OpenStreetMap tile usage policy. The Soft style applies CSS filters to the same tiles rather than changing the underlying geography.

## Methodology: how the network was built

### 1. Examine the national REC2 layer

The REC2 River Lines feature service was accessed using **ArcGIS Pro and ArcPy**. The national source contained **593,517 reaches**. The analysis checked identifier uniqueness and whether non-terminal `NextDownID` values referenced a valid `HydroID`. A local national export produced an ArcPy `General function failure` in some cursor operations; reading the service directly and using fresh selected-feature exports avoided that issue.

### 2. Identify the outlet and construct a directed graph

The Ashley/Rakahuri river-mouth outlet was selected at `HydroID = 593451` (`NextDownID = -1`). Every `HydroID → NextDownID` relationship was treated as a **directed downstream edge**. A reverse lookup was created so the network could also be traversed upstream.

A simplified version of the tracing logic:

```python
from collections import defaultdict

# rec2_records is an iterable of (HydroID, NextDownID) pairs
upstream_of = defaultdict(list)
next_down = {}

for hydro_id, next_down_id in rec2_records:
    next_down[hydro_id] = next_down_id
    upstream_of[next_down_id].append(hydro_id)

outlet_id = 593451
connected = {outlet_id}
stack = [outlet_id]

while stack:
    current = stack.pop()
    for parent in upstream_of[current]:
        if parent not in connected:
            connected.add(parent)
            stack.append(parent)

# connected includes every reach draining to this outlet.
```

The traversal found **2,706 connected reaches**: **2,705 upstream reaches plus the outlet**. This is an attribute-driven graph trace, **not** a spatial buffer, proximity join or visual guess based on nearby river lines.

### 3. Export and prepare the study-area river geometry

The connected features were exported to a local ArcGIS feature class:

`Ashley_Rakahuri_Upstream_REC2`

A lightweight GeoJSON extract containing the **2,706 LineString features** and the properties needed for tracing was prepared as:

`data/ashley_rakahuri_reaches.geojson`

The exported `length_km` values support the live per-selection metrics. The complete catchment network's **2,086.75 km** length was separately checked by geodesic measurement in ArcGIS Pro.

### 4. Network quality assurance

| Check | Verified result |
|---|---:|
| National REC2 reaches checked | 593,517 |
| Ashley/Rakahuri extracted reaches | **2,706** |
| Downstream connections in extract | **2,705** |
| Broken downstream references | **0** |
| Cycles in the traced network | **0** |
| Reaches that connect to the chosen outlet | **2,706 / 2,706** |
| Endpoint connections within 1 metre | **2,705 / 2,705** |
| Missing geometries | **0** |
| Geodesic centreline length of entire extracted network | **2,086.75 km** |

The independent QA summary is stored in [`data/qa_summary.json`](data/qa_summary.json). **2,086.75 km means the sum of all mapped tributary centreline lengths, not the length of the main Ashley/Rakahuri River.**

### 5. Create the browser-based tracer

The website uses **HTML, CSS, JavaScript and Leaflet 1.9.4**. When loaded, `js/app.js`:

1. Fetches `data/ashley_rakahuri_reaches.geojson`.
2. Checks the feature collection format, `HydroID` uniqueness, outlet, reach count and downstream references.
3. Builds `next_down` and reverse `upstream_of` relationships **in memory**.
4. On a click, traverses all upstream branches and follows `NextDownID` downstream until the outlet.
5. Applies category symbology and computes upstream/downstream counts and mapped lengths for the selected reach.
6. Emphasises short selected segments with a white casing, navy line and point marker.

The network trace runs **entirely in the browser**; no server-side network-tracing API or GIS extension is required to explore it.

## Project files

```text
Day13_Connected_Waters/
├── index.html                      # Page layout and Method & QA dialog
├── css/style.css                   # Responsive UI, symbology and basemap style
├── js/app.js                       # Leaflet map and graph traversal
├── data/
│   ├── ashley_rakahuri_reaches.geojson
│   └── qa_summary.json             # Verified connectivity/geometry checks
└── README.md                       # Project methods and documentation
```

## Run the website locally

The site fetches GeoJSON, so **don't double-click `index.html` as a `file://` URL**. From the repository folder, start a local web server:

```bash
python -m http.server 8000
```

Then visit **http://localhost:8000/**. Internet access is required for Leaflet's CDN assets and OpenStreetMap basemap tiles.

## Deploy to GitHub Pages

In the repository, choose **Settings → Pages → Deploy from a branch → `main` → `/(root)`**, then save. Once deployed, the website is available at:

https://mvanenter.github.io/Day13_Connected_Waters/

## Interpretation and limitations

- REC2 is a **modelled drainage-network representation**, not a live measurement of streamflow, water quality, flood timing or sediment transport.
- A connected pathway does not prove there is water moving through every segment at a specific moment. Braided rivers, dry reaches, diversions and generalised networks have limitations.
- The interactive upstream/downstream totals count **reaches**, not separate named streams or confluences.
- Selected-trace lengths use exported `length_km` values; the **2,086.75 km** total is an ArcGIS geodesic network-length measurement. Do not conflate these with straight-line distance or the main river's length.
- `CUM_AREA` is the source-reported cumulative catchment attribute and **must not be summed across reaches** to calculate the catchment area.
- River mouths and coastlines can differ between datasets due to geometry, scale and generalisation.
- The short Python excerpt documents the graph algorithm; it is **not a complete stand-alone extraction script**.

## Skills demonstrated

**ArcGIS Pro · ArcPy/Python · directed graph traversal · hydrological connectivity · QA/QC · spatial data processing · GeoJSON · Leaflet · responsive JavaScript/CSS · GitHub Pages · cartographic communication**

*Analysis and cartography: Melanie van Enter · 2026*
