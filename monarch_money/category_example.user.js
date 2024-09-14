// ==UserScript==
// @name         Monarch Money (grab category and category group data)
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Additional trend charts added to Monarch Money's dashboard page.
// @author       William T. Wissemann
// @match        https://app.monarchmoney.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=monarchmoney.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

const graphql = 'https://api.monarchmoney.com/graphql';

function getGraphqlToken() {
  return JSON.parse(JSON.parse(localStorage.getItem('persist:root')).user).token;
}

function callGraphQL(data) {
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

async function getCategoryData() {
  const options = callGraphQL({
    operationName: 'GetCategorySelectOptions',
    variables: {},
    query: "query GetCategorySelectOptions {\n  categoryGroups {\n    id\n    name\n    order\n    type\n    groupLevelBudgetingEnabled\n    categories {\n      id\n      name\n      order\n      icon\n      __typename\n    }\n    __typename\n  }\n  categories {\n    id\n    name\n    order\n    icon\n    group {\n      id\n      type\n      __typename\n    }\n    __typename\n  }\n}"
  });

  return fetch(graphql, options)
    .then((response) => response.json())
    .then((data) => {
      return data.data;
    }).catch((error) => {
      console.error(error);
    });
}

async function doSomethingWithCategoryData(){
    const categoryData = await getCategoryData();
    console.log(categoryData);

    // loop through catagory data
    for (let i = 0; i < categoryData.categories.length; i += 1) {
       console.log(`categories: ${i} ${categoryData.categories[i].name} ${categoryData.categories[i].id} ${JSON.stringify(categoryData.categories[i])}`)
    }

    // loop through catagory group
    for (let i = 0; i < categoryData.categoryGroups.length; i += 1) {
       console.log(`category group: ${i} ${categoryData.categoryGroups[i].name} ${categoryData.categoryGroups[i].id} ${JSON.stringify(categoryData.categoryGroups[i])}` )
    }

}

(function () {
  const injectionInterval = setInterval(() => {
    // only run the injectionInterval once
    clearInterval(injectionInterval);
    // inject a div at the top of MM's scroll
    doSomethingWithCategoryData();
  }, 1000);
}());
