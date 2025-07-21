/**
 * @file Code.gs
 * @description Main server-side logic for the web app.
 * Handles serving the HTML interface and exposing data-fetching functions to the client.
 */
// הוספתי הערה חדשה
function myFunction() {
    // הקוד הקיים...
}
const AUTHORIZED_DOMAIN = 'stage-design.co.il';

/**
 * Checks if the current user is authorized to access the application based on their email domain.
 * @returns {boolean} True if the user is authorized, false otherwise.
 */
function isCurrentUserAuthorized() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (email && email.toLowerCase().endsWith('@' + AUTHORIZED_DOMAIN)) {
      return true;
    }
    return false;
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
 * Enforces authorization before returning data.
 * @returns {Array} An array of event objects for authorized users.
 * @throws {Error} Throws an 'UNAUTHORIZED' error if the user is not permitted to access data.
 */
function getCalendarEvents() {
  if (!isCurrentUserAuthorized()) {
    // Instead of returning an empty array, throw a specific error.
    throw new Error('UNAUTHORIZED: User is not permitted to access this resource.');
  }

  try {
    // Step 1: Fetch the raw task data from the 'Task' sheet.
    const taskData = sheetToObjects('Task', SPREADSHEET_ID);

    // Step 2: Fetch all supporting data tables.
    const projectsMap = getSheetAsMapWithCache('Project', 'ID', false);
    const employeesMap = getSheetAsMapWithCache('Employee', 'ID', false);
    const taskStatusMap = getSheetAsMapWithCache('TaskStatus', 'ID', true);
    const taskTypeMap = getSheetAsMapWithCache('TaskType', 'ID', true);
    const locationMap = getSheetAsMapWithCache('Location', 'ID', true);
    const projectStatusMap = getSheetAsMapWithCache('ProjectStatus', 'ID', true);

    const supportingData = {
      projects: projectsMap,
      employees: employeesMap,
      taskStatuses: taskStatusMap,
      taskTypes: taskTypeMap,
      locations: locationMap,
      projectStatuses: projectStatusMap
    };

    // Step 3: Enrich and filter the data.
    const enrichedEvents = enrichEventsWithSupportingData(taskData, supportingData);
    
    // Step 4: Transform data for the calendar.
    const calendarEvents = transformEventsForCalendar(enrichedEvents);
    
    return calendarEvents;
  } catch (e) {
    console.error('Error in getCalendarEvents: ' + e.toString());
    console.error('Stack: ' + e.stack);
    // Re-throw the error to be handled by the client-side failure handler.
    throw e;
  }
}
