// ==UserScript==
// @name         Test
// @namespace    https://csm-800.local/
// @version      v1.1
// @description  Test
// @author       CSM-800, ChatGPT
// @match        https://www.reddit.com/*
// @icon         https://www.redditstatic.com/shreddit/assets/favicon/192x192.png
// @grant        none
// @run-at       document-start
// @updateURL    https://github.com/CSM-800/userscripts/raw/refs/heads/main/test.user.js
// @downloadURL  https://github.com/CSM-800/userscripts/raw/refs/heads/main/test.user.js
// @supportURL   https://github.com/CSM-800/userscripts/issues
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
