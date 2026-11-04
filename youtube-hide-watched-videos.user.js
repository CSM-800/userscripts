// ==UserScript==
// @name         YouTube - Hide Watched Videos
// @namespace    https://csm-800.local/
// @version      1.0
// @description  Blendet bereits angesehene Videos im Abonnement-Feed aus.
// @author       CSM-800, ChatGPT
// @match        https://m.youtube.com/feed/subscriptions*
// @icon         https://www.youtube.com/s/desktop/2253fa3d/img/logos/favicon_144x144.png
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-hide-watched-videos.user.js
// @updateURL    https://raw.githubusercontent.com/CSM-800/userscripts/main/youtube-hide-watched-videos.user.js
// @supportURL   https://github.com/CSM-800/userscripts/issues
// ==/UserScript==

(() => {
  "use strict";

  const STYLE_ID = "csm800-hide-watched-style";
  const TOGGLE_ID = "csm800-hide-watched-toggle";
  const HIDE_CLASS = "csm800-hidden";
  const HIDE_THRESHOLD = 10;

  let hideWatched = true;
  let updateTimer = null;
  let lastUrl = location.href;

  function isSubscriptionsPage() {
    return location.pathname.startsWith("/feed/subscriptions");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      ytm-rich-item-renderer.${HIDE_CLASS} {
        display: none !important;
      }

      #${TOGGLE_ID} {
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

      #${TOGGLE_ID}:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
        border-radius: 6px;
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

    toggle.setAttribute("aria-checked", String(hideWatched));
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

  function update() {
    if (!isSubscriptionsPage()) {
      const toggle = document.getElementById(TOGGLE_ID);

      if (toggle) {
        toggle.remove();
      }

      restoreCards();
      return;
    }

    installStyle();
    installToggle();
    processCards();
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

        // Änderungen innerhalb unseres eigenen Buttons ignorieren.
        if (element?.closest(`#${TOGGLE_ID}`)) {
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
