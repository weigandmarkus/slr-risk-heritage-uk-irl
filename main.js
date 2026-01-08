/* -------------------------------------------------------------
   1. DEFINE PROJECTION (Custom UK Albers)
   ------------------------------------------------------------- */
proj4.defs("ESRI:102013", "+proj=aea +lat_1=43 +lat_2=62 +lat_0=30 +lon_0=10 +x_0=0 +y_0=0 +ellps=intl +units=m +no_defs");
ol.proj.proj4.register(proj4); 

const albersProjection = ol.proj.get('ESRI:102013');
// Keep your corrected extent
albersProjection.setExtent([-4000000, 1000000, 4000000, 8000000]);

/* -------------------------------------------------------------
   2. INITIALIZE MAP
   ------------------------------------------------------------- */
const ukCenter = ol.proj.fromLonLat([-4.5, 54.5], albersProjection);

const view = new ol.View({
    projection: albersProjection,
    center: ukCenter,
    zoom: 5,     // Starting zoom
    minZoom: 4,  // prevent zooming out to see the whole world
    maxZoom: 9  // PREVENT zooming in too close (Hides the coastline gap)
});

const map = new ol.Map({
    target: 'map',
    view: view,
    // Fix for missing map controls
    controls: ol.control.defaults.defaults() 
});
/* -------------------------------------------------------------
   3. BASEMAP (Dark Matter)
   ------------------------------------------------------------- */
// Using CartoDB Dark Matter (reprojected on the fly by OpenLayers)
const baseLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; CartoDB'
    })
});
map.addLayer(baseLayer);

/* -------------------------------------------------------------
   4. FLOOD LAYERS SETUP
   ------------------------------------------------------------- */
// We create a dictionary to store references to our 9 layers
const floodLayers = {};
const scenarios = ['ssp1', 'ssp2', 'ssp5'];
const years = ['2050', '2100', '2150'];

// Loop through all combinations to create hidden layers
scenarios.forEach(scen => {
    years.forEach(yr => {
        const id = `${scen}_${yr}`; // e.g., "ssp1_2050"
        
        const vectorLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                url: `${id}.geojson`, // Ensure file names match exactly
                format: new ol.format.GeoJSON()
            }),
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(230, 57, 71, 1)' }), // Red fill
                stroke: null // No outline for cleaner look
            }),
            visible: false // Hidden by default
        });
        
        floodLayers[id] = vectorLayer;
        map.addLayer(vectorLayer);
    });
});

/* -------------------------------------------------------------
   5. ARCHAEOLOGICAL SITES LAYER (The "Matrix" Logic)
   ------------------------------------------------------------- */
// Current state variables (default selection)
let currentScenario = 'ssp1';
let currentYear = '2050';

const sitesSource = new ol.source.Vector({
    url: 'sites.geojson',
    format: new ol.format.GeoJSON()
});

// Style Function: This runs for every point every time the map moves or updates
const sitesStyleFunction = function(feature) {
    // Construct the attribute name based on user selection (e.g., "ssp1_2050")
    const attributeKey = `${currentScenario}_${currentYear}`;
    
    // Check if this site is affected in this specific scenario (Value 1 = Yes)
    const isAffected = feature.get(attributeKey);

    if (isAffected === 1) {
        // Return a Yellow Dot with White Border
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({ color: '#ffd700' }), // Gold/Yellow
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
            })
        });
    } else {
        // Return null to make the point invisible
        return null;
    }
};

const sitesLayer = new ol.layer.Vector({
    source: sitesSource,
    style: sitesStyleFunction,
    visible: false // Hidden initially until user clicks Update
});
map.addLayer(sitesLayer);

/* -------------------------------------------------------------
   6. UI INTERACTION LOGIC
   ------------------------------------------------------------- */

// UPDATE MAP BUTTON LOGIC
document.getElementById('update-btn').addEventListener('click', () => {
    // 1. Get User Input for Scenarios
    const scenRadios = document.getElementsByName('scenario');
    for (const r of scenRadios) { if (r.checked) currentScenario = r.value; }

    const yearRadios = document.getElementsByName('year');
    for (const r of yearRadios) { if (r.checked) currentYear = r.value; }

    // 2. Manage Flood Layers
    const floodCheckbox = document.getElementById('flood-toggle');
    
    // Hide ALL flood layers first
    Object.keys(floodLayers).forEach(key => {
        floodLayers[key].setVisible(false);
    });

    // Show ONLY the selected flood layer (IF the box is checked)
    const selectedKey = `${currentScenario}_${currentYear}`;
    if (floodLayers[selectedKey]) {
        // If checkbox is ON, show layer. If OFF, keep hidden.
        floodLayers[selectedKey].setVisible(floodCheckbox.checked);
    }

    // 3. Manage Sites Layer
    const sitesCheckbox = document.getElementById('sites-toggle');
    
    // Update the matrix
    sitesLayer.changed(); 

    // Set visibility based on checkbox
    sitesLayer.setVisible(sitesCheckbox.checked);
});

// 4. FLOOD TOGGLE "LIVE" LISTENER (Optional but Recommended)
// This lets the user turn the flood ON/OFF instantly without clicking "Update Map"
document.getElementById('flood-toggle').addEventListener('change', function() {
    const selectedKey = `${currentScenario}_${currentYear}`;
    if (floodLayers[selectedKey]) {
        floodLayers[selectedKey].setVisible(this.checked);
    }
});

// RESET ZOOM BUTTON
document.getElementById('reset-zoom-btn').addEventListener('click', () => {
    view.animate({
        center: ukCenter,
        zoom: 5,
        duration: 1000
    });
});

/* -------------------------------------------------------------
   7. POPUP LOGIC
   ------------------------------------------------------------- */
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

// Create Overlay
const overlay = new ol.Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
});
map.addOverlay(overlay);

// Close Button Logic
closer.onclick = function() {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
};

// Map Click Event
map.on('click', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feat) {
        return feat;
    });

    // Only show popup if we clicked a feature AND it's a visible site
    // (We check geometry type to avoid clicking flood polygons)
    if (feature && feature.getGeometry().getType() === 'Point') {
        const name = feature.get('Unified_Name') || 'Unknown Site';
        const type = feature.get('Unified_Type') || 'Heritage Site';
        const link = feature.get('Unified_Link');

        let html = `
            <h3 class="popup-title">${name}</h3>
            <div class="popup-type">${type}</div>
        `;

        if (link && link !== 'N/A') {
            html += `<a href="${link}" target="_blank" class="popup-link">More Information &rarr;</a>`;
        }

        content.innerHTML = html;
        overlay.setPosition(evt.coordinate);
    } else {
        overlay.setPosition(undefined); // Close if clicked on empty map
    }
});

// Cursor Pointer Logic (Change cursor to hand when hovering over site)
map.on('pointermove', function(e) {
    const pixel = map.getEventPixel(e.originalEvent);
    const hit = map.hasFeatureAtPixel(pixel, (layer) => {
        // Only trigger for the sites layer, ignore flood polygons
        return layer === sitesLayer;
    });
    
    // FIX: Use getTargetElement() instead of getTarget()
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});