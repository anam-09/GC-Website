CREATE TABLE IF NOT EXISTS service_enquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference_number VARCHAR(32) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(13) NOT NULL,
    service_type VARCHAR(40) NOT NULL CHECK (
        service_type IN (
            'AC Repair & Servicing',
            'Installation',
            'AMC',
            'AC Sales Enquiry'
        )
    ),
    ac_type VARCHAR(60) NOT NULL CHECK (
        ac_type IN (
            'Split AC',
            'Window AC',
            'Cassette AC',
            'Ductable AC',
            'Commercial system',
            'Not sure yet'
        )
    ),
    location VARCHAR(160) NOT NULL,
    preferred_date DATE NOT NULL,
    issue_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (
        status IN ('new', 'in_progress', 'closed')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
