import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Pool } from "pg";

// AWS Secrets Manager configuration
const secret_name = "dev/contractors-fakecompany-db";
const client = new SecretsManagerClient({
  region: "us-east-1",
});

let pool;

// Fetch database credentials for contractors-fakecompany-db form AWS Secrets Manager
async function initializePool() {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT",
      }),
    );

    const secret = JSON.parse(response.SecretString);

    if (
      !secret.host ||
      !secret.username ||
      !secret.password ||
      !secret.dbInstanceIdentifier ||
      !secret.port
    ) {
      throw new Error(
        "Missing required database credentials in AWS Secrets Manager",
      );
    }

    // Initialize database connection (AWS RDS)
    return new Pool({
      host: secret.host,
      port: secret.port,
      database: secret.dbInstanceIdentifier,
      user: secret.username,
      password: secret.password,
      max: 20, // Max. connections in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });
  } catch (error) {
    console.error("Failed to initialize database pool: ", error);
    throw error;
  }
}

export const handler = async (event, context) => {
  if (!pool) {
    pool = await initializePool();
  }

  try {
    const data = await pool.query(`SELECT * FROM contractors`);

    //c
    //LEFT JOIN LATERAL calculate_contractor_risk_score(c.id) as risk ON true
    //ORDER BY id ASC; c.id,
    // c.name,
    // c.last_sign_in,
    // c.contract_end,
    // c.has_prod_access,
    // risk.risk_score,
    // risk.risk_factors,
    // risk.calculation_details

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", //TODO: Add frontend origin
      },
      body: JSON.stringify({
        success: true,
        count: data.rowCount,
        contractors: data.rows,
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Database query error: ", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
