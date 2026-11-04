// ==UserScript==
// @name         YouTube - Original Titel
// @namespace    https://csm-800.local/
// @version      1.1
// @description  Stellt die Originaltitel von YouTube-Videos wieder her.
// @author       CSM-800, ChatGPT
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @icon         https://www.youtube.com/s/desktop/2253fa3d/img/logos/favicon_144x144.png
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-original-titles.user.js
// @updateURL    https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-original-titles.user.js
// @supportURL   https://github.com/CSM-800/userscripts/issues
// ==/UserScript==

(() => {
  "use strict";

  const CACHE = new Map();
  const TITLE_ATTRIBUTE = "data-csm-original-title";

  let scanTimer = null;
  let scanRunning = false;
  let scanAgain = false;
  let lastUrl = location.href;

  // Video-ID aus normalen Videos und Shorts ermitteln.
  function getVideoId(href) {
    if (!href) return null;

    try {
      const url = new URL(href, location.origin);

      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);

      if (shorts) {
        return shorts[1];
      }
    } catch (_) {}

    return null;
  }

  function cleanText(value) {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : null;
  }

  // Originaltitel über YouTube oEmbed abrufen.
  async function fetchOriginalTitle(videoId) {
    try {
      const url =
        "https://www.youtube.com/oembed?url=" +
        encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`
        ) +
        "&format=json";

      const response = await fetch(url, {
        credentials: "omit"
      });

      if (!response.ok) return null;

      const data = await response.json();

      return cleanText(data.title);

    } catch (error) {
      console.warn(
        "[YouTube Original Titles] Titel konnte nicht abgerufen werden:",
        videoId,
        error
      );

      return null;
    }
  }

  // Titel mit Cache abrufen.
  function getOriginalTitle(videoId) {
    if (!videoId) return Promise.resolve(null);

    if (!CACHE.has(videoId)) {
      const request = fetchOriginalTitle(videoId);
      CACHE.set(videoId, request);

      // Fehlgeschlagene Anfragen nicht dauerhaft speichern.
      request.then(title => {
        if (!title) {
          CACHE.delete(videoId);
        }
      });
    }

    return CACHE.get(videoId);
  }

  function isVisible(element) {
    if (!element?.isConnected) return false;

    const rect = element.getBoundingClientRect();

    return rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= -1000 &&
      rect.top <= window.innerHeight + 1000;
  }

  // Titelbereich innerhalb einer Videokarte finden.
  function getCardTitleElement(anchor) {
    const selectors = [
      "#video-title",
      "#video-title-link",
      ".media-item-headline",
      ".compact-media-item-headline",
      ".video-title",
      "h3"
    ].join(", ");

    if (anchor.matches(selectors)) {
      return anchor;
    }

    return anchor.querySelector(selectors);
  }

  async function restoreCardTitle(anchor) {
    const videoId = getVideoId(anchor.href);

    if (!videoId) return;

    const titleElement = getCardTitleElement(anchor);

    if (!titleElement || !isVisible(titleElement)) return;

    const originalTitle = await getOriginalTitle(videoId);

    if (!originalTitle) return;

    // Prüfen, ob das Element inzwischen für ein anderes Video
    // wiederverwendet wurde.
    if (getVideoId(anchor.href) !== videoId) return;

    if (titleElement.textContent.trim() === originalTitle) {
      titleElement.setAttribute(TITLE_ATTRIBUTE, videoId);
      return;
    }

    titleElement.textContent = originalTitle;
    titleElement.setAttribute(TITLE_ATTRIBUTE, videoId);
    titleElement.setAttribute("title", originalTitle);
  }

  // Titelbereich auf der Videoseite finden.
  function getWatchTitleElement() {
    return document.querySelector(
      [
        // Desktop
        "ytd-watch-metadata h1 yt-formatted-string",
        "ytd-watch-metadata h1",
        "ytd-video-primary-info-renderer h1",

        // Mobile
        "ytm-slim-video-metadata-section-renderer h1",
        "ytm-video-primary-info-renderer h1",
        "ytm-watch-metadata h1",
        "#title h1",
        "h1.title"
      ].join(", ")
    );
  }

  async function restoreWatchTitle() {
    if (location.pathname !== "/watch") return;

    const videoId = new URLSearchParams(location.search).get("v");

    if (!videoId) return;

    const titleElement = getWatchTitleElement();

    if (!titleElement) return;

    const originalTitle = await getOriginalTitle(videoId);

    if (!originalTitle) return;

    // Navigation während der Anfrage berücksichtigen.
    if (
      location.pathname !== "/watch" ||
      new URLSearchParams(location.search).get("v") !== videoId
    ) {
      return;
    }

    if (titleElement.textContent.trim() !== originalTitle) {
      titleElement.textContent = originalTitle;
    }

    titleElement.setAttribute(TITLE_ATTRIBUTE, videoId);
    titleElement.setAttribute("title", originalTitle);
  }

  // Videokarten auf der aktuellen Seite durchsuchen.
  async function scan() {
    if (scanRunning) {
      scanAgain = true;
      return;
    }

    scanRunning = true;

    try {
      const anchors = Array.from(
        document.querySelectorAll(
          'a[href*="/watch?v="], a[href*="/shorts/"]'
        )
      ).filter(isVisible);

      // Begrenzung pro Durchlauf.
      const visibleAnchors = anchors.slice(0, 30);

      await Promise.all(
        visibleAnchors.map(restoreCardTitle)
      );

      await restoreWatchTitle();

    } finally {
      scanRunning = false;
    }

    if (scanAgain) {
      scanAgain = false;
      scheduleScan(100);
    }
  }

  function scheduleScan(delay = 250) {
    if (scanTimer !== null) {
      clearTimeout(scanTimer);
    }

    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, delay);
  }

  function handleNavigation() {
    const currentUrl = location.href;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
    }

    scheduleScan(100);
    scheduleScan(500);
    scheduleScan(1200);
    scheduleScan(2500);
  }

  function start() {
    scheduleScan(100);

    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    document.addEventListener(
      "yt-navigate-start",
      handleNavigation
    );

    document.addEventListener(
      "yt-navigate-finish",
      handleNavigation
    );

    document.addEventListener(
      "yt-page-data-updated",
      handleNavigation
    );

    document.addEventListener(
      "yt-player-updated",
      handleNavigation
    );

    window.addEventListener("popstate", handleNavigation);

    // Zusätzliche Erkennung von URL-Wechseln.
    setInterval(() => {
      if (location.href !== lastUrl) {
        handleNavigation();
      }
    }, 500);
  }

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  }
})();
