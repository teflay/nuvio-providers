// providers/cuevana3e.js
const cheerio = require("cheerio-without-node-native");

const DOMAINS_URL = "https://raw.githubusercontent.com/teflay/nuvio-providers/main/domains.json";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

let cachedDomain = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000;

async function getBaseUrl() {
    const now = Date.now();
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
    return "https://cuevana3e.pro";
}

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
        return fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es`)
            .then(response => response.json())
            .then(data => {
                const title = mediaType === 'tv' ? data.name : data.title;
                if (!title) throw new Error("No se encontró título");
                
                const slug = createSlug(title);
                let pageUrl;

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
                const streamUrls = [];
                
                // Extraer TODOS los enlaces de data-server
                $('li[data-server]').each((i, el) => {
                    const serverUrl = $(el).attr('data-server');
                    const serverName = $(el).find('span').first().text().trim() || `Servidor ${i + 1}`;
                    
                    if (serverUrl) {
                        console.log(`[Cuevana3E] ${serverName}: ${serverUrl}`);
                        
                        // Si el enlace es relativo, construir la URL completa
                        let fullUrl = serverUrl;
                        if (fullUrl.startsWith('//')) {
                            fullUrl = 'https:' + fullUrl;
                        } else if (fullUrl.startsWith('/')) {
                            fullUrl = getBaseUrl() + fullUrl;
                        }
                        
                        // Detectar la calidad (si es posible)
                        let quality = "HD";
                        if (fullUrl.includes('4k') || fullUrl.includes('2160')) {
                            quality = "2160p";
                        } else if (fullUrl.includes('1080')) {
                            quality = "1080p";
                        } else if (fullUrl.includes('720')) {
                            quality = "720p";
                        }
                        
                        streamUrls.push({
                            name: `Cuevana3E - ${serverName}`,
                            title: `${serverName} (${quality})`,
                            url: fullUrl,
                            quality: quality,
                            behaviorHints: {
                                bingeGroup: "cuevana3e",
                                proxyHeaders: false,
                                notWebVideo: false,
                            }
                        });
                    }
                });
                
                // Si no hay data-server, buscar iframes como fallback
                if (streamUrls.length === 0) {
                    console.log("[Cuevana3E] No hay data-server, buscando iframes...");
                    $('iframe').each((i, el) => {
                        const src = $(el).attr('src');
                        if (src) {
                            streamUrls.push({
                                name: `Cuevana3E - Iframe ${i + 1}`,
                                title: "Stream en Español",
                                url: src,
                                quality: "HD",
                                behaviorHints: {
                                    bingeGroup: "cuevana3e",
                                    proxyHeaders: false,
                                    notWebVideo: false,
                                }
                            });
                        }
                    });
                }
                
                console.log(`[Cuevana3E] Total de streams encontrados: ${streamUrls.length}`);
                return streamUrls;
            });
    })
    .catch(error => {
        console.error('[Cuevana3E] Error:', error.message);
        return [];
    });
}

module.exports = { getStreams };
