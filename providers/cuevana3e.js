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

function decodeBase64(str) {
    try {
        if (typeof atob === 'function') {
            return atob(str);
        }
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str, 'base64').toString('utf-8');
        }
        return null;
    } catch (e) {
        return null;
    }
}

function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Cuevana3E] Buscando ${mediaType} ${tmdbId}`);

    return getBaseUrl().then(baseUrl => {
        // 🔑 CLAVE: Forzar TMDB a devolver el título en ESPAÑOL
        return fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es`)
            .then(response => response.json())
            .then(data => {
                const title = mediaType === 'tv' ? data.name : data.title;
                if (!title) throw new Error("No se encontró título");
                
                console.log(`[Cuevana3E] Título: ${title}`);
                
                const slug = createSlug(title);
                console.log(`[Cuevana3E] Slug: ${slug}`);
                
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
                
                const streamUrls = [];
                
                const dataServerRegex = /data-server=["']([^"']+)["']/gi;
                let match;
                
                while ((match = dataServerRegex.exec(html)) !== null) {
                    const serverUrl = match[1];
                    
                    if (serverUrl.includes('?v=')) {
                        const base64Part = serverUrl.split('?v=')[1];
                        const decoded = decodeBase64(base64Part);
                        
                        if (decoded && decoded.startsWith('http')) {
                            let serverName = "Cuevana3E";
                            try {
                                const hostname = new URL(decoded).hostname;
                                serverName = `Cuevana3E - ${hostname}`;
                            } catch (e) {}
                            
                            streamUrls.push({
                                name: serverName,
                                title: `Stream en Español (${serverName})`,
                                url: decoded,
                                quality: "HD",
                                behaviorHints: {
                                    bingeGroup: "cuevana3e",
                                    proxyHeaders: false,
                                    notWebVideo: false,
                                }
                            });
                            
                            console.log(`[Cuevana3E] ${serverName}: ${decoded}`);
                        }
                    } else if (serverUrl.includes('?token=')) {
                        console.log(`[Cuevana3E] Token encontrado: ${serverUrl}`);
                        streamUrls.push({
                            name: `Cuevana3E - Token`,
                            title: `Stream en Español (Token)`,
                            url: serverUrl,
                            quality: "HD",
                            behaviorHints: {
                                bingeGroup: "cuevana3e",
                                proxyHeaders: false,
                                notWebVideo: false,
                            }
                        });
                    }
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
