# ProofPay MVP - WhatsApp-Native Escrow Service

A WhatsApp-native escrow service built on Base blockchain, enabling secure payments through simple WhatsApp messages.

## Features

- ✅ Create escrow transactions via WhatsApp
- ✅ Secure payments using USDC on Base blockchain
- ✅ Automatic payment monitoring
- ✅ Delivery confirmation and fund release
- ✅ Auto-release after 7 days
- ✅ Dispute resolution system
- ✅ WhatsApp notifications throughout the process

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Base (Ethereum L2)
- **Smart Contracts**: Solidity 0.8.19
- **WhatsApp**: Twilio WhatsApp Business API
- **IPFS**: Pinata for evidence storage
- **Hosting**: Vercel (serverless)
- **Monitoring**: Sentry

## Project Structure

```
tal3nt-escrow/
├── contracts/
│   └── Escrow.sol           # Smart contract
├── scripts/
│   └── deploy.ts            # Deployment script
├── src/
│   ├── api/                 # API endpoints
│   │   ├── webhook.ts
│   │   ├── escrow.ts
│   │   ├── payment.ts
│   │   └── dispute.ts
│   ├── services/            # Business logic
│   │   ├── blockchain.service.ts
│   │   ├── whatsapp.service.ts
│   │   ├── escrow.service.ts
│   │   ├── user.service.ts
│   │   ├── dispute.service.ts
│   │   └── ipfs.service.ts
│   ├── jobs/                # Cron jobs
│   │   ├── auto-release.ts
│   │   ├── payment-monitor.ts
│   │   └── delivery-reminder.ts
│   ├── config/              # Configuration
│   │   └── sentry.ts
│   └── contracts/           # Contract ABIs
│       ├── escrow.abi.json
│       └── addresses.ts
├── database-schema.sql      # Database schema
├── package.json
├── tsconfig.json
├── vercel.json
└── hardhat.config.ts
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file (see `.env.example`):

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Base Blockchain
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key
ESCROW_CONTRACT_ADDRESS=deployed_contract_address
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
BOT_PHONE_NUMBER=whatsapp:+14155238886

# IPFS
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret

# Sentry
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production

# App Config
PLATFORM_FEE_WALLET=your_fee_collector_address
```

### 3. Set Up Database

Run the SQL schema in Supabase SQL Editor:

```bash
cat database-schema.sql
# Copy and paste into Supabase SQL Editor
```

### 4. Deploy Smart Contract

```bash
# Install Hardhat dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Compile contracts
npx hardhat compile

# Deploy to Base Sepolia (testnet)
npx hardhat run scripts/deploy.ts --network base-sepolia

# Deploy to Base mainnet (when ready)
npx hardhat run scripts/deploy.ts --network base
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables on Vercel
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
# ... add all other env vars

# Deploy
vercel --prod
```

## Usage

### WhatsApp Commands

- **Create Escrow (Seller)**: `+2348123456789 50 iPhone case`
- **Confirm Delivery (Buyer)**: `confirm EP12345`
- **Raise Dispute**: `dispute EP12345 [reason]`
- **Check Status**: `status EP12345`
- **View History**: `history`
- **Help**: `help`

### API Endpoints

- `POST /api/webhook` - Twilio webhook for WhatsApp messages
- `POST /api/escrow/create` - Create new escrow
- `POST /api/escrow/release` - Release funds to seller
- `POST /api/payment/initiate` - Get payment instructions
- `POST /api/dispute/raise` - Raise a dispute

### Cron Jobs

- **Auto-Release**: Runs every 2 hours (`/api/jobs/auto-release`)
- **Payment Monitor**: Runs every 15 minutes (`/api/jobs/payment-monitor`)
- **Delivery Reminder**: Runs daily at 10 AM (`/api/jobs/delivery-reminder`)

## Smart Contract

The escrow contract handles:
- Escrow creation
- USDC funding
- Fund release (manual or auto-release)
- Dispute raising and resolution
- Platform fee collection (0.5%)

## Database Schema

- **users**: User accounts and wallet addresses
- **escrows**: Escrow transaction records
- **disputes**: Dispute cases
- **transactions**: Blockchain transaction history
- **messages**: WhatsApp message logs

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Testing

Test on Base Sepolia testnet first before deploying to mainnet.

## Security Notes

- Never expose private keys
- Use environment variables for all secrets
- Validate all user inputs
- Rate limit API endpoints
- Monitor for suspicious activity

## License

MIT
