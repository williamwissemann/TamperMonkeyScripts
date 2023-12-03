// ==UserScript==
// @name         Monarch Money (hides chart lines)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hides chart lines
// @author       You
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
   setInterval(() => {
     const selectors = ["[class*=AccountNetWorthChart__Root] [class~=recharts-line-curve]",
                        "[class*=CashFlowBarChart__Root] [class~=recharts-line-curve]"];

    for (const selector of selectors) {
        const lineElements = document.querySelectorAll(selector);
        for (const lineElement of lineElements) {
         lineElement.style.strokeWidth = "0";
        }
    }
  }, 3000);
})();


