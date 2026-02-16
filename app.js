// ============================================
// TOPOMAP - Geographic Data Extraction System
// ============================================

let map;
let exportCircle;
let currentMarker;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 TopoMap initializing...');
    initMap();
    initEventListeners();
    console.log('✅ TopoMap ready!');
});

// ============================================
// MAP INITIALIZATION
// ============================================

function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([48.8566, 2.3522], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);
    
    updateMapMarker(48.8566, 2.3522);
    
    map.on('move', () => {
        const center = map.getCenter();
        document.getElementById('mapCoords').textContent = 
            `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Search
    document.getElementById('searchBtn').addEventListener('click', searchLocation);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchLocation();
    });
    
    // Coordinates
    document.getElementById('lat').addEventListener('change', updateFromCoordinates);
    document.getElementById('lng').addEventListener('change', updateFromCoordinates);
    
    // Radius
    const radiusSlider = document.getElementById('radius');
    radiusSlider.addEventListener('input', (e) => {
        document.getElementById('radiusValue').textContent = e.target.value;
        if (exportCircle) {
            exportCircle.setRadius(parseInt(e.target.value));
        }
    });
    
    // Buttons
    document.getElementById('drawArea').addEventListener('click', () => {
        const lat = parseFloat(document.getElementById('lat').value);
        const lng = parseFloat(document.getElementById('lng').value);
        updateMapMarker(lat, lng);
    });
    
    document.getElementById('locateBtn').addEventListener('click', locateUser);
    document.getElementById('toggleView').addEventListener('click', toggleMapView);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // Map click
    map.on('click', (e) => {
        document.getElementById('lat').value = e.latlng.lat.toFixed(4);
        document.getElementById('lng').value = e.latlng.lng.toFixed(4);
        updateMapMarker(e.latlng.lat, e.latlng.lng);
    });
}

// ============================================
// LOCATION FUNCTIONS
// ============================================

async function searchLocation() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    try {
        updateLoadingStatus('Recherche en cours...');
        showLoading();
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            
            document.getElementById('lat').value = lat.toFixed(4);
            document.getElementById('lng').value = lng.toFixed(4);
            
            map.setView([lat, lng], 15);
            updateMapMarker(lat, lng);
            
            hideLoading();
        } else {
            hideLoading();
            alert('❌ Lieu non trouvé. Essayez une autre recherche.');
        }
    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        alert('❌ Erreur lors de la recherche.');
    }
}

function updateFromCoordinates() {
    const lat = parseFloat(document.getElementById('lat').value);
    const lng = parseFloat(document.getElementById('lng').value);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], map.getZoom());
        updateMapMarker(lat, lng);
    }
}

function updateMapMarker(lat, lng) {
    if (currentMarker) map.removeLayer(currentMarker);
    if (exportCircle) map.removeLayer(exportCircle);
    
    currentMarker = L.marker([lat, lng]).addTo(map);
    currentMarker.bindPopup(`<b>Zone d'export</b><br>Lat: ${lat.toFixed(4)}<br>Lng: ${lng.toFixed(4)}`);
    
    const radius = parseInt(document.getElementById('radius').value);
    exportCircle = L.circle([lat, lng], {
        radius: radius,
        color: '#00d4ff',
        fillColor: '#00d4ff',
        fillOpacity: 0.1,
        weight: 3
    }).addTo(map);
}

function locateUser() {
    if (!navigator.geolocation) {
        alert('❌ Géolocalisation non supportée par votre navigateur.');
        return;
    }
    
    updateLoadingStatus('Localisation en cours...');
    showLoading();
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            document.getElementById('lat').value = lat.toFixed(4);
            document.getElementById('lng').value = lng.toFixed(4);
            
            map.setView([lat, lng], 15);
            updateMapMarker(lat, lng);
            hideLoading();
        },
        (error) => {
            console.error('Geolocation error:', error);
            hideLoading();
            alert('❌ Impossible de vous localiser. Vérifiez les autorisations.');
        }
    );
}

// ============================================
// MAP VIEW TOGGLE
// ============================================

let currentMapType = 'osm';

function toggleMapView() {
    if (currentMapType === 'osm') {
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 19
        }).addTo(map);
        currentMapType = 'satellite';
    } else {
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        currentMapType = 'osm';
    }
}

// ============================================
// DATA EXPORT
// ============================================

async function exportData() {
    try {
        showLoading();
        updateProgress(0);
        
        const lat = parseFloat(document.getElementById('lat').value);
        const lng = parseFloat(document.getElementById('lng').value);
        const radius = parseInt(document.getElementById('radius').value);
        const format = document.querySelector('input[name="format"]:checked').value;
        
        console.log('📍 Export parameters:', { lat, lng, radius, format });
        
        const layers = {
            buildings: document.getElementById('layerBuildings').checked,
            roads: document.getElementById('layerRoads').checked,
            trees: document.getElementById('layerTrees').checked,
            water: document.getElementById('layerWater').checked,
            contour: document.getElementById('layerContour').checked
        };
        
        console.log('📊 Layers:', layers);
        
        // Fetch data
        updateLoadingStatus('Connexion à l\'API Overpass...');
        updateProgress(20);
        
        const osmData = await fetchOSMData(lat, lng, radius);
        
        updateProgress(60);
        
        const totalFeatures = osmData.buildings.length + osmData.roads.length + 
                             osmData.trees.length + osmData.water.length;
        
        console.log(`📦 Data retrieved: ${totalFeatures} features`);
        
        if (totalFeatures === 0) {
            hideLoading();
            alert('⚠️ Aucune donnée trouvée dans cette zone.\n\nEssayez:\n• Un autre emplacement\n• Augmenter le rayon\n• Vérifier les calques sélectionnés');
            return;
        }
        
        // Generate export
        updateLoadingStatus(`Génération du fichier ${format.toUpperCase()}...`);
        updateProgress(80);
        
        let exportContent, filename, mimeType;
        
        switch (format) {
            case 'dxf':
                exportContent = generateDXF(osmData, layers);
                filename = 'topomap_export.dxf';
                mimeType = 'application/dxf';
                break;
            case 'svg':
                exportContent = generateSVG(osmData, layers, radius);
                filename = 'topomap_export.svg';
                mimeType = 'image/svg+xml';
                break;
            case 'geojson':
                exportContent = generateGeoJSON(osmData, layers);
                filename = 'topomap_export.geojson';
                mimeType = 'application/geo+json';
                break;
            case 'obj':
                exportContent = generateOBJ(osmData, layers, radius);
                filename = 'topomap_export.obj';
                mimeType = 'text/plain';
                break;
            default:
                throw new Error('Format non supporté: ' + format);
        }
        
        console.log(`📄 Generated file size: ${exportContent.length} chars`);
        
        // Download
        updateProgress(95);
        const blob = new Blob([exportContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateProgress(100);
        
        setTimeout(() => {
            hideLoading();
            alert(`✅ EXTRACTION RÉUSSIE!\n\nFichier: ${filename}\n\nDonnées exportées:\n• ${osmData.buildings.length} bâtiments\n• ${osmData.roads.length} routes\n• ${osmData.trees.length} arbres/végétation\n• ${osmData.water.length} éléments d'eau`);
        }, 500);
        
    } catch (error) {
        console.error('❌ Export error:', error);
        console.error('Stack:', error.stack);
        hideLoading();
        
        let errorMsg = '❌ ERREUR D\'EXTRACTION\n\n';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('Overpass')) {
            errorMsg += 'L\'API Overpass est temporairement indisponible.\n\n';
            errorMsg += 'Solutions:\n';
            errorMsg += '• Réessayez dans quelques secondes\n';
            errorMsg += '• Réduisez le rayon de capture\n';
            errorMsg += '• Choisissez une zone moins dense';
        } else {
            errorMsg += error.message || 'Erreur inconnue';
        }
        
        alert(errorMsg);
    }
}

// ============================================
// OSM DATA FETCHING
// ============================================

async function fetchOSMData(lat, lng, radius) {
    console.log('🌐 Fetching OSM data...');
    
    const overpassQuery = `
        [out:json][timeout:30];
        (
            way["building"](around:${radius},${lat},${lng});
            way["highway"](around:${radius},${lat},${lng});
            way["natural"="tree"](around:${radius},${lat},${lng});
            way["natural"="wood"](around:${radius},${lat},${lng});
            way["landuse"="forest"](around:${radius},${lat},${lng});
            way["natural"="water"](around:${radius},${lat},${lng});
            way["waterway"](around:${radius},${lat},${lng});
            node["natural"="tree"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;
    
    updateLoadingStatus('Requête API en cours...');
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery,
        headers: { 'Content-Type': 'text/plain' }
    });
    
    if (!response.ok) {
        throw new Error(`Erreur Overpass API: ${response.status}`);
    }
    
    updateLoadingStatus('Traitement des données...');
    const data = await response.json();
    
    console.log(`📦 Received ${data.elements ? data.elements.length : 0} elements`);
    
    return processOSMData(data, lat, lng);
}

function processOSMData(data, centerLat, centerLng) {
    if (!data || !data.elements) {
        return {
            buildings: [],
            roads: [],
            trees: [],
            water: [],
            center: { lat: centerLat, lng: centerLng }
        };
    }
    
    const processed = {
        buildings: [],
        roads: [],
        trees: [],
        water: [],
        center: { lat: centerLat, lng: centerLng }
    };
    
    const nodes = {};
    data.elements.forEach(el => {
        if (el.type === 'node') {
            nodes[el.id] = { lat: el.lat, lon: el.lon };
        }
    });
    
    data.elements.forEach(el => {
        if (el.type === 'way' && el.nodes) {
            const coords = el.nodes.map(nodeId => nodes[nodeId]).filter(n => n);
            
            if (coords.length < 2) return;
            
            if (el.tags) {
                if (el.tags.building) {
                    processed.buildings.push({ type: el.tags.building, coords });
                } else if (el.tags.highway) {
                    processed.roads.push({ type: el.tags.highway, coords });
                } else if (el.tags.natural === 'tree' || el.tags.natural === 'wood' || el.tags.landuse === 'forest') {
                    processed.trees.push({ type: 'vegetation', coords });
                } else if (el.tags.natural === 'water' || el.tags.waterway) {
                    processed.water.push({ type: el.tags.waterway || 'water', coords });
                }
            }
        } else if (el.type === 'node' && el.tags && el.tags.natural === 'tree') {
            processed.trees.push({ type: 'tree', coords: [{ lat: el.lat, lon: el.lon }] });
        }
    });
    
    console.log('✅ Data processed:', {
        buildings: processed.buildings.length,
        roads: processed.roads.length,
        trees: processed.trees.length,
        water: processed.water.length
    });
    
    return processed;
}

// ============================================
// EXPORT GENERATORS
// ============================================

function generateDXF(data, layers) {
    let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
    
    const toLocal = (lat, lon) => {
        const x = (lon - data.center.lng) * 111320 * Math.cos(data.center.lat * Math.PI / 180);
        const y = (lat - data.center.lat) * 110540;
        return { x: x.toFixed(2), y: y.toFixed(2) };
    };
    
    if (layers.buildings) {
        data.buildings.forEach(building => {
            if (building.coords.length > 2) {
                dxf += `0\nPOLYLINE\n8\nBUILDINGS\n66\n1\n70\n1\n`;
                building.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    dxf += `0\nVERTEX\n8\nBUILDINGS\n10\n${local.x}\n20\n${local.y}\n30\n0.0\n`;
                });
                dxf += `0\nSEQEND\n`;
            }
        });
    }
    
    if (layers.roads) {
        data.roads.forEach(road => {
            if (road.coords.length > 1) {
                dxf += `0\nPOLYLINE\n8\nROADS\n66\n1\n70\n0\n`;
                road.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    dxf += `0\nVERTEX\n8\nROADS\n10\n${local.x}\n20\n${local.y}\n30\n0.0\n`;
                });
                dxf += `0\nSEQEND\n`;
            }
        });
    }
    
    if (layers.trees) {
        data.trees.forEach(tree => {
            if (tree.coords.length === 1) {
                const local = toLocal(tree.coords[0].lat, tree.coords[0].lon);
                dxf += `0\nCIRCLE\n8\nVEGETATION\n10\n${local.x}\n20\n${local.y}\n30\n0.0\n40\n2.0\n`;
            }
        });
    }
    
    if (layers.water) {
        data.water.forEach(water => {
            if (water.coords.length > 2) {
                dxf += `0\nPOLYLINE\n8\nWATER\n66\n1\n70\n1\n`;
                water.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    dxf += `0\nVERTEX\n8\nWATER\n10\n${local.x}\n20\n${local.y}\n30\n0.0\n`;
                });
                dxf += `0\nSEQEND\n`;
            }
        });
    }
    
    dxf += `0\nENDSEC\n0\nEOF\n`;
    return dxf;
}

function generateSVG(data, layers, radius) {
    const size = 2000;
    const scale = size / (radius * 2);
    
    const toSVG = (lat, lon) => {
        const x = (lon - data.center.lng) * 111320 * Math.cos(data.center.lat * Math.PI / 180) * scale + size / 2;
        const y = size / 2 - (lat - data.center.lat) * 110540 * scale;
        return { x: x.toFixed(2), y: y.toFixed(2) };
    };
    
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n<rect width="${size}" height="${size}" fill="#0d0f12"/>\n`;
    
    if (layers.water) {
        svg += '<g id="water" fill="#0088ff" stroke="#00d4ff" stroke-width="2" opacity="0.7">\n';
        data.water.forEach(water => {
            if (water.coords.length > 2) {
                const points = water.coords.map(c => {
                    const p = toSVG(c.lat, c.lon);
                    return `${p.x},${p.y}`;
                }).join(' ');
                svg += `<polygon points="${points}"/>\n`;
            }
        });
        svg += '</g>\n';
    }
    
    if (layers.trees) {
        svg += '<g id="vegetation" fill="#00ff88" opacity="0.6">\n';
        data.trees.forEach(tree => {
            if (tree.coords.length === 1) {
                const p = toSVG(tree.coords[0].lat, tree.coords[0].lon);
                svg += `<circle cx="${p.x}" cy="${p.y}" r="4"/>\n`;
            } else if (tree.coords.length > 2) {
                const points = tree.coords.map(c => {
                    const p = toSVG(c.lat, c.lon);
                    return `${p.x},${p.y}`;
                }).join(' ');
                svg += `<polygon points="${points}"/>\n`;
            }
        });
        svg += '</g>\n';
    }
    
    if (layers.roads) {
        svg += '<g id="roads" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8">\n';
        data.roads.forEach(road => {
            if (road.coords.length > 1) {
                const points = road.coords.map(c => {
                    const p = toSVG(c.lat, c.lon);
                    return `${p.x},${p.y}`;
                }).join(' ');
                svg += `<polyline points="${points}"/>\n`;
            }
        });
        svg += '</g>\n';
    }
    
    if (layers.buildings) {
        svg += '<g id="buildings" fill="#2a3142" stroke="#00d4ff" stroke-width="2">\n';
        data.buildings.forEach(building => {
            if (building.coords.length > 2) {
                const points = building.coords.map(c => {
                    const p = toSVG(c.lat, c.lon);
                    return `${p.x},${p.y}`;
                }).join(' ');
                svg += `<polygon points="${points}"/>\n`;
            }
        });
        svg += '</g>\n';
    }
    
    svg += '</svg>';
    return svg;
}

function generateGeoJSON(data, layers) {
    const features = [];
    
    if (layers.buildings) {
        data.buildings.forEach(building => {
            if (building.coords.length > 2) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'building', category: building.type },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [building.coords.map(c => [c.lon, c.lat])]
                    }
                });
            }
        });
    }
    
    if (layers.roads) {
        data.roads.forEach(road => {
            if (road.coords.length > 1) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'road', category: road.type },
                    geometry: {
                        type: 'LineString',
                        coordinates: road.coords.map(c => [c.lon, c.lat])
                    }
                });
            }
        });
    }
    
    if (layers.trees) {
        data.trees.forEach(tree => {
            if (tree.coords.length === 1) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'tree' },
                    geometry: {
                        type: 'Point',
                        coordinates: [tree.coords[0].lon, tree.coords[0].lat]
                    }
                });
            } else if (tree.coords.length > 2) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'vegetation' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [tree.coords.map(c => [c.lon, c.lat])]
                    }
                });
            }
        });
    }
    
    if (layers.water) {
        data.water.forEach(water => {
            if (water.coords.length > 2) {
                features.push({
                    type: 'Feature',
                    properties: { type: 'water', category: water.type },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [water.coords.map(c => [c.lon, c.lat])]
                    }
                });
            }
        });
    }
    
    return JSON.stringify({
        type: 'FeatureCollection',
        features: features
    }, null, 2);
}

function generateOBJ(data, layers, radius) {
    let obj = `# TopoMap 3D Export\n# Center: ${data.center.lat}, ${data.center.lng}\n# Radius: ${radius}m\n\n`;
    
    let vertexIndex = 1;
    
    const toLocal = (lat, lon) => {
        const x = (lon - data.center.lng) * 111320 * Math.cos(data.center.lat * Math.PI / 180);
        const y = (lat - data.center.lat) * 110540;
        return { x: x.toFixed(3), y: y.toFixed(3) };
    };
    
    // Ground
    const groundSize = radius * 1.5;
    obj += `# Ground\nv -${groundSize} -${groundSize} 0\nv ${groundSize} -${groundSize} 0\nv ${groundSize} ${groundSize} 0\nv -${groundSize} ${groundSize} 0\nf 1 2 3 4\n\n`;
    vertexIndex = 5;
    
    // Buildings
    if (layers.buildings) {
        obj += `# Buildings\no Buildings\n`;
        data.buildings.forEach(building => {
            if (building.coords.length > 2) {
                const height = 15;
                const startIndex = vertexIndex;
                
                building.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    obj += `v ${local.x} ${local.y} 0\n`;
                    vertexIndex++;
                });
                
                building.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    obj += `v ${local.x} ${local.y} ${height}\n`;
                    vertexIndex++;
                });
                
                const numVerts = building.coords.length;
                
                let bottomFace = 'f';
                for (let i = 0; i < numVerts; i++) {
                    bottomFace += ` ${startIndex + i}`;
                }
                obj += bottomFace + '\n';
                
                let topFace = 'f';
                for (let i = numVerts - 1; i >= 0; i--) {
                    topFace += ` ${startIndex + numVerts + i}`;
                }
                obj += topFace + '\n';
                
                for (let i = 0; i < numVerts; i++) {
                    const next = (i + 1) % numVerts;
                    obj += `f ${startIndex + i} ${startIndex + next} ${startIndex + numVerts + next} ${startIndex + numVerts + i}\n`;
                }
                
                obj += '\n';
            }
        });
    }
    
    // Roads
    if (layers.roads) {
        obj += `# Roads\no Roads\n`;
        data.roads.forEach(road => {
            if (road.coords.length > 1) {
                const roadWidth = 4;
                const roadHeight = 0.2;
                
                for (let i = 0; i < road.coords.length - 1; i++) {
                    const curr = toLocal(road.coords[i].lat, road.coords[i].lon);
                    const next = toLocal(road.coords[i + 1].lat, road.coords[i + 1].lon);
                    
                    const dx = parseFloat(next.x) - parseFloat(curr.x);
                    const dy = parseFloat(next.y) - parseFloat(curr.y);
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const perpX = (-dy / len) * roadWidth / 2;
                    const perpY = (dx / len) * roadWidth / 2;
                    
                    const startIdx = vertexIndex;
                    
                    obj += `v ${parseFloat(curr.x) + perpX} ${parseFloat(curr.y) + perpY} ${roadHeight}\n`;
                    obj += `v ${parseFloat(curr.x) - perpX} ${parseFloat(curr.y) - perpY} ${roadHeight}\n`;
                    obj += `v ${parseFloat(next.x) - perpX} ${parseFloat(next.y) - perpY} ${roadHeight}\n`;
                    obj += `v ${parseFloat(next.x) + perpX} ${parseFloat(next.y) + perpY} ${roadHeight}\n`;
                    
                    obj += `f ${startIdx} ${startIdx + 1} ${startIdx + 2} ${startIdx + 3}\n\n`;
                    
                    vertexIndex += 4;
                }
            }
        });
    }
    
    // Trees
    if (layers.trees) {
        obj += `# Trees\no Trees\n`;
        data.trees.forEach(tree => {
            if (tree.coords.length === 1) {
                const local = toLocal(tree.coords[0].lat, tree.coords[0].lon);
                const treeHeight = 8;
                const treeRadius = 2;
                const segments = 6;
                
                const baseIndex = vertexIndex;
                
                for (let i = 0; i < segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    const x = parseFloat(local.x) + Math.cos(angle) * treeRadius;
                    const y = parseFloat(local.y) + Math.sin(angle) * treeRadius;
                    obj += `v ${x.toFixed(3)} ${y.toFixed(3)} 0\n`;
                    vertexIndex++;
                }
                
                obj += `v ${local.x} ${local.y} ${treeHeight}\n`;
                const topIndex = vertexIndex;
                vertexIndex++;
                
                let baseFace = 'f';
                for (let i = segments - 1; i >= 0; i--) {
                    baseFace += ` ${baseIndex + i}`;
                }
                obj += baseFace + '\n';
                
                for (let i = 0; i < segments; i++) {
                    const next = (i + 1) % segments;
                    obj += `f ${baseIndex + i} ${baseIndex + next} ${topIndex}\n`;
                }
                
                obj += '\n';
            }
        });
    }
    
    // Water
    if (layers.water) {
        obj += `# Water\no Water\n`;
        data.water.forEach(water => {
            if (water.coords.length > 2) {
                const waterHeight = 0.5;
                const startIndex = vertexIndex;
                
                water.coords.forEach(coord => {
                    const local = toLocal(coord.lat, coord.lon);
                    obj += `v ${local.x} ${local.y} ${waterHeight}\n`;
                    vertexIndex++;
                });
                
                let waterFace = 'f';
                for (let i = water.coords.length - 1; i >= 0; i--) {
                    waterFace += ` ${startIndex + i}`;
                }
                obj += waterFace + '\n\n';
            }
        });
    }
    
    return obj;
}

// ============================================
// UI HELPERS
// ============================================

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    updateProgress(0);
}

function updateLoadingStatus(status) {
    document.getElementById('loadingStatus').textContent = status;
}

function updateProgress(percent) {
    document.getElementById('progressBar').style.width = percent + '%';
}
