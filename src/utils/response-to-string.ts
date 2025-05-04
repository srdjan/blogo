/**
 * Utility to convert mono-jsx Response objects to strings
 */

import { logError, logDebug } from "./debug.ts";

/**
 * Convert a mono-jsx Response object to a string
 * This is needed because mono-jsx can return Response objects when rendering
 */
export const responseToString = async (
  response: Response | string | unknown,
): Promise<string> => {
  // If it's already a string, just return it
  if (typeof response === "string") {
    return response;
  }
  
  // If it's a Response object, extract the text
  if (response instanceof Response) {
    try {
      logDebug("Converting Response to string", {
        status: response.status,
        ok: response.ok,
        type: response.type
      });
      
      // Clone the response before reading to avoid consuming the body
      const clonedResponse = response.clone();
      return await clonedResponse.text();
    } catch (error) {
      logError("Failed to extract text from Response", error);
      return "Error extracting content from Response";
    }
  }
  
  // For any other object, try to convert to string
  try {
    const stringValue = String(response);
    if (stringValue === "[object Object]") {
      // Try JSON stringifying
      return JSON.stringify(response);
    }
    return stringValue;
  } catch (error) {
    logError("Failed to convert object to string", error);
    return "Error converting content to string";
  }
};