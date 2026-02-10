const API_BASE_URL = "https://8jm3og3pvg.execute-api.us-east-1.amazonaws.com";

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.log("API call failed:", error);
    throw error;
  }
}
