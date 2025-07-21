/**
 * @file DataAccess.gs
 * @description Handles all direct data access from Google Sheets and caching logic.
 * @version 2.0 - Optimized for performance
 */

const SPREADSHEET_ID = '1vzthy4oBpXMYa-8TkuGCHUC5DkMkeVf0_pNlh7UopXg';
const CACHE_EXPIRATION_SECONDS = 3600; // Cache data for 1 hour
const CACHE_SERVICE = CacheService.getScriptCache();
const ALL_DATA_CACHE_KEY = 'ALL_SHEETS_DATA_V2'; // A single key for the entire dataset

/**
 * A generic function to convert a 2D array from a sheet into an array of objects.
 * Assumes the first row of the values is the header row.
 * @param {Array<Array<any>>} values - The 2D array of data from sheet.getDataRange().getValues().
 * @returns {Array<Object>} An array of objects, where each object represents a row.
 */
function valuesToObjects(values) {
    if (!values || values.length < 2) {
        return []; // Not enough data to process
    }
    const headers = values.shift().map(header => header.toString().trim());
    const data = values.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            if (header) {
                obj[header] = row[index];
            }
        });
        return obj;
    });
    return data;
}

/**
 * A generic utility function to convert an array of objects into a map for fast lookups.
 * @param {Array<Object>} array - The array to convert.
 * @param {string} keyField - The name of the property to use as the key for the map.
 * @returns {Object} A map-like object for O(1) lookups.
 */
function arrayToMap(array, keyField) {
    const map = {};
    array.forEach(item => {
        if (item && item[keyField]) {
            map[item[keyField]] = item;
        }
    });
    return map;
}


/**
 * Fetches all required data from the spreadsheet in an optimized way, using a single cache entry.
 * This function is designed to minimize calls to SpreadsheetApp, which is the main performance bottleneck.
 * @returns {Object} An object containing all the necessary data maps.
 */
function getAllDataWithCache() {
    // 1. Try to get the entire dataset from cache first.
    const cachedData = CACHE_SERVICE.get(ALL_DATA_CACHE_KEY);
    if (cachedData) {
        return JSON.parse(cachedData);
    }

    // 2. If not in cache, fetch fresh data from the spreadsheet.
    console.log("Cache miss. Fetching fresh data from Spreadsheet.");
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

        const sheetNames = ['Task', 'Project', 'Employee', 'TaskStatus', 'TaskType', 'Location', 'ProjectStatus'];
        const sheets = {};
        ss.getSheets().forEach(sheet => {
            const sheetName = sheet.getName();
            if (sheetNames.includes(sheetName)) {
                sheets[sheetName] = sheet.getDataRange().getValues();
            }
        });

        // 3. Process the raw data into maps.
        const taskData = valuesToObjects(sheets['Task'] || []).filter(obj => obj.ID && obj.ID.toString().length > 0);

        const supportingData = {
            projects: arrayToMap(valuesToObjects(sheets['Project'] || []), 'ID'),
            employees: arrayToMap(valuesToObjects(sheets['Employee'] || []), 'ID'),
            taskStatuses: arrayToMap(valuesToObjects(sheets['TaskStatus'] || []), 'ID'),
            taskTypes: arrayToMap(valuesToObjects(sheets['TaskType'] || []), 'ID'),
            locations: arrayToMap(valuesToObjects(sheets['Location'] || []), 'ID'),
            projectStatuses: arrayToMap(valuesToObjects(sheets['ProjectStatus'] || []), 'ID')
        };

        const allData = {
            taskData: taskData,
            supportingData: supportingData
        };

        // 4. Store the combined result in the cache.
        try {
            CACHE_SERVICE.put(ALL_DATA_CACHE_KEY, JSON.stringify(allData), CACHE_EXPIRATION_SECONDS);
        } catch (e) {
            console.error(`Could not cache the dataset. Data might be too large. Error: ${e.message}`);
        }

        return allData;

    } catch (e) {
        console.error(`Failed to fetch and process spreadsheet data. Error: ${e.toString()}`);
        // Return an empty structure to prevent the app from crashing
        return {
            taskData: [],
            supportingData: {
                projects: {},
                employees: {},
                taskStatuses: {},
                taskTypes: {},
                locations: {},
                projectStatuses: {}
            }
        };
    }
}
