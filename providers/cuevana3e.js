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
                
                // 1. Extraer TODOS los iframes de la página principal
                const iframes = $('iframe');
                console.log(`[Cuevana3E] Encontrados ${iframes.length} iframes en la página principal`);
                
                iframes.each((i, el) => {
                    let src = $(el).attr('src');
                    if (src) {
                        // Si el iframe es relativo, construir la URL completa
                        if (src.startsWith('//')) {
                            src = 'https:' + src;
                        } else if (src.startsWith('/')) {
                            src = getBaseUrl() + src;
                        }
                        
                        console.log(`[Cuevana3E] Iframe ${i+1}: ${src}`);
                        
                        // Añadir el iframe como stream
                        streamUrls.push({
                            name: `Cuevana3E - Servidor ${i + 1}`,
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
                
                // 2. También buscar enlaces directos de tungtungsahur (por si acaso)
                const tungtungsahurRegex = /https?:\/\/tungtungsahur\.cuevana3e\.pro\/\?[^"'\s<>]+/gi;
                const matches = html.match(tungtungsahurRegex);
                
                if (matches) {
                    const uniqueUrls = [...new Set(matches)];
                    console.log(`[Cuevana3E] Encontrados ${uniqueUrls.length} enlaces de tungtungsahur`);
                    
                    uniqueUrls.forEach((url, index) => {
                        // Evitar duplicados
                        if (!streamUrls.some(s => s.url === url)) {
                            streamUrls.push({
                                name: `Cuevana3E - Token ${index + 1}`,
                                title: "Stream en Español",
                                url: url,
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
