import { apiCall, getRiskLevel } from "./utils.js";

let contractors = [];
const tableBody = document.querySelector("#contractors-table tbody");

/*
Using the apiCall function from utils.js,
fetches the contractors table through the 
Lambda function getContractorsWithRiskScores:
*/
async function loadContractors() {
  try {
    tableBody.innerHTML =
      '<tr><td colspan="11">Loading contractors...</td></tr>';

    // Trigger Lambda function getContractorsWithRiskScores (API Gateway /contractors)
    const response = await apiCall("/contractors");
    console.log("API Response:", response);

    contractors = response.contractors || [];

    // Render table
    renderContractors();
  } catch (error) {
    console.error("Error loading contractors:", error);
    tableBody.innerHTML = `<tr><td colspan="11" class="error">Error loading data: ${error.message}</td></tr>`;
  }
}

/*
Renders each contractor from the database
as a table row:
*/
function renderContractors() {
  tableBody.innerHTML = "";

  if (!contractors || contractors.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="11">No contractors found</td></tr>';
    return;
  }

  contractors.forEach((contractor) => {
    const row = document.createElement("tr");

    const lastSignIn = contractor.last_sign_in
      ? new Date(contractor.last_sign_in).toLocaleDateString()
      : "Never";

    const contractEnd = contractor.contract_end
      ? new Date(contractor.contract_end).toLocaleDateString()
      : "N/A";

    const riskScore = contractor.risk_score || 0;
    const riskLevel = getRiskLevel(riskScore);
    const prodAccess = contractor.has_prod_access ? "Yes" : "No";

    // Calculate if contractor is high risk
    const isHighRisk = riskLevel === "high";

    row.innerHTML = `
      <td>${contractor.name || "Unknown"}</td>
      <td>${contractor.email}</td>
      <td>${contractor.job_title}</td>
      <td>${contractor.project_description}</td>
      <td>${contractor.application}</td>
      <td>${contractor.access_level}</td>
      <td>${lastSignIn}</td>
      <td>${contractEnd}</td>
      <td>${prodAccess}</td>
      <td class="risk-score risk-${riskLevel}">
        ${riskScore}
      </td>
      <td>
        ${
          isHighRisk
            ? `<button class="btn-generate" data-contractor-id="${contractor.id}">
               Analyze Access
             </button>`
            : "-"
        }
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Add click handlers to "Analyze Access" buttons
  addButtonListeners();
}

/*
Adds event listener functions to each
"Analyze Access" button:
*/
function addButtonListeners() {
  document.querySelectorAll(".btn-generate").forEach((button) => {
    button.addEventListener("click", async () => {
      const contractorId = button.dataset.contractorId;
      const contractor = contractors.find((c) => c.id === contractorId);

      if (contractor) {
        await handleGenerateRecommendations(contractor, button);
      }
    });
  });
}

/*
On button click, generate API call to /contractors/{contractor_id}/actions.
Handled by Lambda function generateRecommendedActions (API Gateway):
*/
async function handleGenerateRecommendations(contractor, buttonElement) {
  try {
    buttonElement.disabled = true;
    buttonElement.textContent = "Analyzing...";

    // Lambda function generateRecommendedActions
    const response = await apiCall(`/contractors/${contractor.id}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contractor),
    });

    showRecommendationsPopup(response);

    // Store contractor data in the container
    // In production, I would save the analysis in the database with a POST call
    const container = buttonElement.parentElement;
    container.dataset.contractorId = contractor.id;

    // When generated once, show two buttons (stored analysis or regenerate arrow)
    container.innerHTML = `
      <button class="btn-see-analysis" data-contractor-id="${contractor.id}">See Analysis</button>
      <button class="btn-regenerate" data-contractor-id="${contractor.id}" title="Regenerate">↻</button>
    `;

    // Get fresh references to the new buttons
    const seeAnalysisBtn = container.querySelector(".btn-see-analysis");
    const regenerateBtn = container.querySelector(".btn-regenerate");

    // Set up click handlers
    seeAnalysisBtn.onclick = () => {
      showRecommendationsPopup(response);
    };

    regenerateBtn.onclick = async () => {
      // Show loading on regenerate button
      regenerateBtn.textContent = "...";
      regenerateBtn.disabled = true;

      // Get the contractor data again
      const contractorId = regenerateBtn.dataset.contractorId;
      const originalContractor = contractors.find((c) => c.id === contractorId);

      if (originalContractor) {
        await handleGenerateRecommendations(originalContractor, regenerateBtn);
      }
    };
  } catch (error) {
    console.error("Error:", error);
    buttonElement.textContent = "Try Again";
    buttonElement.disabled = false;
  }
}

/*
Create and show div element that displays LLM-generated analysis:
*/
function showRecommendationsPopup(data) {
  const recommendations = data.recommendations || [];

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  // Create modal container
  const modal = document.createElement("div");
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
    animation: fadeIn 0.3s ease-out;
  `;

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  // Create modal header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #e9ecef;
  `;

  const title = document.createElement("h3");
  title.textContent = `Recommended Actions for ${data.contractor}`;
  title.style.margin = "0";
  title.style.fontSize = "18px";
  title.style.color = "#333";

  // Create close button
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "&times;";
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  `;
  closeButton.onmouseover = () => (closeButton.style.color = "#333");
  closeButton.onmouseout = () => (closeButton.style.color = "#666");

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content container
  const content = document.createElement("div");
  content.style.cssText = `
    padding: 24px;
  `;

  // Add risk summary
  const summary = document.createElement("div");
  summary.style.cssText = `
    background: #f8f9fa;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 24px;
    border-left: 4px solid #007bff;
  `;

  const riskScore = document.createElement("div");
  riskScore.innerHTML = `<strong>Risk Score:</strong> ${data.riskScore}/100`;
  riskScore.style.marginBottom = "8px";

  const riskFactors = document.createElement("div");
  riskFactors.innerHTML = `<strong>Risk Factors:</strong> ${data.riskFactors?.length || 0} identified`;

  summary.appendChild(riskScore);
  summary.appendChild(riskFactors);

  content.appendChild(summary);

  if (recommendations.length > 0) {
    const recommendationsTitle = document.createElement("h4");
    recommendationsTitle.textContent = `Recommended Actions (${recommendations.length})`;
    recommendationsTitle.style.margin = "0 0 16px 0";
    recommendationsTitle.style.color = "#495057";
    content.appendChild(recommendationsTitle);

    // Create recommendations list
    recommendations.forEach((rec, index) => {
      const recCard = document.createElement("div");
      recCard.style.cssText = `
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 20px;
        margin-bottom: 16px;
        background: #fff;
        border-left: 4px solid ${getPriorityColor(rec.priority)};
      `;

      // Header with number and priority
      const recHeader = document.createElement("div");
      recHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      `;

      const recNumber = document.createElement("div");
      recNumber.textContent = `${index + 1}. ${rec.title}`;
      recNumber.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #212529;
        flex: 1;
        margin-right: 16px;
      `;

      const priorityBadge = document.createElement("span");
      priorityBadge.textContent = rec.priority.toUpperCase();
      priorityBadge.style.cssText = `
        background: ${getPriorityColor(rec.priority)};
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      `;

      recHeader.appendChild(recNumber);
      recHeader.appendChild(priorityBadge);

      // Description
      const description = document.createElement("div");
      description.style.cssText = `
        margin-bottom: 12px;
        line-height: 1.5;
      `;
      description.innerHTML = `<strong>Action:</strong> ${rec.description}`;

      // Reason
      const reason = document.createElement("div");
      reason.style.cssText = `
        padding: 12px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.4;
      `;
      reason.innerHTML = `<strong>Why this matters:</strong> ${rec.reason}`;

      // Risk factors addressed
      if (rec.risk_factors_addressed && rec.risk_factors_addressed.length > 0) {
        const factors = document.createElement("div");
        factors.style.cssText = `
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        `;

        factors.innerHTML = `<strong style="margin-right: 8px;">Addresses:</strong>`;

        rec.risk_factors_addressed.forEach((factor) => {
          const factorTag = document.createElement("span");
          factorTag.textContent = factor;
          factorTag.style.cssText = `
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
          `;
          factors.appendChild(factorTag);
        });

        recCard.appendChild(factors);
      }

      recCard.appendChild(recHeader);
      recCard.appendChild(description);
      recCard.appendChild(reason);

      content.appendChild(recCard);
    });
  } else {
    const noResults = document.createElement("div");
    noResults.style.cssText = `
      text-align: center;
      padding: 40px 20px;
      color: #6c757d;
    `;
    noResults.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
      <h4 style="margin: 0 0 8px 0; color: #495057;">No Specific Actions Recommended</h4>
      <p style="margin: 0;">The contractor's current access level appears appropriate for their role.</p>
    `;
    content.appendChild(noResults);
  }

  // Footer
  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 20px 24px;
    border-top: 1px solid #e9ecef;
    text-align: right;
  `;

  const closeButton2 = document.createElement("button");
  closeButton2.textContent = "Close";
  closeButton2.style.cssText = `
    background: #6c757d;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton2.onmouseover = () => (closeButton2.style.background = "#5a6268");
  closeButton2.onmouseout = () => (closeButton2.style.background = "#6c757d");

  footer.appendChild(closeButton2);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(content);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  // Add to page
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden"; // Prevent scrolling behind modal

  // Close functionality
  const closeModal = () => {
    document.body.removeChild(overlay);
    document.body.style.overflow = ""; // Restore scrolling
    document.head.removeChild(style); // Clean up styles
  };

  closeButton.addEventListener("click", closeModal);
  closeButton2.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Close with Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// Helper function for priority colors
function getPriorityColor(priority) {
  switch (priority.toLowerCase()) {
    case "high":
      return "#dc3545";
    case "medium":
      return "#ffc107";
    case "low":
      return "#28a745";
    default:
      return "#6c757d";
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", loadContractors);
