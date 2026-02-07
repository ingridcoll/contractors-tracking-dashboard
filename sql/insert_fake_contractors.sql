INSERT INTO contractors (
    id,
    name,
    email,
    job_title,
    last_sign_in,
    application,
    project_description,
    project_role,
    access_level,
    contract_start,
    contract_end,
    has_prod_access
) VALUES
(
    'ctr-001',
    'Alex Martinez',
    'alex.martinez@freelance.dev',
    'Backend Engineer',
    '2026-01-28',
    'GitHub',
    'Build and maintain REST APIs for identity provisioning and lifecycle events.',
    'API Development',
    'Full Access',
    '2025-06-01',
    '2026-06-01',
    true
),
(
    'ctr-002',
    'Priya Shah',
    'priya.shah@cloudops.io',
    'Cloud Infrastructure Consultant',
    '2026-01-30',
    'AWS Console',
    'Design and optimize cloud infrastructure, IAM policies, and monitoring.',
    'Cloud Architecture',
    'Read and Write',
    '2025-09-15',
    '2026-03-15',
    true
),
(
    'ctr-003',
    'Michael O’Connor',
    'm.oconnor@datawise.co',
    'Data Analyst',
    '2026-01-20',
    'Quickbooks',
    'Create dashboards and reports for customer usage and churn analysis.',
    'Reporting and Insights',
    'Read',
    '2025-11-01',
    '2026-05-01',
    false
),
(
    'ctr-004',
    'Sofia Nguyen',
    'sofia.nguyen@uxstudio.com',
    'UX Designer',
    '2026-01-10',
    'Figma',
    'Redesign onboarding flows and update shared component library.',
    'UX/UI Design',
    'Read and Write',
    '2025-10-01',
    '2026-02-28',
    false
),
(
    'ctr-005',
    'Daniel Brooks',
    'daniel.brooks@secconsult.net',
    'Security Consultant',
    '2026-01-29',
    'AWS Console',
    'Conduct security review, penetration testing, and access audits.',
    'Security Assessment',
    'Read',
    '2025-12-01',
    '2026-01-31',
    false
),
(
    'ctr-006',
    'Vendor: Zendesk',
    'support@zendesk.com',
    'Customer Support Specialist',
    '2026-01-31',
    'ServiceNow',
    'Provide ticketing, customer support workflows, and SLA reporting.',
    'Third-Party SaaS Vendor',
    'Read',
    '2024-01-01',
    '2027-01-01',
    false
),
-- INACTIVE USER WITH ACTIVE CONTRACT
(
    'ctr-007',
    'Emily Carter',
    'emily.carter@freelance.pm',
    'Project Manager',
    '2025-09-10',
    'Notion',
    'Coordinate contractor timelines and milestone delivery.',
    'Project Coordination',
    'Read and Write',
    '2025-07-01',
    '2026-07-01',
    false
),

-- EXPIRED CONTRACT BUT STILL HAS PROD ACCESS
(
    'ctr-008',
    'Ryan Patel',
    'ryan.patel@devopsnow.io',
    'DevOps Engineer',
    '2026-01-25',
    'Production Kubernetes Cluster',
    'Maintain CI/CD pipelines and production deployments.',
    'DevOps Operations',
    'Full Access',
    '2024-01-01',
    '2025-12-31',
    true
),

-- OVER-PERMISSIONED READ-ONLY ROLE
(
    'ctr-009',
    'Laura Kim',
    'laura.kim@auditpartners.com',
    'Compliance Auditor',
    '2026-01-15',
    'AWS Console',
    'Review access logs and compliance reports for SOC 2 audits.',
    'Compliance Review',
    'Full Access',
    '2025-10-01',
    '2026-04-01',
    false
),

-- PROD ACCESS FOR NON-TECHNICAL ROLE
(
    'ctr-010',
    'Marcus Allen',
    'marcus.allen@contentstudio.io',
    'Technical Writer',
    '2026-01-27',
    'AWS Console',
    'Document internal admin workflows and customer-facing APIs.',
    'Documentation',
    'Read',
    '2025-11-15',
    '2026-05-15',
    true
),

-- EXPIRED CONTRACT AND NO RECENT SIGN-IN
(
    'ctr-011',
    'Hannah Lee',
    'hannah.lee@marketingops.co',
    'Marketing Operations Consultant',
    '2025-08-01',
    'HubSpot',
    'Optimize campaign workflows and attribution tracking.',
    'Marketing Automation',
    'Read and Write',
    '2025-03-01',
    '2025-09-01',
    false
),

-- THIRD-PARTY VENDOR WITH WRITE ACCESS
(
    'ctr-012',
    'Vendor: LogPulse',
    'support@logpulse.io',
    'Logging and Monitoring Vendor',
    '2026-01-26',
    'GitHub',
    'Ingest and store application logs for monitoring and alerting.',
    'Third-Party SaaS Vendor',
    'Read and Write',
    '2024-06-01',
    '2027-06-01',
    false
),

-- ACTIVE CONTRACT, NO SIGN-IN EVER
(
    'ctr-013',
    'Noah Williams',
    'noah.williams@integrationlabs.dev',
    'Integration Engineer',
    NULL,
    'GitHub',
    'Build and test partner integrations using sandbox and production APIs.',
    'Systems Integration',
    'Read and Write',
    '2026-01-01',
    '2026-12-31',
    false
);
