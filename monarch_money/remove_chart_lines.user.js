// ==UserScript==
// @name         Monarch Money (hides chart lines)
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Hides chart lines
// @author       You
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    setInterval(() => {
        // removes the trend line from the graph
        const selectors = ["[class*=AccountNetWorthChart__Root] [class~=recharts-line-curve]",
                           "[class*=AccountNetWorthCharts__Root] [class~=recharts-line] [stroke-width]",
                           "[class*=CashFlowBarChart__Root] [class~=recharts-line-curve]"];
        for (const selector of selectors) {
            const lineElements = document.querySelectorAll(selector);
            for (const lineElement of lineElements) {
                lineElement.style.strokeWidth = "0";
            }
        }

        // flatten gradient fill
        const fill = ["[class*=AccountNetWorthCharts__Root] [fill*='url(#area0)']"];
        for (const selector of fill) {
            const lineElements = document.querySelectorAll(selector);
            for (const lineElement of lineElements) {
                lineElement.style.fill = "rgba(255, 255, 255, .5)";
            }
        }
    }, 3000);
})();
