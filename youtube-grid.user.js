// ==UserScript==
// @name         YouTube Grid
// @namespace    https://csm-800.local/
// @version      2.1
// @description  Stellt die Abos in einem Grid dar.
// @author       CSM-800, ChatGPT
// @match        https://m.youtube.com/*
// @icon         https://www.youtube.com/s/desktop/2253fa3d/img/logos/favicon_144x144.png
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/CSM-800/userscript-youtube-grid/raw/refs/heads/main/youtube-grid.user.js
// @downloadURL  https://github.com/CSM-800/userscript-youtube-grid/raw/refs/heads/main/youtube-grid.user.js
// @supportURL   https://github.com/CSM-800/userscript-youtube-grid/issues
// ==/UserScript==

(() => {
  "use strict";

  const STYLE_ID = "csm800-style";
  const TOGGLE_ID = "csm800-toggle";
  const PIP_ID = "csm800-pip";
  const HIDE_CLASS = "csm800-hidden";
  const HIDE_THRESHOLD = 10;

  let hideWatched = true;
  let updateTimer = null;
  let lastUrl = location.href;

  function isSubscriptionsPage() {
    return location.pathname.startsWith("/feed/subscriptions");
  }

  function isVideoPage() {
    return location.pathname === "/watch" &&
      new URLSearchParams(location.search).has("v");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      ytm-rich-item-renderer.${HIDE_CLASS} {
        display: none !important;
      }

      #${TOGGLE_ID},
      #${PIP_ID} {
        display: inline-flex !important;
        flex: 0 0 auto !important;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 40px;
        margin: 0 4px;
        padding: 0 6px;
        border: 0;
        background: transparent;
        color: #fff !important;
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      #${TOGGLE_ID} .csm800-label {
        color: #fff !important;
      }

      #${TOGGLE_ID} .csm800-switch {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 24px;
        flex: 0 0 46px;
        border-radius: 999px;
        background: #d93025;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        transition: background 0.18s ease;
      }

      #${TOGGLE_ID}.csm800-active .csm800-switch {
        background: #777;
      }

      #${TOGGLE_ID}:focus-visible,
      #${PIP_ID}:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
        border-radius: 6px;
      }

      #${PIP_ID} svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function getProgress(card) {
    const progress = card.querySelector(
      "ytw-thumbnail-overlay-resume-playback-renderer " +
      ".ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress"
    );

    if (!progress) return null;

    const inlineStyle = progress.getAttribute("style") || "";
    const inlineMatch = inlineStyle.match(
      /(?:^|;)\s*width\s*:\s*([\d.]+)\s*%/i
    );

    if (inlineMatch) {
      return Number(inlineMatch[1]);
    }

    const widthMatch = (progress.style.width || "").match(/^([\d.]+)%$/);

    return widthMatch ? Number(widthMatch[1]) : null;
  }

  function getCards() {
    return document.querySelectorAll(
      "ytm-rich-grid-renderer .rich-grid-renderer-contents ytm-rich-item-renderer"
    );
  }

  function processCards() {
    getCards().forEach(card => {
      const progress = getProgress(card);
      const watched = progress !== null &&
        progress >= HIDE_THRESHOLD;

      const shouldHide = hideWatched && watched;
      const isHidden = card.classList.contains(HIDE_CLASS);

      if (shouldHide !== isHidden) {
        card.classList.toggle(HIDE_CLASS, shouldHide);
      }
    });
  }

  function restoreCards() {
    document.querySelectorAll(
      `ytm-rich-item-renderer.${HIDE_CLASS}`
    ).forEach(card => {
      card.classList.remove(HIDE_CLASS);
    });
  }

  function updateToggleState(toggle) {
    const switchElement = toggle.querySelector(".csm800-switch");
    const labelElement = toggle.querySelector(".csm800-label");

    if (!switchElement || !labelElement) return;

    toggle.classList.toggle("csm800-active", hideWatched);

    labelElement.textContent = "Wiedergabefilter";

    const switchText = hideWatched ? "AN" : "AUS";
    switchElement.textContent = switchText;

    const ariaText = String(hideWatched);

    toggle.setAttribute("aria-checked", ariaText);
    toggle.setAttribute(
      "aria-label",
      `Wiedergabefilter: ${hideWatched ? "An" : "Aus"}`
    );
  }

  function getHeaderButton() {
    const header = document.querySelector(
      "ytm-mobile-topbar-renderer#header-bar header.mobile-topbar-header"
    );

    if (!header) return null;

    return header.querySelector(
      ".mobile-topbar-header-content.non-search-mode " +
      ".topbar-button-search-button"
    );
  }

  function installToggle() {
    const searchButton = getHeaderButton();
    if (!searchButton) return;

    let toggle = document.getElementById(TOGGLE_ID);

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = TOGGLE_ID;
      toggle.type = "button";
      toggle.setAttribute("role", "switch");

      const label = document.createElement("span");
      label.className = "csm800-label";
      label.textContent = "Wiedergabefilter";

      const switchElement = document.createElement("span");
      switchElement.className = "csm800-switch";

      toggle.appendChild(label);
      toggle.appendChild(switchElement);

      toggle.addEventListener("click", () => {
        hideWatched = !hideWatched;
        updateToggleState(toggle);
        processCards();
      });
    }

    if (
      toggle.parentElement !== searchButton.parentElement ||
      toggle.nextElementSibling !== searchButton
    ) {
      searchButton.before(toggle);
    }

    updateToggleState(toggle);
  }

  async function togglePiP() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }

    const video = document.querySelector("video.html5-main-video");

    if (!video) {
      console.warn("[YouTube Grid] Kein Videoplayer gefunden.");
      return;
    }

    if (
      !document.pictureInPictureEnabled ||
      video.disablePictureInPicture
    ) {
      console.warn("[YouTube Grid] PiP wird für dieses Video nicht unterstützt.");
      return;
    }

    try {
      await video.requestPictureInPicture();
    } catch (error) {
      console.error(
        "[YouTube Grid] PiP konnte nicht gestartet werden:",
        error
      );
    }
  }

  function installPiPButton() {
    const searchButton = getHeaderButton();
    if (!searchButton) return;

    let button = document.getElementById(PIP_ID);

    if (!button) {
      button = document.createElement("button");
      button.id = PIP_ID;
      button.type = "button";
      button.title = "Bild-in-Bild";
      button.setAttribute("aria-label", "Bild-in-Bild");

      const svgNS = "http://www.w3.org/2000/svg";

      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");

      const path = document.createElementNS(svgNS, "path");
      path.setAttribute(
        "d",
        "M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"
      );

      svg.appendChild(path);
      button.appendChild(svg);

      button.addEventListener("click", togglePiP);
    }

    if (
      button.parentElement !== searchButton.parentElement ||
      button.nextElementSibling !== searchButton
    ) {
      searchButton.before(button);
    }
  }

  function update() {
    const subscriptionsPage = isSubscriptionsPage();
    const videoPage = isVideoPage();

    if (!subscriptionsPage) {
      const toggle = document.getElementById(TOGGLE_ID);

      if (toggle) {
        toggle.remove();
      }

      restoreCards();
    } else {
      installStyle();
      installToggle();
      processCards();
    }

    if (videoPage) {
      installStyle();
      installPiPButton();
    } else {
      const pipButton = document.getElementById(PIP_ID);

      if (pipButton) {
        pipButton.remove();
      }
    }
  }

  function scheduleUpdate(delay = 250) {
    if (updateTimer !== null) {
      clearTimeout(updateTimer);
    }

    updateTimer = setTimeout(() => {
      updateTimer = null;
      update();
    }, delay);
  }

  function handleNavigation() {
    const currentUrl = location.href;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
    }

    scheduleUpdate(100);
    scheduleUpdate(500);
    scheduleUpdate(1200);
    scheduleUpdate(2500);
  }

  function start() {
    update();

    const observer = new MutationObserver((mutations) => {
      const hasExternalChanges = mutations.some(mutation => {
        const target = mutation.target;

        const element = target.nodeType === Node.ELEMENT_NODE
          ? target
          : target.parentElement;

        // Änderungen innerhalb unserer eigenen Buttons ignorieren.
        if (element?.closest(`#${TOGGLE_ID}, #${PIP_ID}`)) {
          return false;
        }

        return true;
      });

      if (hasExternalChanges) {
        scheduleUpdate();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"]
    });

    document.addEventListener("yt-navigate-start", handleNavigation);
    document.addEventListener("yt-navigate-finish", handleNavigation);
    document.addEventListener("yt-page-data-updated", handleNavigation);

    window.addEventListener("popstate", handleNavigation);

    // Zusätzliche Erkennung von URL-Wechseln innerhalb YouTubes.
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
