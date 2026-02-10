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