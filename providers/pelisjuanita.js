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
            "User-Agent": USER_AGENT
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
    
    // Buscar la página de la película en pelisjuanita
    const searchUrl = `${BASE_URL}/search?q=${tmdbId}`;
    const html = yield fetchText(searchUrl);
    if (!html) {
      console.log("[PelisJuanita] No results found");
      return [];
    }
    
    // Extraer el enlace del iframe
    // Buscar el ID del iframe o el src directo
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) {
      console.log("[PelisJuanita] No iframe found");
      return [];
    }
    
    const iframeUrl = iframeMatch[1];
    console.log(`[PelisJuanita] Found iframe: ${iframeUrl}`);
    
    // Si la URL no es absoluta, construirla
    const fullUrl = iframeUrl.startsWith("http") ? iframeUrl : `${BASE_URL}${iframeUrl}`;
    
    // Extraer la calidad del stream (puedes mejorar esto)
    let quality = "1080p";
    if (fullUrl.includes("4k") || fullUrl.includes("4K")) {
      quality = "2160p";
    } else if (fullUrl.includes("720")) {
      quality = "720p";
    }
    
    // Devolver el stream
    return [{
      name: `PelisJuanita - ${quality}`,
      title: `Stream ${quality}`,
      url: fullUrl,
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
