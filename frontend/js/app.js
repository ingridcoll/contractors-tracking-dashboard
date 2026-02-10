const API_URL =
  "https://8jm3og3pvg.execute-api.us-east-1.amazonaws.com/contractors";

fetch(API_URL)
  .then((res) => res.json())
  .then((data) => {
    const tbody = document.querySelector("#contractors-table tbody");
    tbody.innerHTML = "";

    data.contractors.forEach((contractor) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${contractor.name}</td>
        <td>${formatDate(contractor.last_sign_in)}</td>
        <td>${formatDate(contractor.contract_end)}</td>
        <td>${contractor.has_prod_access ? "Yes" : "No"}</td>
        <td>${contractor.risk_score}</td>
      `;

      tbody.appendChild(tr);
    });
  })
  .catch((err) => {
    console.error("Failed to load contractors:", err);
  });

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
}
