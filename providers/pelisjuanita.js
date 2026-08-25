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

function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const isSeries = type === "series" || type === "tv";
    const endpoint = isSeries ? "tv" : "movie";
    // Obtener título en inglés (por defecto) y en español
    const urlEn = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`;
    const urlEs = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c&language=es`;
    try {
      const [resEn, resEs] = yield Promise.all([fetch(urlEn), fetch(urlEs)]);
      const dataEn = yield resEn.json();
      const dataEs = yield resEs.json();
      
      const titleEn = isSeries ? dataEn.name : dataEn.title;
      const titleEs = isSeries ? dataEs.name : dataEs.title;
      const year = isSeries ? 
        (dataEn.first_air_date ? parseInt(dataEn.first_air_date.split("-")[0]) : 0) :
        (dataEn.release_date ? parseInt(dataEn.release_date.split("-")[0]) : 0);
      
      return {
        titleEn: titleEn,
        titleEs: titleEs || titleEn,
        year: year
      };
    } catch (error) {
      console.log(`[PelisJuanita] TMDB request failed: ${error.message}`);
      return null;
    }
  });
}

function createSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, "") // Eliminar caracteres especiales
    .trim()
    .replace(/\s+/g, "-"); // Reemplazar espacios por guiones
}

function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    const tmdbDetails = yield getTmdbDetails(tmdbId, type);
    if (!tmdbDetails) {
      console.log("[PelisJuanita] Could not fetch TMDB details");
      return [];
    }
    const { titleEn, titleEs, year } = tmdbDetails;
    console.log(`[PelisJuanita] English: ${titleEn}, Spanish: ${titleEs} (${year})`);

    // Generar slugs para inglés y español
    const slugEn = createSlug(titleEn);
    const slugEs = createSlug(titleEs);
    console.log(`[PelisJuanita] Slug EN: ${slugEn}, Slug ES: ${slugEs}`);

    // Lista de URLs a probar (inglés primero, luego español)
    const urlsToTry = [
      `${BASE_URL}/movies/pelicula/${slugEn}`,
      `${BASE_URL}/movies/pelicula/${slugEs}`,
      `${BASE_URL}/pelicula/${slugEn}`,
      `${BASE_URL}/pelicula/${slugEs}`,
      `${BASE_URL}/ver/${slugEn}`,
      `${BASE_URL}/ver/${slugEs}`,
    ];

    let movieHtml = null;
    let usedUrl = null;

    for (const url of urlsToTry) {
      console.log(`[PelisJuanita] Trying: ${url}`);
      const html = yield fetchText(url);
      if (html && !html.includes('404') && !html.includes('Not Found')) {
        movieHtml = html;
        usedUrl = url;
        break;
      }
    }

    // Si no funciona, usar la búsqueda avanzada
    if (!movieHtml) {
      console.log("[PelisJuanita] Direct URLs failed, trying advanced search...");
      const searchUrl = `${BASE_URL}/movies/busqueda-avanzada/?q=${encodeURIComponent(titleEn)}`;
      console.log(`[PelisJuanita] Search URL: ${searchUrl}`);
      const searchHtml = yield fetchText(searchUrl);
      if (searchHtml) {
        // Buscar el primer enlace que sea una película
        const linkMatch = searchHtml.match(/<a[^>]+href=["'](\/[^"']*pelicula[^"']*)["']/i) ||
                         searchHtml.match(/<a[^>]+href=["'](\/[^"']*movie[^"']*)["']/i);
        if (linkMatch) {
          let resultUrl = linkMatch[1];
          if (!resultUrl.startsWith("http")) {
            resultUrl = resultUrl.startsWith("/") ? `${BASE_URL}${resultUrl}` : `${BASE_URL}/${resultUrl}`;
          }
          console.log(`[PelisJuanita] Found result: ${resultUrl}`);
          movieHtml = yield fetchText(resultUrl);
          usedUrl = resultUrl;
        }
      }
    }

    if (!movieHtml) {
      console.log("[PelisJuanita] Could not fetch movie page");
      return [];
    }

    // Extraer el iframe
    const iframeMatch = movieHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) {
      console.log("[PelisJuanita] No iframe found");
      return [];
    }

    let iframeUrl = iframeMatch[1];
    if (!iframeUrl.startsWith("http")) {
      iframeUrl = iframeUrl.startsWith("/") ? `${BASE_URL}${iframeUrl}` : `${BASE_URL}/${iframeUrl}`;
    }
    console.log(`[PelisJuanita] Iframe URL: ${iframeUrl}`);

    return [{
      name: "PelisJuanita",
      title: titleEs || titleEn,
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
