"use strict";

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const BASE_URL = "https://pelisjuanita.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function fetchText(url, options = {}) {
  return __async(this, arguments, function* (url, options = {}) {
    const retries = options.retries !== void 0 ? options.retries : 2;
    const delay = options.delay !== void 0 ? options.delay : 1000;
    for (let i = 0; i <= retries; i++) {
      try {
        const response = yield fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL
          }
        });
        return yield response.text();
      } catch (err) {
        console.log(`[PelisJuanita] Request failed: ${err.message}`);
      }
      if (i < retries) {
        yield new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
    return null;
  });
}

function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    console.log(`[PelisJuanita] Searching for TMDB ID: ${tmdbId}`);
    
    // Construir URL de búsqueda
    // pelisjuanita usa el TMDB ID directamente en la URL
    const searchUrl = `${BASE_URL}/movie/${tmdbId}`;
    console.log(`[PelisJuanita] Fetching: ${searchUrl}`);
    
    const html = yield fetchText(searchUrl);
    if (!html) {
      console.log("[PelisJuanita] No results found");
      return [];
    }
    
    // Buscar el iframe del reproductor
    // El iframe puede estar en diferentes lugares
    let iframeUrl = null;
    
    // Intentar diferentes patrones de búsqueda
    const patterns = [
      // Buscar iframe con src
      /<iframe[^>]+src=["']([^"']+)["']/i,
      // Buscar enlace de player.php
      /player\.php\?id=[^"'\s]+/i,
      // Buscar enlace de reproducción
      /href=["']([^"']*player[^"']*)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        iframeUrl = match[1] || match[0];
        break;
      }
    }
    
    if (!iframeUrl) {
      console.log("[PelisJuanita] No iframe found");
      return [];
    }
    
    // Si la URL no es absoluta, construirla
    if (!iframeUrl.startsWith("http")) {
      iframeUrl = iframeUrl.startsWith("/") ? `${BASE_URL}${iframeUrl}` : `${BASE_URL}/${iframeUrl}`;
    }
    
    console.log(`[PelisJuanita] Found stream URL: ${iframeUrl}`);
    
    // Verificar si el enlace es válido
    const testResponse = yield fetch(iframeUrl, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT }
    });
    
    if (!testResponse.ok) {
      console.log(`[PelisJuanita] Stream URL not accessible: ${testResponse.status}`);
      return [];
    }
    
    // Detectar calidad
    let quality = "1080p";
    if (iframeUrl.includes("4k") || iframeUrl.includes("4K") || iframeUrl.includes("2160")) {
      quality = "2160p";
    } else if (iframeUrl.includes("720")) {
      quality = "720p";
    }
    
    // Si es serie, agregar temporada/episodio al título
    let title = "PelisJuanita Stream";
    if (type === "tv" || type === "series") {
      const seasonStr = season ? `S${String(season).padStart(2, "0")}` : "";
      const episodeStr = episode ? `E${String(episode).padStart(2, "0")}` : "";
      if (seasonStr || episodeStr) {
        title = `${seasonStr}${episodeStr}`;
      }
    }
    
    // Devolver el stream
    return [{
      name: `PelisJuanita - ${quality}`,
      title: title || "PelisJuanita Stream",
      url: iframeUrl,
      quality: quality,
      behaviorHints: {
        bingeGroup: "pelisjuanita",
        proxyHeaders: false,
        notWebVideo: false,
      }
    }];
  });
}

module.exports = { getStreams };
