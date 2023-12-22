// ==UserScript==
// @name         Monarch Money (Chart)
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Monarch Money (Chart)
// @author       William T. Wissemann
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js
// ==/UserScript==

const graphql = 'https://api.monarchmoney.com/graphql';
const START_DATE = '2010-01-01';

function getPersistReports() {
    return JSON.parse(JSON.parse(localStorage.getItem("persist:reports")).filters);
}
function getGraphqlToken() {
    return JSON.parse(JSON.parse(localStorage.getItem("persist:root")).user).token;
}
function createGraphOption(data) {
    return {
        method: 'POST',
        headers: {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            authorization: `Token ${getGraphqlToken()}`,
            'client-platform': 'web',
            'content-type': 'application/json',
            origin: 'https://app.monarchmoney.com',
            // 'sec-ch-ua': '"Brave";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'user-agent': navigator.userAgent,
        },
        body: JSON.stringify(data),
    };
}
async function getAccountDetails() {
    const options = createGraphOption({
        "operationName": "Web_GetAccountsPage",
        "variables": {},
        "query": "query Web_GetAccountsPage {\n  hasAccounts\n  accountTypeSummaries {\n    type {\n      name\n      display\n      group\n      __typename\n    }\n    accounts {\n      id\n      ...AccountsListFields\n      __typename\n    }\n    totalDisplayBalance\n    __typename\n  }\n  householdPreferences {\n    id\n    accountGroupOrder\n    __typename\n  }\n}\n\nfragment AccountsListFields on Account {\n  id\n  syncDisabled\n  isHidden\n  isAsset\n  includeInNetWorth\n  order\n  type {\n    name\n    display\n    __typename\n  }\n  ...AccountListItemFields\n  __typename\n}\n\nfragment AccountListItemFields on Account {\n  id\n  displayName\n  displayBalance\n  signedBalance\n  updatedAt\n  syncDisabled\n  icon\n  logoUrl\n  isHidden\n  isAsset\n  includeInNetWorth\n  includeBalanceInNetWorth\n  displayLastUpdatedAt\n  ...AccountMaskFields\n  credential {\n    id\n    updateRequired\n    dataProvider\n    disconnectedFromDataProviderAt\n    __typename\n  }\n  institution {\n    id\n    ...InstitutionStatusTooltipFields\n    __typename\n  }\n  __typename\n}\n\nfragment AccountMaskFields on Account {\n  id\n  mask\n  subtype {\n    display\n    __typename\n  }\n  __typename\n}\n\nfragment InstitutionStatusTooltipFields on Institution {\n  id\n  logo\n  name\n  status\n  plaidStatus\n  hasIssuesReported\n  url\n  hasIssuesReportedMessage\n  transactionsStatus\n  balanceStatus\n  __typename\n}"
    });
    return await fetch(graphql, options)
        .then((response) => response.json())
        .then((data) => {
        const accountDetails = data.data.accountTypeSummaries;
        const accountLookupById = {}
        for (let i = 0; i < accountDetails.length; i++) {
            const display = accountDetails[i].type.display;
            for (let j = 0; j < accountDetails[i].accounts.length; j++) {
                accountLookupById[accountDetails[i].accounts[j].id] = {
                    type: display,
                    displayName: accountDetails[i].accounts[j].displayName,
                }
            }
        }
        data.accountLookupById = accountLookupById;
        return data;
    }).catch((error) => {
        console.error(error);
    });
}
async function getAccountPageRecentBalanceByDate(date) {
    return await fetch(graphql, createGraphOption({
        operationName: 'Web_GetAccountsPageRecentBalance',
        variables: {
            startDate: date
        },
        query: `query Web_GetAccountsPageRecentBalance($startDate: Date!) {
            accounts {
                id
                recentBalances(startDate: $startDate)
                __typename
            }
        }`,
    }))
        .then((response) => response.json())
        .then((data) => {
        return data;
    }).catch((error) => {
        console.error(error);
    });
}
async function getAccountPageRecentBalance() {
    if (localStorage["tm:AccountPageRecentBalance"] === undefined) {
        const data = await getAccountPageRecentBalanceByDate(START_DATE)
        localStorage["tm:AccountPageRecentBalance"] = JSON.stringify({"cacheDate": new Date().toISOString().slice(0, 10), "data": data});
        return data;
    } else {
        let {cacheDate, data} = JSON.parse(localStorage["tm:AccountPageRecentBalance"]);
        if (cacheDate !== new Date().toISOString().slice(0, 10)) {
            const data = await getAccountPageRecentBalanceByDate(START_DATE)
            localStorage["tm:AccountPageRecentBalance"] = JSON.stringify({"cacheDate": new Date().toISOString().slice(0, 10), "data": data});
            return data;
        }
        return data;
    }
}

function recentBalancesMerge(data, label) {
    let offset = 0;
    const date = new Date(START_DATE);
    var dataset = {
        label: label,
        data: data[0].recentBalances.map(item => {
            offset+=1;
            let d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
            return {x: d.toISOString().slice(0, 10) , y: item};
        }),
        borderWidth: 1,
        fill: true,
        pointRadius: 0,
        hidden: !["Net Worth", "Investments", "Cash"].includes(label)
    }
    for (let i = 1; i < data.length; i++) {
        for (let j = 0; j < data[i].recentBalances.length; j++) {
            const val = data[i].recentBalances[j];
            if (val != null) {
                dataset.data[j].y += val;
            }
        }
    }
    return dataset
}

function chartStyleOption() {
    Chart.defaults.color = "rgba(255, 255, 255, 0.7)";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.3)";

    return {
        legend: {
            labels: {
                fontColor: 'rgba(255, 255, 255, 0.7)'
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'year'
                },
                title: {
                    display: true,
                    text: 'Date'
                },
                border: {
                    dash: [5,8],
                },
            },
            y: {
                ticks: {
                    beginAtZero: true
                },
                border: {
                    dash: [5,8],
                },
            }
        }
    }
}

function drawSnapshotsByAccountType(chart) {
    fetch(graphql, createGraphOption({
        operationName: 'Common_GetSnapshotsByAccountType',
        variables: {
            startDate: START_DATE,
            timeframe:  'month',
        },
        query: `query Common_GetSnapshotsByAccountType($startDate: Date!, $timeframe: Timeframe!) {
                    snapshotsByAccountType(startDate: $startDate, timeframe: $timeframe) {
                        accountType
                        month
                        balance
                        __typename
                    }
                    accountTypes {
                        name
                        display
                        group
                        __typename
                    }
                }`,
        })).then(response => response.json())
            .then(d => {
            // Process the data received from the API
            const data = d.data;
            // Get all account types and their groups
            const accountTypes = data.accountTypes;

            const datasets = [];
            for (let i = 0; i < data.accountTypes.length; i++) {
                // User selects an account type
                const selectedAccountType = data.accountTypes[i].name;
                const selectedAccountDisplay = data.accountTypes[i].display;
                if (selectedAccountDisplay === "Other") {
                    continue;
                }
                // Filter snapshots by selected account type
                const filteredSnapshots = data.snapshotsByAccountType.filter(snapshot => snapshot.accountType === selectedAccountType);
                // Extract relevant data from filtered snapshots
                // const balances = filteredSnapshots.map(snapshot => snapshot.balance);
                const balances = filteredSnapshots.map(snapshot => {
                    const date = snapshot.month;
                    return {x: date, y: snapshot.balance};
                });
                const set = {
                    label: selectedAccountDisplay,
                    data: balances,
                    borderWidth: 2,
                    pointRadius: 0,
                    hidden: !["brokerage", "depository"].includes(selectedAccountType)
                }
                datasets.push(set);
            }
            // Create a new Chart.js instance
            const ctx = chart.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    datasets,
                },
                options: chartStyleOption()
            });
        })
            .catch((error) => {
            console.error(error);
        });
}


function drawNetworthChart(chart) {
    var persist_filters = getPersistReports();
    getAccountDetails().then((accountDetails) => {
        getAccountPageRecentBalance()
            .then(d => {
            // Process the data received from the API
            let data = null;
             if (persist_filters.accounts !== undefined) {
                 data = d.data.accounts.filter(oblengthject => persist_filters.accounts.includes(object.id));
             } else {
                 data = d.data.accounts
             }

            const accountTypes = []
            for (let i = 0; i < data.length; i++) {
                if (accountDetails.accountLookupById[data[i].id] !== undefined) {
                    let {displayName, type} = accountDetails.accountLookupById[data[i].id]
                    data[i].displayName = displayName;
                    data[i].type = type;
                    if (!accountTypes.includes(type)) {
                       accountTypes.push(type);
                    }
                }
            }

            const datasets = []

            datasets.push(recentBalancesMerge(data, "Net Worth"));
            for (let i = 0; i < accountTypes.length; i++) {
                datasets.push(recentBalancesMerge(data.filter(object => [accountTypes[i]].includes(object.type)), accountTypes[i]));
            }

            for (let i = 0; i < datasets.length; i++) {
               datasets[i].data = datasets[i].data.filter(dataset => dataset.y !== 0 && dataset.y !== null);
            }
            // Create a new Chart.js instance
            const ctx = chart.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    datasets,
                },
                options: chartStyleOption()
            });
        }).catch((error) => {
            console.error(error);
        });
    });
}


(function() {
    'use strict';

    setInterval(() => {
        if (window.location.pathname=="/dashboard" && document.querySelectorAll("[class*=TM_CHARTS]").length == 0) {
            const injection_interval = setInterval(() => {
                // only run the injection_interval once
                clearInterval(injection_interval);
                // inject a div at the top of MM's scroll
                const scroll_root = document.querySelectorAll("[class*=Scroll__Root]")[0]

                const chart_div = document.createElement("div");
                chart_div.className = "TM_CHARTS";
                chart_div.style.margin = "auto";
                chart_div.style.width = "95%";
                chart_div.style.height = "95%";
                chart_div.style.padding = "20px 0px 0px 0px";
                chart_div.boxShadow = "rgba(0, 0, 0, 0.2) 0px 4px 8px"
                const snapshotsByAccountType = document.createElement("canvas");
                snapshotsByAccountType.style.borderRadius = "25px";
                snapshotsByAccountType.style.padding = "0px 20px 0px 0px";
                snapshotsByAccountType.style.backgroundColor = "rgb(13, 44, 92)";
                snapshotsByAccountType.style.width = "100%";
                snapshotsByAccountType.style.display = "block";
                snapshotsByAccountType.className = "TM_snapshotsByAccountType";
                chart_div.appendChild(snapshotsByAccountType);

                scroll_root.insertBefore(chart_div, scroll_root.children[0])

                const chart_div_2 = document.createElement("div");
                chart_div_2.className = "TM_CHARTS";
                chart_div_2.style.margin = "auto";
                chart_div_2.style.width = "95%";
                chart_div_2.style.height = "95%";
                chart_div_2.style.padding = "10px 0px 0px 0px";
                chart_div_2.boxShadow = "rgba(0, 0, 0, 0.2) 0px 4px 8px"

                const networthChart = document.createElement("canvas");
                networthChart.style.borderRadius = "25px";
                networthChart.style.padding = "0px 20px 0px 0px";
                networthChart.style.backgroundColor = "rgb(13, 44, 92)";
                networthChart.style.width = "100%";
                networthChart.style.display = "block";
                networthChart.className = "TM_networthChart";
                chart_div_2.appendChild(networthChart);

                scroll_root.insertBefore(chart_div_2, scroll_root.children[1])

                drawSnapshotsByAccountType(snapshotsByAccountType);
                drawNetworthChart(networthChart);
            }, 1000);
        }
    }, 5000);
})();
