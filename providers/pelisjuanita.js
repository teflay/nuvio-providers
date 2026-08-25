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

// Función para obtener los detalles de TMDB (título y año)
function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const isSeries = type === "series" || type === "tv";
    const endpoint = isSeries ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`;
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (isSeries) {
        return {
          title: data.name,
          year: data.first_air_date ? parseInt(data.first_air_date.split("-")[0]) : 0
        };
      } else {
        return {
          title: data.title,
          year: data.release_date ? parseInt(data.release_date.split("-")[0]) : 0
        };
      }
    } catch (error) {
      console.log(`[PelisJuanita] TMDB request failed: ${error.message}`);
      return null;
    }
  });
}

function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    // 1. Obtener título y año de TMDB
    const tmdbDetails = yield getTmdbDetails(tmdbId, type);
    if (!tmdbDetails) {
      console.log("[PelisJuanita] Could not fetch TMDB details");
      return [];
    }
    const { title, year } = tmdbDetails;
    console.log(`[PelisJuanita] Searching for: ${title} (${year})`);

    // 2. Buscar en pelisjuanita por título y año
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title + " " + year)}`;
    console.log(`[PelisJuanita] Search URL: ${searchUrl}`);
    const searchHtml = yield fetchText(searchUrl);
    if (!searchHtml) {
      console.log("[PelisJuanita] Search failed");
      return [];
    }

    // 3. Extraer el enlace del primer resultado
    // Buscar enlaces que contengan "/pelicula/" o "/movie/"
    const linkMatch = searchHtml.match(/<a[^>]+href=["'](\/[^"']*pelicula[^"']*)["']/i) ||
                      searchHtml.match(/<a[^>]+href=["'](\/[^"']*movie[^"']*)["']/i) ||
                      searchHtml.match(/<a[^>]+href=["'](\/[^"']*ver[^"']*)["']/i);
    if (!linkMatch) {
      console.log("[PelisJuanita] No result link found");
      return [];
    }

    let resultUrl = linkMatch[1];
    if (!resultUrl.startsWith("http")) {
      resultUrl = resultUrl.startsWith("/") ? `${BASE_URL}${resultUrl}` : `${BASE_URL}/${resultUrl}`;
    }
    console.log(`[PelisJuanita] Result URL: ${resultUrl}`);

    // 4. Obtener la página de la película
    const movieHtml = yield fetchText(resultUrl);
    if (!movieHtml) {
      console.log("[PelisJuanita] Could not fetch movie page");
      return [];
    }

    // 5. Extraer el iframe del reproductor
    const iframeMatch = movieHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) {
      console.log("[PelisJuanita] No iframe found on movie page");
      return [];
    }

    let iframeUrl = iframeMatch[1];
    if (!iframeUrl.startsWith("http")) {
      iframeUrl = iframeUrl.startsWith("/") ? `${BASE_URL}${iframeUrl}` : `${BASE_URL}/${iframeUrl}`;
    }
    console.log(`[PelisJuanita] Iframe URL: ${iframeUrl}`);

    // 6. Devolver el stream
    return [{
      name: "PelisJuanita",
      title: title,
      url: iframeUrl,
      quality: "1080p",
      behaviorHints: {
        bingeGroup: "pelisjuanita",
        proxyHeaders: false,
        notWebVideo: false,
      }
    }];
  });
}

module.exports = { getStreams };
