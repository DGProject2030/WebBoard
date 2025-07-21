/**
 * @file Code.gs
 * @description Main server-side logic for the web app.
 * Handles serving the HTML interface and exposing data-fetching functions to the client.
 * @version 2.0 - Optimized for performance
 */
const AUTHORIZED_DOMAINS = ['stage-design.co.il', 'stagedesign.co.il'];

/**
 * Checks if the current user is authorized to access the application based on their email domain.
 * @returns {boolean} True if the user is authorized, false otherwise.
 */
function isCurrentUserAuthorized() {
    try {
        const email = Session.getActiveUser().getEmail().toLowerCase();
        if (!email) {
            return false;
        }

        // Check if the email's domain is in the authorized list
        return AUTHORIZED_DOMAINS.some(domain => email.endsWith('@' + domain));

    } catch (e) {
        // If user is not logged in or there's an error, they are not authorized.
        console.error("Authorization check failed: " + e.toString());
        return false;
    }
}

/**
 * Main function that runs when the web app URL is accessed.
 * It serves the main calendar page to authorized users and an "Unauthorized" page to others.
 * @param {Object} e - The event parameter for a web app.
 * @returns {HtmlOutput} The HTML output to be served to the user.
 */
function doGet(e) {
    if (!isCurrentUserAuthorized()) {
        return HtmlService.createTemplateFromFile('Unauthorized').evaluate()
            .setTitle('אין גישה')
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    }

    return HtmlService.createTemplateFromFile('Calendar')
        .evaluate()
        .setTitle('לוח התפעול החדש')
        .setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/forms/favicon_qp2.png')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes the content of another file (like CSS or JS) into the main HTML template.
 * @param {string} filename - The name of the file to include.
 * @returns {string} The content of the specified file.
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * The main server-side function called by the client to get all calendar event data.
 * This function is now highly optimized to prevent timeouts.
 * @returns {Array} An array of event objects for authorized users.
 * @throws {Error} Throws an 'UNAUTHORIZED' error if the user is not permitted to access data.
 */
function getCalendarEvents() {
    if (!isCurrentUserAuthorized()) {
        throw new Error('UNAUTHORIZED: User is not permitted to access this resource.');
    }

    try {
        // Step 1: Fetch all data using the new optimized and cached function.
        const allData = getAllDataWithCache();

        // Step 2: Enrich and filter the data.
        const enrichedEvents = enrichEventsWithSupportingData(allData.taskData, allData.supportingData);

        // Step 3: Transform data for the calendar.
        const calendarEvents = transformEventsForCalendar(enrichedEvents);

        return calendarEvents;
    } catch (e) {
        console.error('Error in getCalendarEvents: ' + e.toString());
        console.error('Stack: ' + e.stack);
        // Re-throw the error to be handled by the client-side failure handler.
        throw e;
    }
}
