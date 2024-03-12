// ==UserScript==
// @name         Monarch Money (Charts)
// @namespace    http://tampermonkey.net/
// @version      0.15
// @description  Monarch Money (Charts)
// @author       William T. Wissemann
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js
// @require      https://cdn.jsdelivr.net/npm/hammerjs@2.0.8
// @require      https://cdn.jsdelivr.net/npm/chartjs-plugin-crosshair@2.0.0/dist/chartjs-plugin-crosshair.min.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js
// ==/UserScript==

const graphql = 'https://api.monarchmoney.com/graphql';
const START_DATE = '2010-01-01';

function accountTypeToColor(accountType, alpha) {
  const lookup = {
    'Net Worth': `rgba(55, 162, 235, ${alpha})`, // blue
    'Credit Cards': `rgba(255, 159, 65, ${alpha})`, // orange
    Loans: `rgba(255, 99, 132, ${alpha})`, // red
    Investments: `rgba(255, 205, 87, ${alpha})`, // yellow
    Cash: `rgba(76, 192, 192, ${alpha})`, // green
    'Real Estate': `rgba(153, 102, 255, ${alpha})`, // purple
    Valuables: `rgba(201, 203, 207, ${alpha})`, // gray
    Vehicles: `rgba(55, 162, 235, ${alpha})`, // blue
  };

  return lookup[accountType];
}

function getPersistReports() {
  return JSON.parse(JSON.parse(localStorage.getItem('persist:reports')).filters);
}

function getStyle() {
  const cssObj = window.getComputedStyle(document.querySelectorAll('[class*=Page__Root]')[0], null);
  const bgColor = cssObj.getPropertyValue('background-color');
  if (bgColor === 'rgb(8, 32, 67)') {
    return 'dark';
  }
  return 'light';
}

function getGraphqlToken() {
  return JSON.parse(JSON.parse(localStorage.getItem('persist:root')).user).token;
}
function createGraphOption(data) {
  return {
    mode: 'cors',
    method: 'POST',
    headers: {
      accept: '*/*',
      authorization: `Token ${getGraphqlToken()}`,
      'content-type': 'application/json',
      origin: 'https://app.monarchmoney.com',
    },
    body: JSON.stringify(data),
  };
}
async function getAccountDetails() {
  const options = createGraphOption({
    operationName: 'Web_GetAccountsPage',
    variables: {},
    query: 'query Web_GetAccountsPage {\n  hasAccounts\n  accountTypeSummaries {\n    type {\n      name\n      display\n      group\n      __typename\n    }\n    accounts {\n      id\n      ...AccountsListFields\n      __typename\n    }\n    totalDisplayBalance\n    __typename\n  }\n  householdPreferences {\n    id\n    accountGroupOrder\n    __typename\n  }\n}\n\nfragment AccountsListFields on Account {\n  id\n  syncDisabled\n  isHidden\n  isAsset\n  includeInNetWorth\n  order\n  type {\n    name\n    display\n    __typename\n  }\n  ...AccountListItemFields\n  __typename\n}\n\nfragment AccountListItemFields on Account {\n  id\n  displayName\n  displayBalance\n  signedBalance\n  updatedAt\n  syncDisabled\n  icon\n  logoUrl\n  isHidden\n  isAsset\n  includeInNetWorth\n  includeBalanceInNetWorth\n  displayLastUpdatedAt\n  ...AccountMaskFields\n  credential {\n    id\n    updateRequired\n    dataProvider\n    disconnectedFromDataProviderAt\n    __typename\n  }\n  institution {\n    id\n    ...InstitutionStatusTooltipFields\n    __typename\n  }\n  __typename\n}\n\nfragment AccountMaskFields on Account {\n  id\n  mask\n  subtype {\n    display\n    __typename\n  }\n  __typename\n}\n\nfragment InstitutionStatusTooltipFields on Institution {\n  id\n  logo\n  name\n  status\n  plaidStatus\n  hasIssuesReported\n  url\n  hasIssuesReportedMessage\n  transactionsStatus\n  balanceStatus\n  __typename\n}',
  });
  return fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      const accountDetails = data.data.accountTypeSummaries;
      const accountLookupById = {};
      for (let i = 0; i < accountDetails.length; i += 1) {
        const { display } = accountDetails[i].type;
        for (let j = 0; j < accountDetails[i].accounts.length; j += 1) {
          accountLookupById[accountDetails[i].accounts[j].id] = {
            type: display,
            displayName: accountDetails[i].accounts[j].displayName,
            accountData: accountDetails[i].accounts[j],
          };
        }
      }
      data.accountLookupById = accountLookupById;
      return data;
    }).catch((error) => {
      console.error(error);
    });
}
async function getAccountPageRecentBalanceByDate(date) {
  return fetch(graphql, createGraphOption({
    operationName: 'Web_GetAccountsPageRecentBalance',
    variables: {
      startDate: date,
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
    .then((data) => data).catch((error) => {
      console.error(error);
    });
}

async function getAccountPageRecentBalance() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const cachedData = JSON.parse(localStorage?.getItem('tm:AccountPageRecentBalance') ?? '{}');

    if (
      !cachedData.cacheDate ||
      cachedData.cacheDate !== today ||
      !cachedData.data ||
      !cachedData.data.data ||
      !cachedData.data.data.accounts ||
      !Array.isArray(cachedData.data.data.accounts[0]?.recentBalances) ||
      cachedData.data.data.accounts[0].recentBalances.length !==
        (new Date(today).getTime() - new Date(START_DATE).getTime()) / (1000 * 3600 * 24) + 1
    ) {
      const freshData = await getAccountPageRecentBalanceByDate(START_DATE);
      localStorage.setItem('tm:AccountPageRecentBalance', JSON.stringify({ cacheDate: today, data: freshData }));
      return freshData;
    }

    return cachedData.data;
  } catch (error) {
    console.error('Error handling cached data:', error);
    const freshData = await getAccountPageRecentBalanceByDate(START_DATE);
    localStorage.setItem('tm:AccountPageRecentBalance', JSON.stringify({ cacheDate: today, data: freshData }));
    return freshData;
  }
}

function recentBalancesMerge(data, label) {
  let offset = 0;
  const date = new Date(START_DATE);
  const dataset = {
    label,
    data: data[0].recentBalances.map((item) => {
      offset += 1;
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
      return { x: d.toISOString().slice(0, 10), y: item };
    }),
    borderColor: accountTypeToColor(label, '255'),
    backgroundColor: accountTypeToColor(label, '0.2'),
    borderWidth: 1,
    fill: true,
    pointRadius: 0,
    hidden: !['Net Worth', 'Investments', 'Cash'].includes(label),
  };
  for (let i = 1; i < data.length; i += 1) {
    for (let j = 0; j < data[i].recentBalances.length; j += 1) {
      const val = data[i].recentBalances[j];
      if (dataset.data[j].y === undefined) {
        dataset.data[j].y = val;
      } else if (val !== null) {
        dataset.data[j].y += val;
      }
    }
  }
  return dataset;
}

function chartStyleOption(title) {
  let labels = {
    fontColor: 'rgba(256, 256, 256)',
  };
  if (getStyle() === 'dark') {
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.3)';
    labels = {};
  } else {
    Chart.defaults.color = 'rgba(0, 0, 0, 0.7)';
    Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.2)';
    labels = {};
  }

  return {
    maintainAspectRatio: false,
    responsive: true,
    resizeDelay: 1000,

    legend: {
      labels,
    },
    interaction: {
      axis: 'x',
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      crosshair: {
        line: {
          color: 'rgba(55, 162, 235, .5)', // crosshair line color
          width: 1, // crosshair line width
        },
      },
      tooltip: {
        position: 'nearest',
        backgroundColor: 'rgba(0, 0, 0, .65)',
        callbacks: {
          label(context) {
            let label = context.dataset.label || '';

            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
            }
            return label;
          },
          title(context) {
            const label = context[0].label || '';
            return label.match(/^\w+ \d+, \d+/)[0];
          },
        },
      },
      title: {
        display: true,
        text: title,
      },
      zoom: {
        limits: {
          x: { min: 'original', max: 'original' },
        },
        zoom: {
          wheel: {
            enabled: true,
            modifierKey: 'shift',
          },
          drag: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'year',
        },
        border: {
          dash: [5, 8],
        },
      },
      y: {
        ticks: {
          beginAtZero: true,
        },
        border: {
          dash: [5, 8],
        },
      },
    },
  };
}

function drawSnapshotsByAccountType(chart) {
  fetch(graphql, createGraphOption({
    operationName: 'Common_GetSnapshotsByAccountType',
    variables: {
      startDate: START_DATE,
      timeframe: 'month',
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
  })).then((response) => response.json())
    .then((d) => {
      // Process the data received from the API
      const { data } = d;

      const datasets = [{
        label: 'Net Worth',
        borderColor: accountTypeToColor('Net Worth', '255'),
        backgroundColor: accountTypeToColor('Net Worth', '0.2'),
        data: [],
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        hidden: false,
      }];
      const netWorth = {};
      for (let i = 0; i < data.accountTypes.length; i += 1) {
        // User selects an account type
        const selectedAccountType = data.accountTypes[i].name;
        const selectedAccountDisplay = data.accountTypes[i].display;

        if (selectedAccountDisplay === 'Other') {
          continue;
        }

        // Filter snapshots by selected account type
        const filteredSnapshots = data.snapshotsByAccountType.filter(
          (snapshot) => snapshot.accountType === selectedAccountType,
        );
        // Extract relevant data from filtered snapshots
        // const balances = filteredSnapshots.map(snapshot => snapshot.balance);
        const balances = filteredSnapshots.map((snapshot) => {
          const date = snapshot.month;
          if (netWorth[date] !== undefined) {
            netWorth[date].y += snapshot.balance;
          } else {
            netWorth[date] = { x: date, y: snapshot.balance };
          }
          return { x: date, y: snapshot.balance };
        });

        const set = {
          label: selectedAccountDisplay,
          data: balances,
          borderColor: accountTypeToColor(selectedAccountDisplay, '255'),
          backgroundColor: accountTypeToColor(selectedAccountDisplay, '0.2'),
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          hidden: !['brokerage', 'depository'].includes(selectedAccountType),
        };
        if (set.data.length > 0) {
          datasets.push(set);
        }
      }

      Object.values(netWorth).forEach((value) => {
        datasets[0].data.push(value);
      });

      datasets[0].data.sort((a, b) => a.x.localeCompare(b.x));

      // Create a new Chart.js instance
      const ctx = chart.getContext('2d');
      // eslint-disable-next-line no-new
      new Chart(ctx, {
        type: 'line',
        data: {
          datasets,
        },
        options: chartStyleOption('ACCOUNT TRENDS: WITHOUT FILTERS'),
      });
    })
    .catch((error) => {
      console.error(error);
    });
}

function drawNetworthChart(chart) {
  const persistFilters = getPersistReports();
  getAccountDetails().then((accountDetails) => {
    getAccountPageRecentBalance()
      .then((d) => {
        // Process the data received from the API
        let data = null;
        if (persistFilters.accounts !== undefined) {
          data = d.data.accounts.filter((object) => persistFilters.accounts.includes(object.id));
        } else {
          data = d.data.accounts;
        }

        const accountTypes = [];
        for (let i = 0; i < data.length; i += 1) {
          if (accountDetails.accountLookupById[data[i].id] !== undefined) {
            const { displayName, type, accountData } = accountDetails.accountLookupById[data[i].id];
            data[i].displayName = displayName;
            data[i].type = type;
            data[i].includeInNetWorth = accountData.includeInNetWorth;

            if (!accountTypes.includes(type)) {
              accountTypes.push(type);
            }
          }
        }

        data = data.filter((object) => object.includeInNetWorth === true);

        const datasets = [];
        datasets.push(recentBalancesMerge(data, 'Net Worth'));
        for (let i = 0; i < accountTypes.length; i += 1) {
          datasets.push(recentBalancesMerge(data.filter((object) => [accountTypes[i]].includes(object.type)), accountTypes[i]));
        }

        for (let i = 0; i < datasets.length; i += 1) {
          datasets[i].data = datasets[i].data.filter((dataset) => dataset.y !== 0 && dataset.y !== null);
        }
        // Create a new Chart.js instance
        const ctx = chart.getContext('2d');
        // eslint-disable-next-line no-new
        new Chart(ctx, {
          type: 'line',
          data: {
            datasets,
          },
          options: chartStyleOption('ACCOUNT TRENDS: REPORT FILTERS'),
        });
      }).catch((error) => {
        console.error(error);
      });
  });
}

function createChartDiv(claseName) {
  const chartDiv = document.createElement('div');
  chartDiv.className = 'TM_CHARTS';
  chartDiv.width = '100%';
  chartDiv.height = '400px';
  chartDiv.margin = 'auto';
  chartDiv.style.width = chartDiv.width;
  chartDiv.style.height = chartDiv.height;
  chartDiv.style.padding = '22px 22px 0px 20px';
  chartDiv.boxShadow = 'rgba(0, 0, 0, 0.2) 0px 4px 8px';

  const canvas = document.createElement('canvas');
  canvas.style.borderRadius = '25px';
  canvas.width = '100%';
  canvas.height = '400px';
  canvas.style.padding = '0px 10px 0px 0px';
  if (getStyle() === 'dark') {
    canvas.style.backgroundColor = 'rgb(13, 44, 92)';
  } else {
    canvas.style.backgroundColor = 'rgb(255, 255, 255)';
  }
  canvas.style.width = canvas.width;
  canvas.style.height = canvas.height;
  canvas.style.display = 'block';
  canvas.className = claseName;
  chartDiv.appendChild(canvas);
  return [canvas, chartDiv];
}

(function () {
  setInterval(() => {
    if (window.location.pathname === '/dashboard' && (document.querySelectorAll('[class*=TM_CHARTS]').length === 0 || localStorage['tm:DarkLightMode'] !== getStyle())) {
      const injectionInterval = setInterval(() => {
        const tmCharts = document.querySelectorAll('[class*=TM_CHARTS]');
        if (tmCharts.length > 0 && localStorage['tm:DarkLightMode'] !== getStyle()) {
          for (let i = 0; i < tmCharts.length; i += 1) {
            tmCharts[i].remove();
          }
        }
        // only run the injectionInterval once
        clearInterval(injectionInterval);
        // inject a div at the top of MM's scroll
        const scrollRoot = document.querySelectorAll('[class*=Scroll__Root]')[0];

        const [snapshotsByAccountCanvas, snapshotsByAccountDiv] = createChartDiv('TM_snapshotsByAccountType');
        scrollRoot.insertBefore(snapshotsByAccountDiv, scrollRoot.children[0]);
        drawSnapshotsByAccountType(snapshotsByAccountCanvas);

        const [networthCanvas, networthAccountDiv] = createChartDiv('TM_networthChart');
        scrollRoot.insertBefore(networthAccountDiv, scrollRoot.children[1]);
        drawNetworthChart(networthCanvas);

        localStorage['tm:DarkLightMode'] = getStyle();
      }, 1000);
    }
  }, 5000);
}());
