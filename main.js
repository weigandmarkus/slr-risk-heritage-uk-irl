/* -------------------------------------------------------------
   1. DEFINE PROJECTION (Custom UK Albers)
   ------------------------------------------------------------- */
proj4.defs("ESRI:102013", "+proj=aea +lat_1=43 +lat_2=62 +lat_0=30 +lon_0=10 +x_0=0 +y_0=0 +ellps=intl +units=m +no_defs");
ol.proj.proj4.register(proj4); 

const albersProjection = ol.proj.get('ESRI:102013');

// Extent covering the UK
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
    maxZoom: 9  // prevent zooming in too close (Hides the coastline gap)
});

const map = new ol.Map({
    target: 'map',
    view: view,
    controls: ol.control.defaults.defaults().extend([
        new ol.control.ScaleLine({ 
            units: 'metric',
            bar: false, // minimalist line style
            steps: 4,
            text: true,
            minWidth: 100
        }) 
    ])
});

/* -------------------------------------------------------------
   3. BASEMAP (Stadia Alidade Smooth Dark)
   ------------------------------------------------------------- */
const baseLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        // Stadia Maps URL
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png',
        
        // Critical: Tells OpenLayers to shrink the big tiles down for sharpness
        tilePixelRatio: 2,
        // Required Attribution
        attributions: [
    '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>',
    '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>',
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>'
]
    })
});
map.addLayer(baseLayer);

/* -------------------------------------------------------------
   4. FLOOD LAYERS SETUP
   ------------------------------------------------------------- */
const floodLayers = {};
const scenarios = ['ssp1', 'ssp2', 'ssp5'];
const years = ['2050', '2100', '2150'];

scenarios.forEach(scen => {
    years.forEach(yr => {
        const id = `${scen}_${yr}`;
        
        const vectorLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                url: `${id}.geojson`,
                format: new ol.format.GeoJSON()
            }),
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgb(230, 57, 70)' }), 
                stroke: null
            }),
            className: 'blend-layer', 
            visible: false
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
        // Return a blue Dot with White Border
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({ color: '#1f78b4' }), // Blue Fill
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

// RESET ZOOM BUTTON
document.getElementById('reset-zoom-btn').addEventListener('click', () => {
    view.animate({
        center: ukCenter,
        zoom: 5,
        duration: 1000
    });
});

// NEW: RESET MAP BUTTON LOGIC
document.getElementById('reset-map-btn').addEventListener('click', () => {
    // 1. Hide ALL flood layers
    Object.keys(floodLayers).forEach(key => {
        floodLayers[key].setVisible(false);
    });

    // 2. Hide Sites Layer
    sitesLayer.setVisible(false);

    // 3. Clear any active selection (Cyan highlight)
    if (typeof selectInteraction !== 'undefined') {
        selectInteraction.getFeatures().clear();
    }
    
    // 4. Close Popup if open
    if (typeof overlay !== 'undefined') {
        overlay.setPosition(undefined);
    }
});


/* -------------------------------------------------------------
   7 & 8. UNIFIED INTERACTION (Highlight + Popup)
   ------------------------------------------------------------- */
const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

// 1. Create the Popup Overlay
const overlay = new ol.Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
});
map.addOverlay(overlay);

// 2. Define the "Selected" Style (Cyan Highlight)
const selectedStyle = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 8, 
        fill: new ol.style.Fill({ color: '#00e5ff' }), // Cyan
        stroke: new ol.style.Stroke({ color: '#fff', width: 3 })
    }),
    zIndex: 999
});

// 3. Create the Logic (One tool to rule them all)
const selectInteraction = new ol.interaction.Select({
    layers: [sitesLayer], // Ignore flood zones
    style: selectedStyle,
    hitTolerance: 5
});
map.addInteraction(selectInteraction);

// 4. When a site is selected, Show Popup
selectInteraction.on('select', function(e) {
    if (e.selected.length > 0) {
        // A site was clicked!
        const feature = e.selected[0];
        const coordinate = feature.getGeometry().getCoordinates();

        // Get Data
        const name = feature.get('Unified_Name') || 'Unknown Site';
        const type = feature.get('Unified_Type') || 'Heritage Site';
        const link = feature.get('Unified_Link');

        // Build HTML
        let html = `
            <h3 class="popup-title">${name}</h3>
            <div class="popup-type">${type}</div>
        `;
        if (link && link !== 'N/A') {
            html += `<a href="${link}" target="_blank" class="popup-link">More Information &rarr;</a>`;
        }

        // Show it
        content.innerHTML = html;
        overlay.setPosition(coordinate);
    } else {
        // Nothing selected (clicked empty space) -> Close Popup
        overlay.setPosition(undefined);
        closer.blur();
    }
});

// 5. Close Button Logic
closer.onclick = function() {
    selectInteraction.getFeatures().clear(); // Turn off the Cyan highlight
    overlay.setPosition(undefined);          // Hide the popup
    closer.blur();
    return false;
};

// 6. Cursor Pointer (Hand icon on hover)
map.on('pointermove', function(e) {
    if (e.dragging) return;
    const pixel = map.getEventPixel(e.originalEvent);
    const hit = map.hasFeatureAtPixel(pixel, (layer) => layer === sitesLayer);
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});

/* -------------------------------------------------------------
   9. LOADING SCREEN & ABOUT MODAL LOGIC
   ------------------------------------------------------------- */

// A. LOADING SCREEN
// We wait for the map to finish its first render frame
map.once('rendercomplete', function() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.opacity = '0'; // Fade out
        setTimeout(() => {
            loader.style.display = 'none'; // Remove from layout
        }, 500); // Wait for fade to finish
    }
});

// B. ABOUT MODAL
const modal = document.getElementById('about-modal');
const btn = document.getElementById('about-btn');
const span = document.getElementById('close-modal');

// Open Modal
btn.onclick = function() {
    modal.style.display = "block";
}

// Close Modal (X button)
span.onclick = function() {
    modal.style.display = "none";
}

// Close Modal (Click outside)
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
