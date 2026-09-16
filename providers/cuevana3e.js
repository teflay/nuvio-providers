// providers/cuevana3e.js
const cheerio = require("cheerio-without-node-native");

// URL del archivo de dominios en tu repositorio
const DOMAINS_URL = "https://raw.githubusercontent.com/TU_USUARIO/nuvio-providers/main/domains.json";
const TMDB_API_KEY = "TU_API_KEY";

// Caché del dominio (para no descargar en cada petición)
let cachedDomain = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

// Obtener el dominio actualizado
async function getBaseUrl() {
    const now = Date.now();
    
    // Usar caché si es reciente
    if (cachedDomain && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedDomain;
    }
    
    try {
        const response = await fetch(DOMAINS_URL);
        const domains = await response.json();
        
        if (domains.cuevana3e && domains.cuevana3e.baseUrl) {
            cachedDomain = domains.cuevana3e.baseUrl;
            cacheTimestamp = now;
            console.log(`[Cuevana3E] Dominio actualizado: ${cachedDomain}`);
            return cachedDomain;
        }
    } catch (error) {
        console.log(`[Cuevana3E] Error obteniendo dominio: ${error.message}`);
    }
    
    // Fallback al dominio por defecto
    return "https://cuevana3e.pro";
}

// Función para convertir un título en slug
function createSlug(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Cuevana3E] Buscando ${mediaType} ${tmdbId}`);

    return getBaseUrl().then(baseUrl => {
        // 1. Obtener el título de TMDB
        return fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es`)
            .then(response => response.json())
            .then(data => {
                const title = mediaType === 'tv' ? data.name : data.title;
                if (!title) throw new Error("No se encontró título");
                
                const slug = createSlug(title);
                let pageUrl;

                // 2. Construir la URL de la página
                if (mediaType === 'tv' && season && episode) {
                    pageUrl = `${baseUrl}/serie/${slug}/episodio-${season}x${episode}`;
                } else if (mediaType === 'movie') {
                    pageUrl = `${baseUrl}/pelicula/${slug}/`;
                } else {
                    return [];
                }

                console.log(`[Cuevana3E] Obteniendo: ${pageUrl}`);
                return fetch(pageUrl).then(res => res.text());
            })
            .then(html => {
                if (!html) return [];
                
                const $ = cheerio.load(html);
                const iframe = $('iframe').first();
                const src = iframe.attr('src');

                if (!src) {
                    console.log("[Cuevana3E] No se encontró iframe");
                    return [];
                }

                return [{
                    name: "Cuevana3E",
                    title: "Stream en Español",
                    url: src,
                    quality: "HD",
                    behaviorHints: {
                        bingeGroup: "cuevana3e",
                        proxyHeaders: false,
                        notWebVideo: false,
                    }
                }];
            });
    })
    .catch(error => {
        console.error('[Cuevana3E] Error:', error.message);
        return [];
    });
}

module.exports = { getStreams };
