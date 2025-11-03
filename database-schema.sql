-- ProofPay MVP Database Schema for Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    wallet_address VARCHAR(42),
    username VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    total_transactions INT DEFAULT 0,
    successful_transactions INT DEFAULT 0,
    dispute_count INT DEFAULT 0,
    reputation_score DECIMAL(3,2) DEFAULT 5.00,
    is_verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Table: escrows
CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id VARCHAR(66) UNIQUE NOT NULL, -- blockchain escrow ID
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    buyer_phone VARCHAR(20) NOT NULL,
    seller_phone VARCHAR(20) NOT NULL,
    buyer_wallet VARCHAR(42),
    seller_wallet VARCHAR(42) NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    status VARCHAR(20) NOT NULL, -- CREATED, FUNDED, COMPLETED, DISPUTED, REFUNDED, CANCELLED
    item_description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    funded_at TIMESTAMP,
    completed_at TIMESTAMP,
    auto_release_time TIMESTAMP,
    dispute_raised BOOLEAN DEFAULT FALSE,
    dispute_raised_by UUID REFERENCES users(id),
    dispute_raised_at TIMESTAMP,
    tx_hash VARCHAR(66), -- funding transaction hash
    release_tx_hash VARCHAR(66), -- release transaction hash
    CONSTRAINT check_status CHECK (status IN ('CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED'))
);

CREATE INDEX idx_escrows_buyer ON escrows(buyer_id);
CREATE INDEX idx_escrows_seller ON escrows(seller_id);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_escrow_id ON escrows(escrow_id);

-- Table: disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    raised_by UUID REFERENCES users(id),
    reason VARCHAR(50) NOT NULL, -- NOT_RECEIVED, NOT_AS_DESCRIBED, PAYMENT_ISSUE, OTHER
    description TEXT,
    evidence_urls TEXT[], -- IPFS URLs
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, UNDER_REVIEW, RESOLVED
    resolution TEXT,
    resolved_by VARCHAR(100), -- arbitrator identifier
    resolved_at TIMESTAMP,
    buyer_percentage INT, -- 0-100, percentage awarded to buyer
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_reason CHECK (reason IN ('NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'PAYMENT_ISSUE', 'OTHER')),
    CONSTRAINT check_dispute_status CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED'))
);

CREATE INDEX idx_disputes_escrow ON disputes(escrow_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Table: transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    type VARCHAR(20) NOT NULL, -- CREATE, FUND, RELEASE, DISPUTE, RESOLVE
    tx_hash VARCHAR(66),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    amount DECIMAL(20,6),
    gas_used VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, FAILED
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    CONSTRAINT check_tx_type CHECK (type IN ('CREATE', 'FUND', 'RELEASE', 'DISPUTE', 'RESOLVE')),
    CONSTRAINT check_tx_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

CREATE INDEX idx_transactions_escrow ON transactions(escrow_id);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);

-- Table: messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    from_phone VARCHAR(20) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL, -- ESCROW_CREATED, PAYMENT_REQUEST, PAYMENT_RECEIVED, etc.
    message_body TEXT NOT NULL,
    whatsapp_message_id VARCHAR(100),
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_messages_escrow ON messages(escrow_id);
CREATE INDEX idx_messages_from ON messages(from_phone);

