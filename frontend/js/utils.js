// API Gateway base URL
const API_BASE_URL = "https://8jm3og3pvg.execute-api.us-east-1.amazonaws.com";

// Reusable function to perform API calls
export async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.message || data.error || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.log("API call failed:", error);
    throw error;
  }
}

// Determines risk level from score
export function getRiskLevel(score) {
  if (score >= 70) return "high";
  if (score >= 30) return "medium";
  return "low";
}
