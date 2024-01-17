// ==UserScript==
// @name         Monarch Money (clean up nav)
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Hides chart lines
// @author       You
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    setInterval(() => {
        // removes the extra items from the nav bar
        const remove_list = ["[href~='/advice']","[href~='/settings/referrals']"];
        for (const selector of remove_list) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                el.remove();
            }
        }
    }, 3000);
})();
