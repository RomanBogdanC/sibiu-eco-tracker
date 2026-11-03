/**
 * Obiect global de configurare Frontend
 */
const CONFIG = {
    WAQI_URL: 'https://api.waqi.info/feed/sibiu/?token=demo',
    TRAFFIC_MOCK_URL: 'https://jsonplaceholder.typicode.com/users?_limit=5',
    
    TURSIB_ROUTES: {
        "Bd. Corneliu Coposu": [2, 5, 15],
        "Calea Dumbrăvii": [1, 13, 111],
        "Str. Andrei Șaguna": [10, 11, 118],
        "Piața Cibin": [8, 16, 18],
        "Bd. Vasile Milea": [11, 14, 2]
    },
    
    LOCATIONS: [
        { name: "Bd. Corneliu Coposu", lat: 45.7954, lng: 24.1532 },
        { name: "Calea Dumbrăvii", lat: 45.7865, lng: 24.1481 },
        { name: "Str. Andrei Șaguna", lat: 45.7923, lng: 24.1458 },
        { name: "Piața Cibin", lat: 45.7981, lng: 24.1435 },
        { name: "Bd. Vasile Milea", lat: 45.7892, lng: 24.1593 }
    ]
};

const DOM = {
    loadingOverlay: document.getElementById('loading-overlay'),
    aqiCard: document.getElementById('aqi-card'),
    aqiValue: document.getElementById('aqi-value'),
    pm25Value: document.getElementById('pm25-value'),
    trafficList: document.getElementById('traffic-list'),
    tursibList: document.getElementById('tursib-recommendations'),
    controlsContainer: document.getElementById('controls-container')
};

let mapInstance = null; 
const mapMarkers = {}; // Păstrăm instanțele de marker pentru actualizarea dinamică a popup-urilor

function initMap() {
    if (mapInstance !== null) return; 
    
    mapInstance = L.map('map').setView([45.793, 24.150], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    CONFIG.LOCATIONS.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstance);
        
        // Popup inițial static, suprascris imediat de funcția fetch
        marker.bindPopup(`<b>${loc.name}</b><br>Se încarcă datele...`);
        
        // Efect dublu la click: Evidențiere pe hartă și evidențiere în listă
        marker.on('click', () => {
            console.log(`[Event: Map Click] S-a selectat locația: ${loc.name}`);
            highlightStreetInList(loc.name);
        });

        mapMarkers[loc.name] = marker; 
    });
}

function highlightStreetInList(streetName) {
    const listItems = DOM.trafficList.querySelectorAll('li');
    listItems.forEach(li => {
        if (li.dataset.street === streetName) {
            li.classList.add('highlight');
            setTimeout(() => li.classList.remove('highlight'), 2500);
        } else {
            li.classList.remove('highlight');
        }
    });
}

async function fetchTrackerData() {
    DOM.loadingOverlay.classList.add('active');

    try {
        const [aqiResponse, trafficResponse] = await Promise.all([
            fetch(CONFIG.WAQI_URL),
            fetch(CONFIG.TRAFFIC_MOCK_URL)
        ]);

        if (!aqiResponse.ok || !trafficResponse.ok) {
            throw new Error('Eroare HTTP la obținerea telemetriei.');
        }

        const aqiData = await aqiResponse.json();
        const trafficData = await trafficResponse.json();
        
        const currentAqi = aqiData?.data?.aqi || 0;
        
        renderAirQuality(aqiData, currentAqi);
        const streetStatuses = renderEcoTraffic(trafficData);
        renderEcoRoutingRecommendations(currentAqi, streetStatuses);

    } catch (error) {
        console.error('Aplicația a întâmpinat o eroare de rețea:', error);
        DOM.aqiValue.textContent = 'Eroare';
        DOM.pm25Value.textContent = 'Eroare';
        DOM.trafficList.innerHTML = '<li>Senzorii de trafic sunt offline.</li>';
        DOM.tursibList.innerHTML = '<li style="color:red;">Datele de tranzit local sunt indisponibile.</li>';
    } finally {
        DOM.loadingOverlay.classList.remove('active');
    }
}

function renderAirQuality(payload, aqi) {
    const pm25 = payload?.data?.iaqi?.pm25?.v || 'N/A';
    DOM.aqiValue.textContent = aqi;
    DOM.pm25Value.textContent = pm25;

    DOM.aqiCard.classList.remove('bg-good', 'bg-moderate', 'bg-poor');
    if (aqi <= 50) DOM.aqiCard.classList.add('bg-good');
    else if (aqi <= 100) DOM.aqiCard.classList.add('bg-moderate');
    else DOM.aqiCard.classList.add('bg-poor');
}

/**
 * Randează traficul și actualizează popup-urile native din Leaflet.
 */
function renderEcoTraffic(mockData) {
    const statusTrafic = ['Liber / Optim', 'Moderat', 'Aglomerat'];
    DOM.trafficList.innerHTML = ''; 
    const currentStatuses = {};

    CONFIG.LOCATIONS.forEach((loc, index) => {
        const indexStatus = (mockData[index]?.id || index) % statusTrafic.length;
        const statusGenerat = statusTrafic[indexStatus];
        
        currentStatuses[loc.name] = statusGenerat;

        // 1. Populează HTML-ul din lista laterală
        const li = document.createElement('li');
        li.dataset.street = loc.name; 
        li.innerHTML = `<strong>${loc.name}:</strong> <span class="traffic-state">${statusGenerat}</span>`;
        DOM.trafficList.appendChild(li);

        // 2. Actualizează dinamic Popup-ul markerului corespunzător de pe hartă
        if (mapMarkers[loc.name]) {
            mapMarkers[loc.name].setPopupContent(`
                <div style="text-align:center;">
                    <b>${loc.name}</b><br>
                    Trafic: <strong>${statusGenerat}</strong>
                </div>
            `);
        }
    });

    return currentStatuses;
}

function renderEcoRoutingRecommendations(aqi, streetStatuses) {
    DOM.tursibList.innerHTML = '';
    let hasRecommendations = false;

    if (aqi > 50) {
        hasRecommendations = true;
        const li = document.createElement('li');
        li.innerHTML = `<strong>Avertisment Aer:</strong> Nivelul AQI este ${aqi}. Vă recomandăm să folosiți transportul public Tursib azi.`;
        DOM.tursibList.appendChild(li);
    }

    Object.entries(streetStatuses).forEach(([street, status]) => {
        if (status === 'Aglomerat') {
            hasRecommendations = true;
            const liniiRecomandate = CONFIG.TURSIB_ROUTES[street].join(', ');
            
            const li = document.createElement('li');
            li.innerHTML = `⚠️ Trafic intens pe <strong>${street}</strong>. <br>Folosește linia Tursib <strong>${liniiRecomandate}</strong> pentru a reduce emisiile.`;
            DOM.tursibList.appendChild(li);
        }
    });

    if (!hasRecommendations) {
        DOM.tursibList.innerHTML = '<li>Condițiile de trafic și aer sunt excelente. Drum bun!</li>';
    }
}

// Demonstrație Event Bubbling pe container-ul mutat în Header-ul Hărții
DOM.controlsContainer.addEventListener('click', (event) => {
    console.warn('--- Analiză Event Bubbling ---');
    console.log('event.target:', event.target);
    console.log('event.currentTarget:', event.currentTarget);

    if (event.target.id === 'btn-refresh') {
        fetchTrackerData();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchTrackerData();
});