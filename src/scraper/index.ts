import { parentPort } from "worker_threads";
import puppeteer, { Page, Browser, ElementHandle } from "puppeteer";
import { createCounties, createCourts, createCases } from "../utils/scraper_data_parser.js";
import { initialRunChecker, updateInitialRunValue } from "../utils/initial_run_checker.js";

const viewPortConfig = {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1
};

const createBrowserWindow = async (): Promise<Browser | null> => {
    try {
        const browserInstance = await puppeteer.launch({ headless: false });
        return browserInstance;
    } catch (error) {
        console.log(`Failed to create browser window : ${error}`);
        return null;
    }
}

const createNewPage = async (browserInstance: Browser | null): Promise<Page | null> => {
    if (browserInstance === null) {
        return null;
    }

    const newPage = await browserInstance.newPage();
    await newPage.setViewport(viewPortConfig);
    return newPage;
}

const closePage = async (page: Page): Promise<void> => {
    try {
        if (page) {
            await page.close();
        }
    } catch (error) {
        console.log(`Failed to close page : ${error}`);
    }
}

const navigeToPage = async (page: Page, link: string) => {
    await page.goto(link, { waitUntil: "networkidle2" });
}

const waitForSelectors = async (page: Page, selectors: string | string[]) => {
    // Normalize selectors to be an array
    const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
    console.log('---------------------');
    console.log(`Selectors are : ${selectorsArray}`);

    // Wait for all selectors
    try {
        await Promise.all(
            selectorsArray.map(async (selector) => {
                await page.waitForSelector(selector, { timeout: 60000 });
                console.log(`Selector "${selector}" is now available.`);
            })
        );

        return " ";
    } catch (err) {
        console.log(`Error waiting for selectors: ${err}`);
        return null;
    }
}

const waitForSelectorsAndEvaluatePage = async (page: Page, selectors: string | string[], evaluateFn: (page: Page, ...args: any) => Promise<any>, ...args: any[]) => {
    // Normalize selectors to be an array
    const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
    console.log(`Selectors are : ${selectorsArray}`);

    // Wait for all selectors
    try {
        await Promise.all(
            selectorsArray.map(async (selector) => {
                await page.waitForSelector(selector, { timeout: 60000 });
                console.log(`Selector "${selector}" is now available.`);
            })
        );
    } catch (err) {
        console.log(`Error waiting for selectors: ${err}`);
        return null;
    }

    // Evaluate the provided function on the page
    try {
        const result = await evaluateFn(page, args);
        return result;
    } catch (err) {
        console.log(`Error evaluating function on page: ${err}`);
        return null;
    }
}

const scrapeCases = async (): Promise<void> => {
    console.log("Scraping service started ... ");
    const initialRun = await initialRunChecker();

    if (initialRun) {
        let browser = await createBrowserWindow();
        if (!browser) {
            console.log(`Browser not defined`);
            return;
        }

        let page = await createNewPage(browser);
        if (!page) {
            console.log(`Page not defined`);
            return;
        }

        await navigeToPage(page, "https://www.kenyalaw.org/caselaw");

        const evaluateInitialRunStartPage = async (page: Page) => {
            const courtTypeLinks = await page.evaluate(() => {
                const linksAndCourtTypesArray: {
                    link: string,
                    courtType: string
                }[] = [];
                const liElements = document.querySelectorAll('ul > li');

                if (!liElements) {
                    return [];
                }

                liElements.forEach((li) => {
                    const firstChildA = li.querySelector('a');

                    if (firstChildA && firstChildA.href && firstChildA.href.includes("kenyalaw.org/caselaw/cases")) {
                        linksAndCourtTypesArray.push({
                            link: firstChildA.href,
                            courtType: firstChildA.innerHTML
                        });
                    }
                });

                return linksAndCourtTypesArray;
            });

            return courtTypeLinks;
        }

        const courtTypeLinks = await waitForSelectorsAndEvaluatePage(page, "ul > li > a", evaluateInitialRunStartPage);

        if (!courtTypeLinks) {
            console.log(`Failed to return links`);
            return;
        }

        let initialCourtCasesLinks: string[] = [];

        for (const courtTypeLink of courtTypeLinks) {
            const courtTypePage = await createNewPage(browser);

            if (!courtTypePage) {
                return;
            }

            await navigeToPage(courtTypePage, courtTypeLink.link);

            const evaluateCourtTypePage = async (page: Page) => {
                const currentPageIndexAndLinks = await page.evaluate(() => {
                    const currentPageIndexAndLink = {
                        index: 0 as number,
                        // links: [] as string[],
                        courts: [] as string[],
                    };

                    const currentPageALink = document.querySelector(".pages .active");
                    console.log(`Current page link : ${currentPageALink}`);

                    if (currentPageALink) {
                        currentPageIndexAndLink.index = parseInt(currentPageALink.textContent || "0");
                    }

                    if (currentPageIndexAndLink.index === 1) {
                        console.log("At the first page");
                        const caseSearchLi = document.querySelector(".case-search-li");

                        const courtTypes = caseSearchLi?.querySelectorAll("a");

                        if (courtTypes && courtTypes.length > 0) {
                            for (const courtType of courtTypes) {
                                const courtTypeName = courtType.textContent?.trim() || "";
                                currentPageIndexAndLink.courts.push(courtTypeName);
                            }
                        }
                    }

                    // const postLinks = document.querySelectorAll(".post");

                    // for (const postLink of postLinks) {
                    //     const readMoreLink = postLink.querySelector(".show-more");
                    //     const readMoreHref = readMoreLink?.getAttribute("href");

                    //     if (readMoreHref) {
                    //         currentPageIndexAndLink.links.push(readMoreHref);
                    //     }
                    // }

                    return currentPageIndexAndLink;
                });

                return currentPageIndexAndLinks;
            }

            const courtType_Links_And_PageIndex = await waitForSelectorsAndEvaluatePage(courtTypePage, [".pages", ".post", ".case-search-li"], evaluateCourtTypePage);

            if (!courtType_Links_And_PageIndex && courtType_Links_And_PageIndex.length <= 0) {
                console.log(`Failed to fetch court type, links, and the page index`);
                continue;
            }

            const createCountiesResult = await createCounties(courtType_Links_And_PageIndex);
            if (!createCountiesResult) {
                return;
            }

            const createCourtsResult = await createCourts(courtType_Links_And_PageIndex);
            if (createCourtsResult) {
                console.log(`Created courts successfully`);
            } else {
                console.log(`Failed to create courts`);
                return;
            }

            await closePage(courtTypePage);
        }

        // console.log(`There are ${initialCourtCasesLinks.length} links to work with`);

        //We go through each court type link, utilize the advanced search feature then go through each page for that court type doing what we need to do. 
        for (const courtType of courtTypeLinks) {
            const courtTypePage = await createNewPage(browser);

            if (!courtTypePage) {
                continue;
            }

            await navigeToPage(courtTypePage, courtType.link);

            const awaitAdvancedSearchBtn = await waitForSelectors(courtTypePage, ["#advanced-search", ".group-option", ".search_bt", ".case-search-button", ".search-choice-close"]);

            if (!awaitAdvancedSearchBtn || awaitAdvancedSearchBtn === null) {
                continue;
            }

            try {
                await courtTypePage.click("#myTab li:nth-child(2)");
                await courtTypePage.$eval(`.search-choice-close`, element =>
                    (element as HTMLElement).click()
                );
            } catch (err) {
                console.log(`Failed to click element: ${err}`);
                continue;
            }

            const evaluateAdvancedSearchView = async (page: Page) => {
                const selectors = await page.evaluate(() => {
                    let items: {
                        id: string,
                        textContent: string
                    }[] = [];

                    const listElements = document.querySelectorAll(".chzn-drop ul > li");

                    console.log(`There are ${listElements?.length} list items`);
                    for (const liElement of listElements) {
                        const textContent = liElement.textContent ? liElement.textContent.trim().toLowerCase() : "";
                        const id = liElement.id ? liElement.id : "";

                        items.push({
                            id: id,
                            textContent: textContent
                        });
                    }

                    return items;
                });
                return selectors;
            };

            let optionToClickId: string = "";

            const selectors = await waitForSelectorsAndEvaluatePage(courtTypePage, [".chzn-drop", ".group-option", ".active-result"], evaluateAdvancedSearchView);

            for (const selector of selectors) {
                if (selector.textContent) {
                    if (selector.textContent.toLowerCase().includes("environment") &&
                        courtType.courtType.toLowerCase().includes("environment")) {
                        optionToClickId = "#" + selector.id;
                        break;
                    } else if (selector.textContent === courtType.courtType.toLowerCase().trim()) {
                        optionToClickId = "#" + selector.id;
                        break;
                    }
                }
            }

            try {
                if (!optionToClickId && optionToClickId === null) {
                    console.log(`Could not obtain court type option id for court type ${courtType.courtType}`);
                    continue;
                }

                console.log(`Obtained option to click id : ${optionToClickId} for court type ${courtType.courtType}`);

                if (optionToClickId === "") {
                    console.log(`Could not obtain court type option id for court type ${courtType.courtType}`);
                    continue;
                }

                let optionConfirm = await waitForSelectors(courtTypePage, optionToClickId);

                if (!optionConfirm || optionConfirm === null) {
                    console.log(`Failed to await the necessary selector`);
                    continue;
                }

                console.log(`Awaited option to click id ${optionToClickId} successfully`);

                const evaluateInputFieldAndGetId = async (page: Page) => {
                    const parentId = await page.evaluate(() => {
                        let id: string = "";
                        const inputs = document.querySelectorAll('input');
                        for (let input of inputs) {
                            if (input.value.trim().toLowerCase().includes("choose a court")) {
                                let parent = input.parentElement;
                                for (let i = 0; i < 2; i++) {
                                    if (parent) {
                                        parent = parent.parentElement;
                                    }
                                }

                                if (parent) {
                                    id = parent.id;
                                }
                                break;
                            }
                        }
                        return id;
                    });

                    return parentId;
                };

                let result = await evaluateInputFieldAndGetId(courtTypePage);

                if (!result) {
                    console.log(`Could not obtain input field id to click to trigger the dropdown`);
                    continue;
                }

                const dropDownOptionsSelector = "#" + result + " .chzn-drop .chzn-results .active-result";
                result = "#" + result + " input";

                optionConfirm = await waitForSelectors(courtTypePage, `${result}`);

                console.log(`Awaited input field ${result} successfully`);

                if (!optionConfirm || optionConfirm === null) {
                    console.log(`Failed to await the input field selector`);
                    continue;
                }

                console.log(`Clicking input field : ${result}`);
                await courtTypePage.$eval(result, element =>
                    (element as HTMLElement).click()
                );

                console.log(`Clicked input field : ${result}`);

                console.log(`Awaiting drop down selector ${dropDownOptionsSelector}`);
                optionConfirm = await waitForSelectors(courtTypePage, dropDownOptionsSelector);

                if (!optionConfirm) {
                    console.log(`Failed to await the drop down selector`);
                    continue;
                }

                console.log(`Awaited drop down selector ${dropDownOptionsSelector} successfully`);

                await courtTypePage.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const mousedown = new MouseEvent('mousedown', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(mousedown);
                        
                        const mouseup = new MouseEvent('mouseup', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(mouseup);
                    }
                }, optionToClickId);

                console.log(`Clicked on option to click id ${optionToClickId} successfully`);
                
                console.log(`Attempting to click on search button`);
                await courtTypePage.$eval(".search_bt", element =>
                    (element as HTMLElement).click()
                );
                console.log(`Clicked search button`);

                await courtTypePage.waitForNavigation({ waitUntil: "networkidle2" });

                console.log(`Moved to the results page`);

                let navigateToNextPage = true;

                do {
                    const nextBtn = await waitForSelectors(courtTypePage, [".pagination", ".clearfix", ".pages", ".next"]);
                    if (nextBtn === null || !nextBtn) {
                        console.log(`No next page link`);
                        navigateToNextPage = false;
                    }

                    const evaluateCourtTypeResultsPage = async (page: Page) => {
                        const currentPageLinks = await page.evaluate(() => {
                            const links : string[] = [];
    
                            const postLinks = document.querySelectorAll(".post");
    
                            for (const postLink of postLinks) {
                                const readMoreLink = postLink.querySelector(".show-more");
                                const readMoreHref = readMoreLink?.getAttribute("href");
        
                                if (readMoreHref) {
                                    links.push(readMoreHref);
                                }
                            }
    
                            return links;
                        });
    
                        return currentPageLinks;
                    }
    
                    const courtTypeResultsPageLinks = await waitForSelectorsAndEvaluatePage(courtTypePage, [".pages", ".post"], evaluateCourtTypeResultsPage);
    
                    if (!courtTypeResultsPageLinks && courtTypeResultsPageLinks.length <= 0) {
                        console.log(`No results to work with for court type ${courtType.courtType}`);
                        continue;
                    }
    
                    for (const caseLink of courtTypeResultsPageLinks) {
                        await courtTypePage.goto(caseLink, { waitUntil: "networkidle2" });
    
                        // Wait for the elements with the IDs "toggle_meta" and "case_meta"
                        const awaitCourtCasePageSelectors = await waitForSelectors(courtTypePage, ["#toggle_meta", "#case_meta", ".meta_info"]);
    
                        if (awaitCourtCasePageSelectors === null) {
                            console.log(`Failed to await selectors for court case page at link ${caseLink}`);
                        }
                        // Click on the toggle button
                        await courtTypePage.click("#toggle_meta");
    
                        const evaluateCourtCasePage = async (page: Page) => {
                            const headerAndValueObjects = await courtTypePage.evaluate(async () => {
                                const tableRows = document.querySelectorAll(".meta_info tbody tr");
    
                                let browserHeaderAndValueObjects = [] as any;
    
                                for (const tableRow of tableRows) {
                                    let rowHeader = tableRow.querySelector("th")?.textContent;
                                    let rowValue = tableRow.querySelector("td")?.textContent;
    
                                    let headerAndValueObj = {
                                        header: rowHeader && rowHeader !== "" ? rowHeader : "",
                                        value: rowValue && rowValue !== "" ? rowValue : ""
                                    };
    
                                    browserHeaderAndValueObjects.push(headerAndValueObj);
                                }
    
                                return browserHeaderAndValueObjects;
                            });
    
                            return headerAndValueObjects;
                        }
    
                        const courtCaseHeaderAndValueObjects = await waitForSelectorsAndEvaluatePage(courtTypePage, ["#toggle_meta", "#case_meta", ".meta_info"], evaluateCourtCasePage);
    
                        if (courtCaseHeaderAndValueObjects === null || courtCaseHeaderAndValueObjects.length <= 0) {
                            console.log(`Failed to fetch court case meta data for case page at link ${caseLink}`);
                            continue;
                        }
    
                        await createCases(courtCaseHeaderAndValueObjects);
    
                        console.log(`Created court cases`);
    
                        await courtTypePage.goBack();
                    }
                    
                    if (nextBtn) {
                        console.log(`Moving to next page`);
                    }
                } while (navigateToNextPage);
            } catch (err) {
                console.log(`${err}`);
            }
        }

        // for (const courtTypeLinks of initialCourtCasesLinks) {
        //     for (const link of courtTypeLinks) {
        //         const courtCasePage = await createNewPage(browser);

        //         if (!courtCasePage) {
        //             return;
        //         }

        //         await navigeToPage(courtCasePage, link);

        //         const evaluateCourtCasePage = async (page: Page) => {
        //             const headerAndValueObjects = await page.evaluate(async () => {
        //                 const tableRows = document.querySelectorAll(".meta_info tbody tr");

        //                 let headerAndValueObject = [] as any;

        //                 for (const tableRow of tableRows) {
        //                     let rowHeader = tableRow.querySelector("th")?.textContent;
        //                     let rowValue = tableRow.querySelector("td")?.textContent;

        //                     let headerAndValueObj = {
        //                         header: rowHeader && rowHeader !== "" ? rowHeader : "",
        //                         value: rowValue && rowValue !== "" ? rowValue : ""
        //                     };

        //                     headerAndValueObject.push(headerAndValueObj);
        //                 }

        //                 return headerAndValueObject;
        //             });

        //             return headerAndValueObjects;
        //         }

        //         const caseHeaderAndValueObjects = await waitForSelectorsAndEvaluatePage(courtCasePage, ['#toggle_meta', '#case_meta', '.meta_info'], evaluateCourtCasePage);

        //         if (caseHeaderAndValueObjects && caseHeaderAndValueObjects.length > 0) {
        //             await createCases(caseHeaderAndValueObjects);
        //         }
        //         await closePage(courtCasePage);
        //     }
        // }
    } else {
        console.log(`Not the first run`);
    }

    /**
    //If we can globalize the object or method returning the browser, that would be great.
    const browser = await puppeteer.launch({ headless: false });
    //Same for this, so that we can call one method/object for the pages we need.
    let page = await browser.newPage();

    await page.setViewport(viewPortConfig);
    try {
        //Go to the main page and grab the links for the different court types
        await page.goto("https://www.kenyalaw.org/caselaw", { waitUntil: "networkidle2" });

        await page.waitForSelector('ul > li > a');

        const links = await page.evaluate(() => {
            const links: {
                link: string,
                courtType: string
            }[] = [];
            const liElements = document.querySelectorAll('ul > li');

            liElements.forEach((li) => {
                const firstChildA = li.querySelector('a');

                if (firstChildA && firstChildA.href && firstChildA.href === "https://www.kenyalaw.org/caselaw") {
                    links.push({
                        link: firstChildA.href,
                        courtType: firstChildA.innerHTML
                    });
                }
            });

            return links;
        });

        //Let's break it down. First grab the links for the court types, alongside the display text
        //Check if it's the first run or not. 
        //If it's the first run, do the initial process of pulling the courts and counties, create or update the value of initial run too.
        //If it's not the first run, use the display text e.g. Supreme Court of Kenya, All Courts of Appeal to check if you have data for each court type.
        //For words with All, delete all and trim it. 
        //If you don't, find data for that court type and create the counties and court data as necessary
        //Let's modularize the code as much as possible to remove the fatigue from following the long scrapeCases() method. 
        //Remember, everything is in typescript.

        for (const link of links) {
            const secondPage = await browser.newPage();
            await secondPage.setViewport(viewPortConfig);
            await secondPage.goto(link.link, { waitUntil: "networkidle2" });

            console.log("Arrived at link ", link);

            const selectorsToWaitFor = [".pages", ".post", ".case-search-li"];

            try {
                await Promise.all(
                    selectorsToWaitFor.map(async (selector) => {
                        await secondPage.waitForSelector(selector, { timeout: 60000 });
                        console.log(`Selector "${selector}" is now available`);
                    })
                );

                console.log("All selectors are ready");

                const currentPageIndexAndLinks = await secondPage.evaluate(() => {
                    const currentPageIndexAndLink = {
                        index: 0 as number,
                        links: [] as string[],
                        courts: [] as string[],
                    };

                    const currentPageALink = document.querySelector(".pages .active");
                    console.log(`Current page link : ${currentPageALink}`);

                    if (currentPageALink) {
                        currentPageIndexAndLink.index = parseInt(currentPageALink.textContent || "0");
                    }

                    if (currentPageIndexAndLink.index === 1) {
                        console.log("At the first page");
                        const caseSearchLi = document.querySelector(".case-search-li");

                        const courtTypes = caseSearchLi?.querySelectorAll("a");

                        if (courtTypes && courtTypes.length > 0) {
                            for (const courtType of courtTypes) {
                                const courtTypeName = courtType.textContent?.trim() || "";
                                currentPageIndexAndLink.courts.push(courtTypeName);
                            }
                        }
                    }

                    const postLinks = document.querySelectorAll(".post");

                    for (const postLink of postLinks) {
                        const readMoreLink = postLink.querySelector(".show-more");
                        const readMoreHref = readMoreLink?.getAttribute("href");

                        if (readMoreHref) {
                            currentPageIndexAndLink.links.push(readMoreHref);
                        }
                    }

                    return currentPageIndexAndLink;
                });

                // Create courts and counties for each first page
                if (currentPageIndexAndLinks.courts && currentPageIndexAndLinks.courts.length > 0) {
                    for (const court of currentPageIndexAndLinks.courts) {
                        let courtName: any;
                        let type: any;
                        let county: any;
                        let specialCourt = false as boolean;

                        courtName = court;
                        if (courtName.indexOf("[") !== -1) {
                            courtName = courtName.substring(0, court.indexOf("["));
                        }

                        if (courtName.indexOf("(") !== -1) {
                            courtName = courtName.substring(0, courtName.indexOf("("));
                        }

                        if (courtName.includes(" at ")) {
                            type = courtName.split(" at ")[0];
                            county = courtName.split(" at ")[1];
                        } else {
                            type = courtName;
                            specialCourt = true;
                        }

                        const countyCreatedObj = async () => {
                            if (county && county !== "") {
                                const [countyInstance, wasCreated] = await County.findOrCreate({
                                    where: { county },
                                    defaults: {
                                        county,
                                        dateCreated: new Date(),
                                        dateModified: new Date(),
                                    }
                                });

                                let countyCreatedObj = {
                                    existingCounty: {} as County,
                                    created: false as boolean
                                };

                                countyCreatedObj.existingCounty = countyInstance;
                                countyCreatedObj.created = wasCreated;
                                return countyCreatedObj;
                            } else {
                                return undefined;
                            }
                        }

                        let countyCreateObj = undefined;
                        if (!specialCourt) {
                            countyCreateObj = await countyCreatedObj();
                        }

                        let existingCounty = {} as any;
                        let created = false as boolean;

                        if (!specialCourt && countyCreateObj) {
                            existingCounty = countyCreateObj.existingCounty;
                            created = countyCreateObj.created;

                            if (created && existingCounty && existingCounty.get('id') !== undefined) {
                                console.log(`County ${county} created with ID : ${existingCounty.get('id')}`);
                            } else if (!created && existingCounty && existingCounty.get('id') !== undefined) {
                                console.log(`County ${county} already exists with ID : ${existingCounty.get('id')}`);
                            } else {
                                console.log(`Error: County ${county} not found or created.`);
                            }
                        }

                        let existingCourt: any;


                    }
                }

                // Loop through the pulled links, opening them in a new tab, one by one
                if (currentPageIndexAndLinks.links && currentPageIndexAndLinks.links.length > 0) {
                    for (const caseLink of currentPageIndexAndLinks.links) {
                        await secondPage.goto(caseLink, { waitUntil: "networkidle2" });

                        // Wait for the elements with the IDs "toggle_meta" and "case_meta"
                        await Promise.all([
                            secondPage.waitForSelector('#toggle_meta', { timeout: 60000 }),
                            secondPage.waitForSelector('#case_meta', { timeout: 60000 }),
                            secondPage.waitForSelector('.meta_info', { timeout: 60000 })
                        ]);

                        // Click on the toggle button
                        await secondPage.click("#toggle_meta");

                        async function getCaseMetaData() {
                            console.log(`Pulling case meta data`);
                            const headerAndValueObjects = await secondPage.evaluate(async () => {
                                const tableRows = document.querySelectorAll(".meta_info tbody tr");

                                let headerAndValueObjects = [] as any;

                                for (const tableRow of tableRows) {
                                    let rowHeader = tableRow.querySelector("th")?.textContent;
                                    let rowValue = tableRow.querySelector("td")?.textContent;

                                    let headerAndValueObj = {
                                        header: rowHeader && rowHeader !== "" ? rowHeader : "",
                                        value: rowValue && rowValue !== "" ? rowValue : ""
                                    };

                                    headerAndValueObjects.push(headerAndValueObj);
                                }

                                return headerAndValueObjects;
                            });

                            let title = "", caseNumber = "", parties = "", caseClass = "", caseAction = "", citation = "";
                            let court = 0;
                            let dateDelivered = undefined;

                            if (headerAndValueObjects && headerAndValueObjects.length > 0) {
                                for (const headerAndValueObj of headerAndValueObjects) {
                                    let rowHeader = headerAndValueObj.header;
                                    let rowValue = headerAndValueObj.value;

                                    if (rowHeader && rowHeader !== "") {
                                        if (rowHeader.includes(":")) {
                                            rowHeader = rowHeader.replaceAll(":", "");
                                        }

                                        rowValue = rowValue ? rowValue.trim() : "";

                                        console.log("At header : ", rowHeader, " with value : ", rowValue);
                                        switch (rowHeader.toLowerCase().trim()) {
                                            case "case number":
                                                caseNumber = rowValue;
                                                break;
                                            case "parties":
                                                parties = rowValue;
                                                break;
                                            case "date delivered":
                                                let date_delivered = new Date();
                                                let date = rowValue ? parseInt(rowValue.split(" ")[0]) : 0;
                                                date_delivered.setDate(date);
                                                date_delivered.setMonth(6);
                                                date_delivered.setFullYear(rowValue ? parseInt(rowValue.split(" ")[2]) : 0);
                                                dateDelivered = date_delivered;
                                                break;
                                            case "case class":
                                                caseClass = rowValue ? rowValue : "";
                                                break;
                                            case "court":
                                                async function getCourtId() {
                                                    const court = await Court.findOne({
                                                        where: {
                                                            courtName: rowValue ? rowValue : ""
                                                        }
                                                    });
                                                    if (court) {
                                                        return court.get('id');
                                                    } else {
                                                        return 0;
                                                    }
                                                };
                                                court = await getCourtId();
                                                break;
                                            case "case action":
                                                caseAction = rowValue ? rowValue : "";
                                                break;
                                            case "citation":
                                                citation = rowValue ? rowValue : "";
                                                title = rowValue ? rowValue : "";
                                            default:
                                                break;
                                        }
                                    }
                                }

                                return {
                                    title: title,
                                    caseNumber: caseNumber,
                                    parties: parties,
                                    dateDelivered: dateDelivered,
                                    caseClass: caseClass,
                                    citation: citation,
                                    court: court
                                }
                            }
                        };

                        let caseMetaData_ = await getCaseMetaData() as any;
                        if (caseMetaData_) {
                            console.log(`Case meta data was returned`);
                            console.log(JSON.stringify(caseMetaData_));
                            let caseNumber;
                            if (caseMetaData_.caseNumber) {
                                caseNumber = caseMetaData_.caseNumber;
                            }

                            let courtName = "";
                            if (caseMetaData_.court) {
                                courtName = caseMetaData_.court;
                            }

                            const [caseInstance, wasCreated] = await Case.findOrCreate({
                                where: { caseNumber },
                                defaults: {
                                    title: caseMetaData_.title,
                                    caseNumber: caseMetaData_.caseNumber,
                                    parties: caseMetaData_.parties,
                                    dateDelivered: caseMetaData_.dateDelivered,
                                    caseClass: caseMetaData_.caseClass,
                                    courtId: caseMetaData_.court,
                                    dateCreated: new Date(),
                                    dateModified: new Date(),
                                    citation: caseMetaData_.citation
                                }
                            });

                            if (wasCreated) {
                                console.log(`Created case title ${caseInstance.get('title')} successfully`);
                            } else {
                                console.log(`Failed to create case title ${caseInstance.get('title')}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.log(`Error waiting for selector on ${link}: ${err}`);
            }

            // await secondPage.close();
        }
    } catch (error) {
        console.log(new Error().stack);
        console.log(error);
    } finally {
        // await browser.close();
        console.log("Scraping service completed.");
    }  */
};

parentPort?.on('message', async (message) => {
    if (message === 'start-scraping') {
        await scrapeCases();
        parentPort?.postMessage('scraping-completed');
    }
});