// ==UserScript==
// @name         Reddit - Originalbeitrag
// @namespace    https://csm-800.local/
// @version      v1.0
// @description  Entfernt automatisch den Sprachparameter tl von Reddit-URLs, damit Originalbeiträge angezeigt werden.
// @author       CSM-800, ChatGPT
// @match        https://www.reddit.com/*
// @icon         https://www.redditstatic.com/shreddit/assets/favicon/192x192.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const url = new URL(window.location.href);

    // Prüfen, ob Reddit eine Übersetzung erzwingt.
    if (!url.searchParams.has('tl')) {
        return;
    }

    // Nur den Übersetzungsparameter entfernen.
    url.searchParams.delete('tl');

    // Zur Originalseite wechseln.
    window.location.replace(url.href);
})();
