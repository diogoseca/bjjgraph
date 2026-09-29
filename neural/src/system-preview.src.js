// Shared by the Neural bundle and the static guide. Source URLs identify official
// media; playback preferences belong here, never in an origin-verification gate.
export function ngSystemPreviewURL(preview, origin = globalThis.location?.origin) {
  try {
    const u = new URL(preview?.embed_url);
    if (u.protocol !== "https:" || u.username || u.password || u.hash || u.port) return null;
    const bunny = preview.provider === "bunny" &&
      ["iframe.mediadelivery.net", "player.mediadelivery.net"].includes(u.host) &&
      /^\/embed\/\d+\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(u.pathname);
    const youtube = preview.provider === "youtube" &&
      ["www.youtube.com", "www.youtube-nocookie.com"].includes(u.host) && /^\/embed\/[\w-]{11}$/.test(u.pathname);
    if (!bunny && !youtube) return null;
    for (const key of ["list", "playlist", "t", "start", "end"]) u.searchParams.delete(key);
    if (bunny) {
      for (const [key, value] of Object.entries({ autoplay: "true", muted: "true", preload: "true", playsinline: "true", loop: "false", rememberPosition: "false" })) u.searchParams.set(key, value);
    } else {
      // Never race autoplay against mute(): the API starts only after muting.
      for (const [key, value] of Object.entries({ autoplay: "0", enablejsapi: "1", playsinline: "1", controls: "1", loop: "0", origin })) if (value) u.searchParams.set(key, value);
    }
    return u.href;
  } catch { return null; }
}

export function ngSystemYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__bjjSystemYouTubeAPI) return window.__bjjSystemYouTubeAPI;
  window.__bjjSystemYouTubeAPI = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { previous?.(); } finally { resolve(window.YT); }
    };
    let script = document.getElementById("yt-iframe-api");
    if (!script) {
      script = document.createElement("script");
      script.id = "yt-iframe-api"; script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => {
      window.__bjjSystemYouTubeAPI = null;
      script.remove(); reject(new Error("YouTube player unavailable"));
    }, { once: true });
  });
  return window.__bjjSystemYouTubeAPI;
}

export function ngSystemBunnyAPI() {
  if (window.playerjs?.Player) return Promise.resolve(window.playerjs);
  if (window.__bjjSystemBunnyAPI) return window.__bjjSystemBunnyAPI;
  window.__bjjSystemBunnyAPI = new Promise((resolve, reject) => {
    let script = document.getElementById("bjj-system-playerjs");
    const fail = () => {
      window.__bjjSystemBunnyAPI = null;
      script.remove(); reject(new Error("Bunny player unavailable"));
    };
    if (!script) {
      script = document.createElement("script");
      script.id = "bjj-system-playerjs";
      script.src = "https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js";
      script.addEventListener("load", () => window.playerjs?.Player ? resolve(window.playerjs) : fail(), { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", () => window.playerjs?.Player ? resolve(window.playerjs) : fail(), { once: true });
      script.addEventListener("error", fail, { once: true });
    }
  });
  return window.__bjjSystemBunnyAPI;
}

export function ngMountSystemPreview(target, preview, { onReady = () => {}, onError = () => {} } = {}) {
  const url = ngSystemPreviewURL(preview);
  if (!url) return null;
  const frame = document.createElement("iframe");
  frame.title = preview.title || "Official course intro";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  frame.allowFullscreen = true;
  frame.loading = "eager";
  frame.style.cssText = "display:block;width:100%;aspect-ratio:16/9;border:0;pointer-events:auto;visibility:hidden";
  let destroyed = false, player = null;
  const ready = () => { if (!destroyed) { clearTimeout(timer); frame.style.visibility = "visible"; onReady(); } };
  const fail = () => { if (!destroyed) { handle.destroy(); onError(); } };
  // A stalled network must not leave a blank video box forever. Autoplay denial
  // is different: a ready native player stays visible with its play control.
  const timer = setTimeout(fail, 20000);
  const handle = {
    frame, url,
    destroy() {
      if (destroyed) return;
      destroyed = true; clearTimeout(timer);
      frame.onload = frame.onerror = null;
      if (preview.provider === "bunny") {
        // Player.js exposes off(), not destroy(). Remove our callbacks before
        // removing the iframe, which is the authoritative playback teardown.
        try { player?.off("ready", ready); } catch { /* frame removal still stops media */ }
        try { player?.off("error", fail); } catch { /* frame removal still stops media */ }
        // The SDK keeps an internal window listener and identifies ready events
        // by iframe.src. Retire that identity before a later visit to this same
        // video can wake its removed frame and flush commands into a null window.
        frame.src = "about:blank";
      } else {
        try { player?.destroy(); } catch { /* iframe removal still stops media */ }
      }
      frame.remove();
    },
  };
  frame.onerror = fail;
  frame.src = url;
  // An iframe load also fires for HTTP 403/error pages. Only the provider's
  // ready handshake may reveal it. Load the SDK first so Player.js cannot miss
  // a cached iframe's load/ready events before its global listener exists.
  if (preview.provider === "youtube") {
    ngSystemYouTubeAPI().then(YT => {
      if (destroyed) return;
      target.appendChild(frame);
      player = new YT.Player(frame, { events: {
        onReady(event) {
          if (destroyed) return;
          event.target.mute();
          if (!document.hidden) event.target.playVideo();
          ready();
        },
        onError: fail,
        onAutoplayBlocked: ready,
      } });
    }).catch(fail);
  } else {
    ngSystemBunnyAPI().then(PlayerJS => {
      if (destroyed) return;
      target.appendChild(frame);
      player = new PlayerJS.Player(frame);
      player.on("ready", ready);
      player.on("error", fail);
    }).catch(fail);
  }
  return handle;
}
