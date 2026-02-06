# Contractors Access Levels and Risk Dashboard

Stack: S3 + API Gateway + Lambda (Node.js) + DynamoDB + Bedrock

## Phase 1: Setting Up the Database (AWS RDS + PostgreSQL)

### Amazon Web Services: Relational Database Service (RDS)

**AWS Relational Database Service (RDS)** is a managed service that allows you to set up, operate, and scale a relational database in the cloud. Amazon RDS can automatically back up your database and keep your database software up to date with the latest version. You are also able to scale the compute resources or storage capacity associated with your relational database instance. In addition, Amazon RDS uses replication to enhance database availability, improve data durability, or scale beyond the capacity constraints of a single database instance for read-heavy database workloads.

I'm using AWS RDS for this project to host my database in the cloud, so it can communicate with the project's APIs.

#### Configuring AWS RDS for PostgreSQL:

1. In AWS Console, search **RDS** and select **Aurora and RDS**.
2. Click on **Create a database**.
