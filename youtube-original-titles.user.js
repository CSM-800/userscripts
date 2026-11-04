// ==UserScript==
// @name         YouTube - Original Titel
// @namespace    https://csm-800.local/
// @version      1.2
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
    'use strict';

    const cache = new Map();
    const queue = [];
    const activeRequests = new Set();

    const MAX_CONCURRENT_REQUESTS = 5;
    const MAX_ITEMS_PER_SCAN = 50;

    let scanTimer = null;
    let lastUrl = location.href;
    let observer = null;

    // --------------------------------------------------
    // Video-ID ermitteln
    // --------------------------------------------------

    function getVideoId(url) {
        if (!url) return null;

        try {
            const parsed = new URL(url, location.origin);

            if (parsed.pathname === '/watch') {
                return parsed.searchParams.get('v');
            }

            const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/);

            if (shortsMatch) {
                return shortsMatch[1];
            }

        } catch (error) {
            return null;
        }

        return null;
    }

    // --------------------------------------------------
    // Originaltitel über YouTube oEmbed abrufen
    // --------------------------------------------------

    function getOriginalTitle(videoId) {
        if (cache.has(videoId)) {
            return cache.get(videoId);
        }

        const promise = new Promise((resolve, reject) => {
            queue.push({
                videoId,
                resolve,
                reject
            });

            processQueue();
        });

        cache.set(videoId, promise);

        promise.catch(() => {
            cache.delete(videoId);
        });

        return promise;
    }

    function processQueue() {
        while (
            activeRequests.size < MAX_CONCURRENT_REQUESTS &&
            queue.length > 0
        ) {
            const request = queue.shift();

            activeRequests.add(request);

            fetchOriginalTitle(request)
                .finally(() => {
                    activeRequests.delete(request);
                    processQueue();
                });
        }
    }

    async function fetchOriginalTitle(request) {
        const { videoId, resolve, reject } = request;

        try {
            const videoUrl =
                `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

            const apiUrl =
                `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`oEmbed HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.title) {
                throw new Error('Kein Videotitel erhalten');
            }

            resolve(data.title);

        } catch (error) {
            console.warn(
                '[YouTube Original Titles] Fehler beim Abrufen eines Videotitels:',
                error
            );

            reject(error);
        }
    }

    // --------------------------------------------------
    // Titel ersetzen
    // --------------------------------------------------

    function replaceTitle(element, originalTitle) {
        if (!element || !originalTitle) return;

        // Bereits korrigierten Titel nicht erneut bearbeiten.
        if (
            element.getAttribute('data-ytot-applied') === originalTitle
        ) {
            return;
        }

        // Ursprünglichen Titel einmalig sichern.
        if (!element.hasAttribute('data-ytot-original')) {
            element.setAttribute(
                'data-ytot-original',
                element.textContent.trim()
            );
        }

        const displayedTitle =
            element.getAttribute('data-ytot-original');

        if (!displayedTitle) return;

        // Element als bearbeitet markieren.
        element.setAttribute('data-ytot-processed', '1');

        const textElement =
            element.querySelector('[role="text"]') ||
            element.querySelector('yt-formatted-string') ||
            element;

        // Text nur ändern, wenn tatsächlich notwendig.
        if (textElement.textContent.trim() !== originalTitle) {
            textElement.textContent = originalTitle;
        }

        // Titelattribute aktualisieren.
        if (element.hasAttribute('title')) {
            element.setAttribute('title', originalTitle);
        }

        const parent = element.parentElement;

        if (parent && parent.hasAttribute('title')) {
            parent.setAttribute('title', originalTitle);
        }

        // aria-label aktualisieren.
        const ariaElements = [
            element,
            parent,
            element.closest('a')
        ].filter(Boolean);

        for (const ariaElement of ariaElements) {
            const ariaLabel =
                ariaElement.getAttribute('aria-label');

            if (!ariaLabel) continue;

            if (ariaLabel.includes(displayedTitle)) {
                ariaElement.setAttribute(
                    'aria-label',
                    ariaLabel.replace(displayedTitle, originalTitle)
                );
            }
        }

        // Bearbeitung abschließen.
        element.setAttribute('data-ytot-applied', originalTitle);

        // Eigene DOM-Änderungen aus der Observer-Warteschlange entfernen.
        observer?.takeRecords();
    }

    // --------------------------------------------------
    // Titel eines Elements verarbeiten
    // --------------------------------------------------

    async function processTitle(element, videoId) {
        if (!element || !videoId) return;

        // Bereits korrekt bearbeitete Elemente überspringen.
        if (element.hasAttribute('data-ytot-applied')) return;

        try {
            const originalTitle = await getOriginalTitle(videoId);

            if (element.isConnected) {
                replaceTitle(element, originalTitle);
            }

        } catch (error) {
            // Fehler wurden bereits beim Abruf behandelt.
        }
    }

    // --------------------------------------------------
    // Video-ID für ein Element finden
    // --------------------------------------------------

    function getElementVideoId(element) {
        if (!element) return null;

        const directLink = element.closest('a[href]');

        if (directLink) {
            const id = getVideoId(directLink.href);
            if (id) return id;
        }

        const container =
            element.closest(
                'ytd-rich-item-renderer, ' +
                'ytd-video-renderer, ' +
                'ytd-grid-video-renderer, ' +
                'ytm-video-with-context-renderer, ' +
                'ytm-compact-video-renderer, ' +
                'ytm-rich-item-renderer'
            ) || element.parentElement;

        if (container) {
            const link = container.querySelector(
                'a[href*="/watch?v="], a[href*="/shorts/"]'
            );

            if (link) {
                return getVideoId(link.href);
            }
        }

        return null;
    }

    // --------------------------------------------------
    // Feed-Titel erkennen
    // --------------------------------------------------

    const CARD_TITLE_SELECTORS = [
        // Desktop Feed
        'h3.ytLockupMetadataViewModelHeadingReset',
        'a.ytLockupMetadataViewModelTitle',

        // Desktop ältere Layouts
        '#video-title',
        'a#video-title',
        'yt-formatted-string#video-title',

        // Desktop weitere Layouts
        'h3[title] > a > span[role="text"]',
        'h3 a span',

        // Mobile Feed
        'h3.media-item-headline',
        '.media-item-headline',

        // Mobile ältere Layouts
        '.compact-media-item-headline',
        '.video-title',
        'ytm-video-meta-block h3'
    ];

    function scanFeed() {
        const elements = document.querySelectorAll(
            CARD_TITLE_SELECTORS.join(',')
        );

        let count = 0;

        for (const element of elements) {
            if (count >= MAX_ITEMS_PER_SCAN) break;

            if (element.hasAttribute('data-ytot-applied')) continue;

            const videoId = getElementVideoId(element);

            if (!videoId) continue;

            processTitle(element, videoId);
            count++;
        }
    }

    // --------------------------------------------------
    // Videoseite erkennen
    // --------------------------------------------------

    const WATCH_TITLE_SELECTORS = [
        // Desktop Videoseite
        'ytd-watch-metadata h1 yt-formatted-string',
        'ytd-watch-metadata h1',
        'ytd-video-primary-info-renderer h1',
        'h1.ytd-watch-metadata',

        // Mobile Videoseite
        'h2.slim-video-information-title .ytAttributedStringHost',
        'h2.slim-video-information-title',

        // Mobile ältere Layouts
        'ytm-slim-video-metadata-section-renderer h1',
        'ytm-video-primary-info-renderer h1',
        'ytm-watch-metadata h1',
        '#title h1',
        'h1.title'
    ];

    function scanWatchPage() {
        const videoId = getVideoId(location.href);

        if (!videoId) return;

        const elements = document.querySelectorAll(
            WATCH_TITLE_SELECTORS.join(',')
        );

        for (const element of elements) {
            if (element.hasAttribute('data-ytot-applied')) continue;

            processTitle(element, videoId);
        }
    }

    // --------------------------------------------------
    // Gesamten Seiteninhalt prüfen
    // --------------------------------------------------

    function scanPage() {
        scanWatchPage();
        scanFeed();
    }

    function scheduleScan(delay = 500) {
        clearTimeout(scanTimer);

        scanTimer = setTimeout(() => {
            scanPage();
        }, delay);
    }

    // --------------------------------------------------
    // YouTube Navigation erkennen
    // --------------------------------------------------

    document.addEventListener('yt-navigate-finish', () => {
        scheduleScan(300);
    });

    document.addEventListener('yt-page-data-updated', () => {
        scheduleScan(300);
    });

    window.addEventListener('popstate', () => {
        scheduleScan(300);
    });

    // --------------------------------------------------
    // Änderungen am Seiteninhalt erkennen
    // --------------------------------------------------

    observer = new MutationObserver((mutations) => {
        // Nur Änderungen berücksichtigen, die nicht innerhalb
        // bereits bearbeiteter Titel stattfinden.
        const relevantChange = mutations.some((mutation) => {
            const target = mutation.target;

            const element =
                target.nodeType === Node.ELEMENT_NODE
                    ? target
                    : target.parentElement;

            if (
                element &&
                element.closest('[data-ytot-processed="1"]')
            ) {
                return false;
            }

            return true;
        });

        if (relevantChange) {
            scheduleScan(500);
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // --------------------------------------------------
    // URL-Überwachung
    // --------------------------------------------------

    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            scheduleScan(300);
        }
    }, 1000);

    // --------------------------------------------------
    // Initialer Start
    // --------------------------------------------------

    scheduleScan(500);

})();
