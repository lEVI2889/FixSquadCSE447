# FixSquad Security Evolution Project (CSE447)

FixSquad is a secure service portfolio marketplace. This project was retrofitted for the CSE447 Cryptography course to implement bespoke, from-scratch cryptographic engines to secure stationary data and communication channels.

## Core Cryptographic Features
- **Custom Hashing:** ARX PBKDF (Add-Rotate-XOR) for password hashing.
- **Two-Factor Authentication (2FA):** TOTP generation and verification from scratch.
- **Key Management Module (KMM):** AES-256-GCM wrapping of private keys.
- **RSA Engine:** 256-bit block-chunking RSA encryption for Service Listings (Dataset A).
- **ECC Engine:** 63-bit ElGamal-style field masking for In-Platform Messaging (Dataset B).
- **CBC-MAC Engine:** Custom SPN block cipher for messaging integrity.

## Prerequisites
- Node.js (v18+)
- MySQL (v9+)

## Setup Instructions

### 1. Database Setup
```bash
mysql -u root < database/migrations/security_evolution.sql
```

### 2. Backend Setup
```bash
cd backend
npm install
npm start
```
*Note: The backend runs on port 5001.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Note: The frontend runs on port 5173.*

## Project Structure
All custom security algorithms and engines are strictly isolated inside the `backend/security/` directory to maintain architectural separation from the standard marketplace controllers.
