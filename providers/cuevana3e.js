// providers/cuevana3e.js
const cheerio = require("cheerio-without-node-native");

const DOMAINS_URL = "https://raw.githubusercontent.com/teflay/nuvio-providers/main/domains.json";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

let cachedDomain = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000;

function getBaseUrl() {
    var now = Date.now();
    if (cachedDomain && (now - cacheTimestamp) < CACHE_DURATION) {
        return Promise.resolve(cachedDomain);
    }
    return fetch(DOMAINS_URL)
        .then(function(response) { return response.json(); })
        .then(function(domains) {
            if (domains.cuevana3e && domains.cuevana3e.baseUrl) {
                cachedDomain = domains.cuevana3e.baseUrl;
                cacheTimestamp = now;
                console.log(`[Cuevana3E] Dominio actualizado: ${cachedDomain}`);
                return cachedDomain;
            }
            return "https://cuevana3e.pro";
        })
        .catch(function(error) {
            console.log(`[Cuevana3E] Error obteniendo dominio: ${error.message}`);
            return "https://cuevana3e.pro";
        });
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

    return getBaseUrl().then(function(baseUrl) {
        // 🔑 CLAVE: Forzar TMDB a devolver el título en ESPAÑOL
        return fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es`);
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        var title = mediaType === 'tv' ? data.name : data.title;
        if (!title) throw new Error("No se encontró título");
        
        console.log(`[Cuevana3E] Título: ${title}`);
        
        var slug = createSlug(title);
        console.log(`[Cuevana3E] Slug: ${slug}`);
        
        var pageUrl;
        if (mediaType === 'tv' && season && episode) {
            pageUrl = `${baseUrl}/serie/${slug}/episodio-${season}x${episode}`;
        } else if (mediaType === 'movie') {
            pageUrl = `${baseUrl}/pelicula/${slug}/`;
        } else {
            return [];
        }

        console.log(`[Cuevana3E] Obteniendo: ${pageUrl}`);
        return fetch(pageUrl).then(function(res) { return res.text(); });
    })
    .then(function(html) {
        if (!html) return [];
        
        var streamUrls = [];
        var dataServerRegex = /data-server=["']([^"']+)["']/gi;
        var match;
        
        while ((match = dataServerRegex.exec(html)) !== null) {
            var serverUrl = match[1];
            
            if (serverUrl.includes('?v=')) {
                var base64Part = serverUrl.split('?v=')[1];
                var decoded = decodeBase64(base64Part);
                
                if (decoded && decoded.startsWith('http')) {
                    var serverName = "Cuevana3E";
                    try {
                        var hostname = new URL(decoded).hostname;
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
    })
    .catch(function(error) {
        console.error('[Cuevana3E] Error:', error.message);
        return [];
    });
}

module.exports = { getStreams };
