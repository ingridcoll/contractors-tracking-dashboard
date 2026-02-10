/*
The Lambda function generateRecommendedActions
extracts the specific contractor's data from the user's request
and generates a structured JSON response that lists 1 to 3 
recommended actions to take to reduce the contractor's risk level:
*/
export const handler = async (event) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  try {
    // Fetch contractor data from the request
    const contractorData = event.body ? JSON.parse(event.body) : event;

    // Ensure request contains important fields
    if (
      !contractorData.name ||
      !contractorData.project_description ||
      !contractorData.access_level ||
      !contractorData.application
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Clean up risk factors JSON
    const riskFactorsFormatted = formatRiskFactors(contractorData.risk_factors);

    // Generate prompt based on specific contractor's data
    const prompt = createPrompt(contractorData, riskFactorsFormatted);

    console.log("Prompt created:", prompt);

    // Call Google Gemini
    const recommendations = await callLLM(prompt);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        contractor: contractorData.name,
        riskScore: contractorData.risk_score,
        riskFactors: contractorData.risk_factors,
        recommendations: recommendations,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Error generating recommended actions", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

/*
Take risk factors JSON and format it as an array
for LLM ingestion:
*/
function formatRiskFactors(riskFactors) {
  if (!riskFactors || !Array.isArray(riskFactors) || riskFactors.length === 0) {
    return "No specific risk factors identified.";
  }

  return riskFactors
    .map(
      (factor) =>
        `- ${factor.factor} - ${factor.reason} - (Weight: ${factor.weight}/100)`,
    )
    .join("\n");
}

/*
Generate structured prompt using contractor's dynamic data:
*/
function createPrompt(contractorData, riskFactorsFormatted) {
  const today = new Date().toLocaleString();
  return `
    Create 1-3 security recommendations for a contractor. Today is ${today}.

    Contractor: ${contractorData.name}
    Application: ${contractorData.application}
    Access Level: ${contractorData.access_level}
    Project Description: ${contractorData.project_description}
    Production Access: ${contractorData.has_prod_access ? "Yes" : "No"}
    Risk Factors: ${riskFactorsFormatted}

    Generate recommendations in this exact JSON format:
    [
      {
        "title": "Short action title",
        "description": "Specific action to implement",
        "reason": "How this addresses the risk factors",
        "priority": "high"
      }
    ]

    Return ONLY the JSON array with no other text.`;
}

/*
Call Google Gemini's flash model to generate
1 to 3 recommendations in JSON format:
*/
async function callLLM(prompt) {
  console.log("Generating risk-based recommendations...");

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log("API key not found in environment variables.");
    throw new Error("API key not configured");
  }

  try {
    const modelName = "gemini-2.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          // Ensure response is in JSON format
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Gemini API response received");

    const recommendations = extractJSONFromResponse(data);

    console.log("Successfully parsed recommendations:", recommendations.length);
    return recommendations;
  } catch (error) {
    console.error("Error calling Gemini API:", error.message);
    throw error;
  }
}

/*
Cleans up and formats generated LLM response:
*/
function extractJSONFromResponse(data) {
  try {
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const responseText = data.candidates[0].content.parts[0].text;

      // Clean and parse
      const cleanText = responseText.trim();
      return JSON.parse(cleanText);
    }

    throw new Error("No valid response from Gemini");
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", parseError);

    const fullResponse = JSON.stringify(data);
    const jsonMatch = fullResponse.match(/\[.*\]/s);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Could not extract valid JSON from response");
      }
    }

    throw new Error("No JSON found in Gemini response");
  }
}
