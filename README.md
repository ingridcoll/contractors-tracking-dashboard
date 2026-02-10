# Contractors Access Levels and Risk Dashboard

I created this project to practice event-driven architecture and my AWS skills. I decided to create a simple fullstack application showing a dashboard of contractors and third-party employees for a **fake company**. It analyzes permissions, production access, and activity patterns to generate security recommendations.

![ezgif-1966c3c741d0d035](https://github.com/user-attachments/assets/ae3329ea-4d9b-4f50-8788-3eaa858aa5b7)

## Technologies Used

- **Backend Logic**: AWS Lambda, Node.js and JavaScript
- **Data storage and Deployment**: Amazon S3 and Amazon RDS (PostgreSQL)
- **API**: AWS API Gateway
- **LLM Integration**: Google Gemini
- **Frontend**: HTML, CSS and JavaScript

<img width="1420" height="1135" alt="Untitled-2026-02-10-1643(1)" src="https://github.com/user-attachments/assets/9bad12c5-5b93-41c2-b0df-27ed2dec4566" />

## Learning Resources Used for this Project

- Text: [Amazon Web Services Documentation](https://docs.aws.amazon.com/)
- Video: [AWS FULL STACK TUTORIAL | Build and Deploy Your First App on AWS (Beginner Friendly!)](https://www.youtube.com/watch?v=ADDG7LLS5IM) by Darla David
- DeepSeek

## Basic Concepts Before Starting

The key to serverless apps is **event-driven architecture**.

**Event-driven architecture (EDA)** is a modern architecture pattern built from small, decoupled services that publish, consume, or route events. Events are messages sent between services. This architecture makes it easier to scale, update, and independently deploy separate components of a system.

Commonly used AWS services in serverless applications:

- **Compute**: Lambda
- **Data storage**: Amazon S3, DynamoDB, Amazon RDS
- **API**: API Gateway
- **Application integration**: EventBridge, Amazon SNS, Amazon SQS
- **Orchestration**: Step Functions
- **Streaming data and analytics**: Amazon Data Firehose

## Phase 0: Setting Up the Local Development Environment for AWS

1. Installed the **AWS Toolkit** extension for Visual Studio Code.
2. Downloaded and installed the **AWS SAM CLI** tool.
3. Downloaded and installed **Docker** for local testing.
4. In Visual Studio Code, I selected the **AWS Toolkit** extension and authenticated my account through SSO.

## Phase 1: Creating the Database (AWS RDS + PostgreSQL)

### Amazon Web Services: Relational Database Service (RDS)

**AWS Relational Database Service (RDS)** is a managed service that allows you to set up, operate, and scale a relational database in the cloud. Amazon RDS can automatically back up your database and keep your database software up to date with the latest version. You are also able to scale the compute resources or storage capacity associated with your relational database instance. In addition, Amazon RDS uses replication to enhance database availability, improve data durability, or scale beyond the capacity constraints of a single database instance for read-heavy database workloads.

I'm using AWS RDS for this project to host my database in the cloud, so it can communicate with the project's APIs.

#### This is how I configured AWS RDS for PostgreSQL:

1. In AWS Console, searched **RDS** and selected **Aurora and RDS**.
2. Clicked on **Create a database**.
3. Under **Engine type**, selected **PostgreSQL**.
4. As for the **DB instance size**, since this is a demo project, I selected the **Free tier**.
5. Entered _contractors-fakecompany-db_ as the **DB instance identifier**.
6. Set up PostgreSQL database credentials and stored them securely in my password manager.
7. Clicked on **Create database**.
8. After creation, selected **Modify**, scrolled to the **Connectivity** menu -> **Additional configuration**, and enabled **Publicly accessible**. RDS assigns a public IP address to the database. Amazon EC2 instances and other resources outside of the VPC can connect to your database. Resources inside the VPC can also connect to the database. VPC security groups specify which resources can connect to the database.

#### Database security best practices:

Updated **security group rules** for this database.

1. In AWS, selected the database and scrolled to **Security group rules**.
2. Clicked on the **Inbound** security group, and selected **Edit inbound rules**.
3. Deleted default rule and created a new one.
4. Selected **All traffic** under **Type** and **My IP** as the **Source**. This way, only my laptop can connect to the database when developing the rest of the project.

### Creating the Main Table in PostgreSQL

#### Connecting my local database management system to the AWS RDS database instance

1. In **pgAdmin**, selected **Add new server**.
2. In the **General** tab, I gave it a descriptive name.
3. In the **Connection** tab, I added the **Endpoint** address from the database instance **Endpoints** menu in AWS (usually ends with _us-east-1.rds.amazonaws.com_). I also added the **port** mentioned in the same screen, and I entered the credentials I created when setting up the database in AWS.

#### Creating and populating the _contractors_ table

The database mainly holds all contractors and third-party employees for a fake company. I ran this SQL command to create a _contractors_ table that holds log-in and access levels information by application for each contractor, adding some built-in data validation:

```sql
CREATE TABLE contractors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    last_sign_in DATE,
    application VARCHAR(100) NOT NULL,
    project_description TEXT,
    project_role VARCHAR(100),
    access_level VARCHAR(50),
    contract_start DATE,
    contract_end DATE,
    has_prod_access BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

I then prompted ChatGPT to generate fake and consistent data and used the `INSERT INTO contractors` command to populate the database.

To assign a deterministic risk score to each contractor and third-party vendor, I created a SQL function. Initially, I was considering delegating this task to a Lambda function, but I opted to implement it on the SQL side for two reasons: less computing power and API calls, and table logic stays in the database. That way, Lambda's role is to just query the table.

```sql
-- SQL function that calculates a risk score (0-100) for each contractor or third-party vendor, and captures each score's reasoning
CREATE OR REPLACE FUNCTION calculate_contractor_risk_score(
	contractor_id VARCHAR(50)
) RETURNS TABLE (
	risk_score INTEGER, -- 0-100 points of "risk level"
	risk_factors JSONB, -- Reasoning behind score
	calculation_details TEXT
) AS $$
DECLARE
    score INTEGER := 0; -- Start with lowest score
	factors JSONB := '[]'::JSONB;
	details TEXT := '';
	contractor_data RECORD;
	days_inactive INTEGER;
	days_remaining_in_contract INTEGER;
BEGIN
    -- Fetch contractors table
    SELECT * INTO contractor_data
	FROM contractors
	WHERE id = contractor_id; -- Match with contractor id

	-- If contractor doesn't exist, return null
	IF NOT FOUND THEN
		RETURN NEXT;
	END IF;

	-- Calculate days since last sign-in
	IF contractor_data.last_sign_in IS NOT NULL THEN
		days_inactive := CURRENT_DATE - contractor_data.last_sign_in;
	ELSE
		days_inactive := NULL;
	END IF;

	-- Calculate days until contract ends
	IF contractor_data.contract_end IS NOT NULL THEN
		days_remaining_in_contract := contractor_data.contract_end - CURRENT_DATE;
	ELSE
		days_remaining_in_contract := NULL;
	END IF;

	-- Risk Factor 1: Contract has ended or end date is near
	IF days_remaining_in_contract IS NULL THEN
		-- No contract end date
		factors := factors || jsonb_build_object(
        	'factor', 'contract',
        	'weight', 0,
        	'reason', 'No contract end date specified'
    	);
	ELSIF days_remaining_in_contract < 0 THEN
		score := score + 50;
		factors := factors || jsonb_build_object(
        	'factor', 'contract',
        	'weight', 50,
        	'reason', format('Contract expired %s days ago', ABS(days_remaining_in_contract))
    	);
	ELSIF days_remaining_in_contract = 0 THEN
		score := score + 40;
		factors := factors || jsonb_build_object(
        	'factor', 'contract',
        	'weight', 40,
        	'reason', 'Contract expires today'
    	);
	ELSIF days_remaining_in_contract <= 7 THEN
		score := score + 30;
		factors := factors || jsonb_build_object(
        	'factor', 'contract',
        	'weight', 30,
        	'reason', format('Contract expires in %s days', days_remaining_in_contract)
    	);
	END IF;

	-- Risk Factor 2: High access level (Read and Write or Full Access)
	IF contractor_data.access_level = 'Full Access' THEN
		score := score + 20;
		factors := factors || jsonb_build_object(
        	'factor', 'access level',
        	'weight', 20,
        	'reason', 'Has full access level'
    	);
	ELSIF contractor_data.access_level = 'Read and Write' THEN
		score := score + 10;
		factors := factors || jsonb_build_object(
        	'factor', 'access level',
        	'weight', 10,
        	'reason', 'Has read and write access level'
    	);
	END IF;

	-- Risk Factor 3: Has production access
	IF contractor_data.has_prod_access IS NOT NULL AND contractor_data.has_prod_access IS TRUE THEN
		score := score + 20;
		factors := factors || jsonb_build_object(
        	'factor', 'access to production',
        	'weight', 20,
        	'reason', 'Has access to production environment'
    	);
	END IF;

	-- Risk Factor 4: Inactivity, does contractor still need access to this application?
	IF days_inactive IS NULL THEN
		-- Contractor has not signed into this application yet
		score := score + 5;
		factors := factors || jsonb_build_object(
        	'factor', 'inactivity',
        	'weight', 5,
        	'reason', 'Has never signed in'
    	);
	ELSIF days_inactive > 90 THEN
		score := score + 10;
		factors := factors || jsonb_build_object(
        	'factor', 'inactivity',
        	'weight', 10,
        	'reason', format('Inactive for %s days (90+ days threshold)', days_inactive)
    	);
	ELSIF days_inactive > 60 THEN
		score := score + 5;
		factors := factors || jsonb_build_object(
        	'factor', 'inactivity',
        	'weight', 5,
        	'reason', format('Inactive for %s days (60-90 days)', days_inactive)
    	);
	END IF;

    risk_score := LEAST(GREATEST(score, 0), 100);
	risk_factors := factors;
	calculation_details := format('Total risk score: %s/100 from %s factors',
                                 risk_score, jsonb_array_length(factors));
	RETURN NEXT;

END;
$$ LANGUAGE plpgsql;
```

## Phase 2: Building the Backend (AWS Lambda Functions with Node.js & JavaScript + AWS API Gateway)

### Amazon Web Services: Lambda Functions

**AWS Lambda** is a compute service that runs code without the need to manage servers. Your code runs, scaling up and down automatically, with pay-per-use pricing.

When using Lambda, you are responsible only for your code. Lambda runs your code on a high-availability compute infrastructure and manages all the computing resources, including server and operating system maintenance, capacity provisioning, automatic scaling, and logging.

Because Lambda is a serverless, event-driven compute service, it uses a different programming paradigm than traditional web applications. The following model illustrates how Lambda works:

- You write and organize your code in **Lambda functions**, which are the basic building blocks you use to create a Lambda application.
- You control security and access through **Lambda permissions**, using execution roles to manage what AWS services your functions can interact with and what resource policies can interact with your code.
- Event sources and AWS services **trigger** your Lambda functions, passing event data in JSON format, which your functions process (this includes event source mappings).
- Lambda runs your code with language-specific runtimes (like Node.js and Python) in execution environments that package your runtime, layers, and extensions.

Event-driven architectures can also make it easier to design near-real-time systems, helping organizations move away from batch-based processing.

Features relevant to this project:

- **Environment variables** modify application behavior without new code deployments.
- **Versions** safely test new features while maintaining stable production environments.
- **Lambda layers** optimize code reuse and maintenance by sharing common components across multiple functions.
- **Code signing** enforce security compliance by ensuring only approved code reaches production systems.

#### The Lambda programming model

Essential to this model is the **handler**, where Lambda sends events to be processed by your code. Think of it as the entry point to your code. When Lambda receives an event, it passes this event and some **context** information to your handler. The handler then runs your code to process these events - for example, it might read a file when it's uploaded to Amazon S3, analyze an image, or update a database. Once your code finishes processing an event, the handler is ready to process the next one.

**Standard Functions** (up to 15 minutes):

1. Initialization: Environment setup and code loading
2. Invocation: Single execution of function code
3. Shutdown: Environment cleanup

Lambda supports two methods of invocation in event-driven architectures:

- **Direct invocation (push method)**: AWS services trigger Lambda functions directly. For example, Amazon S3 triggers a function when a file is uploaded or API Gateway triggers a function when it receives an HTTP request.
- **Event source mapping (pull method)**: Lambda retrieves events and invokes functions. For example, Lambda retrieves messages from an Amazon SQS queue and invokes a function or Lambda reads records from a DynamoDB stream and invokes a function.

#### Lambda best practices checklist:

For standard Lambda functions, you should assume that the environment exists only for a **single invocation**. The function should initialize any required state when it is first started. For example, your function may require fetching data from a DynamoDB table. It should commit any permanent data changes to a durable store such as Amazon S3, DynamoDB, or Amazon SQS before exiting. It should not rely on any existing data structures or temporary files, or any internal state that would be managed by multiple invocations.

Most architectures should prefer **many**, **shorter** functions over fewer, larger ones. The purpose of each function should be to **handle the event passed into the function**, with no knowledge or expectations of the overall workflow or volume of transactions. This makes the function agnostic to the source of the event with minimal coupling to other services.

Any **global-scope constants** that change infrequently should be implemented as **environment variables** to allow updates without deployments. Any **secrets** or **sensitive information** should be stored in AWS Systems Manager Parameter Store or AWS Secrets Manager and loaded by the function. Since these resources are account-specific, you can create build pipelines across multiple accounts. The pipelines load the appropriate secrets per environment, without exposing these to developers or requiring any code changes.

Many traditional systems are designed to run periodically and process batches of transactions that have built up over time. For example, a banking application may run every hour to process ATM transactions into central ledgers. In Lambda-based applications, the custom processing should be **triggered by every event**, allowing the service to scale up concurrency as needed, to provide near-real time processing of transactions.

Workflows that involve branching logic, different types of failure models, and retry logic typically use an orchestrator to keep track of the state of the overall execution. Don't build ad-hoc orchestration in standard Lambda functions. This results in tight coupling, complex routing code, and no automatic state recovery. Instead, use one of these purpose-built orchestration options:

- **Lambda durable functions**: Application-centric orchestration using standard programming languages with automatic checkpointing, built-in retry, and execution recovery. Ideal for developers who prefer keeping workflow logic in code alongside business logic within Lambda.
- **AWS Step Functions**: Visual workflow orchestration with native integrations to 220+ AWS services. Ideal for multi-service coordination, zero-maintenance infrastructure, and visual workflow design.

AWS serverless services, including Lambda, are fault-tolerant and designed to handle failures. For example, if a service invokes a Lambda function and there is a service disruption, Lambda invokes your function in a different Availability Zone. If your function throws an error, Lambda retries the invocation. Since the same event may be received more than once, functions should be designed to be **idempotent**. This means that receiving the same event multiple times does not change the result beyond the first time the event was received.

### Creating the First Lambda function: getContractorsWithRiskScores

This function will handle fetching the _contractors_ table from AWS RDS and executing the SQL function to calculate contractors' risk score based on their contract, application access, access level, and last sign in.

1. From the AWS console, searched **Lambda** and clicked on its icon.
2. From the Lambda page, clicked on **Create function**.
3. Selected **Author from scratch**, and **nodejs24.x** as the runtime.
4. Lastly, selected **Create function**.

Once created, I increased the function's timeout value to 30 seconds, to allow more time to connect to AWS RDS.

To connect the Lambda function to the AWS RDS:

1. I used environment variables to store the database host, user and password.
2. I added the Lambda function to the same VPC (Virtual Private Cloud) and subnet groups as the AWS RDS.
3. Under **Configuration**, I selected **Permissions** and clicked on the function's **Role name**. Then, I added the policy **AWSLambdaVPCAccessExecutionRole**, which allows the Lambda resource to connect to services in the same VPC.

As for the code, the Lambda function's purpose is to fetch all rows in the _contractors_ table from AWS RDS, and call the SQL function _calculate_contractor_risk_score_ I created in Phase 1.

```js
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
```

I then deployed the function.

### Creating the Second Lambda function: generateRecommendedActions

The Lambda function _generateRecommendedActions_ extracts the specific contractor's data from the user's request and feeds it to Google Gemini. Then, the LLM generates a structured JSON response that lists 1 to 3 recommended actions to take to reduce the contractor's risk level.

I followed the same steps as above to create this function, except I did not need to add this Lambda function to the AWS RDS VPC, since it is not connecting to the database.

I added my Google Gemini API key in the function's **environment variables**.

The prompt for Google Gemini is built with dynamic data from the request:

```js
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
```

The response from the LLM is then parsed, and returned to the client.

```js
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
```

### Amazon Web Services: API Gateway

As explained in the AWS documentation, API Gateway creates RESTful APIs that:

1. Are HTTP-based.
2. Enable stateless client-server communication.
3. Implement standard HTTP methods such as GET, POST, PUT, PATCH, and DELETE.

For each endpoint and method, the API Gateway can call one or the other Lambda functions I created above. For this project, the API Gateway calls:

- **getContractorsWithRiskScores** through the endpoint _GET /contractors_.
- **generateRecommendedActions** through the endpoint _POST /contractors/{contractor_id}/actions_.

Now the frontend can call the API Gateway, and each call will be routed to the correct Lambda function.

## Phase 3: The Frontend (HTML, CSS, JavaScript and Amazon S3)

The frontend is pretty simple. I created a simple HTML table to hold the _contractors_ data and I prompted DeepSeek to create a simple CSS stylesheet.

I deployed the static .js, .html and .css files to an Amazon S3 bucket:
1. From the AWS console, I selected **Amazon S3** and clicked on **Create bucket**
2. I then uploaded all the frontend files into that bucket.
3. Then, I navigated to **AWS Cloudfront** and selected **Create distribution**.
4. After choosing my Amazon S3 bucket, the dashboard was live.
