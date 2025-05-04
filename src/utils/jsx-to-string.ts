/**
 * Utility for safely converting JSX components to strings
 */

import { logError, logDebug } from "./debug.ts";

/**
 * Convert a JSX component to a string in a safe way
 * This handles Response objects and other edge cases
 */
export function componentToString(component: unknown): string {
  // If it's already a string, return it
  if (typeof component === "string") {
    return component;
  }

  try {
    // First try simple string conversion
    const result = String(component);
    
    // Check for unhelpful default string representation
    if (result === "[object Object]" || result.includes("[object Response]")) {
      logError("Component conversion failed, got unhelpful string", { result });
      throw new Error("Component did not convert to a useful string: " + result);
    }
    
    return result;
  } catch (error) {
    logError("Failed to convert component to string", error);
    
    // Return a placeholder in case of error
    return "<!-- Error rendering component -->";
  }
}

/**
 * Safely render a component by creating it and converting to string
 * This handles any errors that occur during component creation or conversion
 */
export function renderComponent<T>(
  ComponentFn: (props: T) => unknown,
  props: T,
  fallback = ""
): string {
  try {
    // Create the component
    const component = ComponentFn(props);
    
    // Convert to string
    return componentToString(component);
  } catch (error) {
    logError(`Error rendering component ${ComponentFn.name}`, error);
    return fallback || `<!-- Error rendering ${ComponentFn.name} -->`;
  }
}