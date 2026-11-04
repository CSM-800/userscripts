// ==UserScript==
// @name         YouTube - Bild im Bild
// @namespace    https://csm-800.local/
// @version      1.0
// @description  Fügt auf YouTube einen Bild-in-Bild-Button hinzu.
// @author       CSM-800, ChatGPT
// @match        https://m.youtube.com/watch*
// @icon         https://www.youtube.com/s/desktop/2253fa3d/img/logos/favicon_144x144.png
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-pip.user.js
// @downloadURL  https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-pip.user.js
// @supportURL   https://github.com/CSM-800/userscripts/issues
// ==/UserScript==

(() => {
  "use strict";

  const STYLE_ID = "csm800-pip-style";
  const PIP_ID = "csm800-pip";

  let updateTimer = null;
  let lastUrl = location.href;

  function isVideoPage() {
    return location.pathname === "/watch" &&
      new URLSearchParams(location.search).has("v");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
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

  async function togglePiP() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }

    const video = document.querySelector("video.html5-main-video");

    if (!video) {
      console.warn("[YouTube PiP] Kein Videoplayer gefunden.");
      return;
    }

    if (
      !document.pictureInPictureEnabled ||
      video.disablePictureInPicture
    ) {
      console.warn(
        "[YouTube PiP] PiP wird für dieses Video nicht unterstützt."
      );
      return;
    }

    try {
      await video.requestPictureInPicture();
    } catch (error) {
      console.error(
        "[YouTube PiP] PiP konnte nicht gestartet werden:",
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
    if (isVideoPage()) {
      installStyle();
      installPiPButton();
    } else {
      const button = document.getElementById(PIP_ID);

      if (button) {
        button.remove();
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

        if (element?.closest(`#${PIP_ID}`)) {
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
