import { Pool } from "pg";

let pool;

/*
Initialize PostgreSQL pool to 
establish connection with the DB:
*/
async function initializePool() {
  try {
    return new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false, // For production, I would generate a SSL certificate and add it as a Lambda layer
      },
      max: 20,
      idleTimeoutMillis: 30000,
    });
  } catch (error) {
    console.error("Failed to initialize database pool: ", error);
    throw error;
  }
}

/*
Queries the table "contractors" and
the SQL function that calculates
the risk score for each contractor:
*/
export const handler = async (event) => {
  if (!pool) {
    pool = await initializePool();
  }

  const method = event.requestContext?.http?.method;
  const path = event.requestContext?.http?.path;

  if (method === "GET" && path === "/contractors") {
    try {
      const contractors = await pool.query(`
        SELECT 
          c.id,
          c.name,
          c.email,
          c.job_title,
          c.project_description,
          c.project_role,
          c.application,
          c.last_sign_in,
          c.access_level,
          c.contract_start,
          c.contract_end,
          c.has_prod_access,
          c.actions_required,
          c.updated_at,
          risk.risk_score,
          risk.risk_factors,
          risk.calculation_details
      FROM contractors c
      LEFT JOIN LATERAL calculate_contractor_risk_score(c.id) as risk ON true
      ORDER BY id ASC;
      `);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          success: true,
          count: contractors.rowCount,
          contractors: contractors.rows,
          generatedAt: new Date().toISOString(),
        }),
      };
    } catch (error) {
      console.error("Database query error: ", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Internal server error",
          details: error.message,
        }),
      };
    }
  }
};
