# Payment Configuration Guide

This guide explains where to configure payment-related settings including wallet addresses and UPI ID.

## Environment Variables

All payment configuration is done through environment variables in your `.env.local` or `.env` file.

### USDT Wallet Addresses

Configure USDT wallet addresses for cryptocurrency payments:

```env
# USDT ERC20 Wallet Address (Ethereum network)
NEXT_PUBLIC_USDT_ERC20_ADDRESS=your_erc20_wallet_address_here

# USDT TRC20 Wallet Address (TRON network)
NEXT_PUBLIC_USDT_TRC20_ADDRESS=your_trc20_wallet_address_here
```

**Location in Code:** `src/components/payment/Stage5_FinalPayment.tsx` (lines 13-14)

### UPI ID Configuration

Configure UPI ID for UPI payments:

```env
# UPI ID for UPI payments
NEXT_PUBLIC_UPI_ID=your_upi_id@paytm
```

**Location in Code:** `src/components/payment/Stage5_FinalPayment.tsx` (line 15)

**Note:** The UPI ID will be displayed along with the QR code on the payment page when users select UPI as their payment method.

### Other Payment Configuration

```env
# USD to INR Exchange Rate (default: 83)
NEXT_PUBLIC_USD_TO_INR_RATE=89

# USDT Wallet App Deep Link (optional)
NEXT_PUBLIC_USDT_WALLET_APP_LINK=https://your-wallet-app-link.com
```

## How to Update Configuration

1. **Locate your `.env.local` file** in the root directory of your project
2. **Add or update** the environment variables listed above
3. **Restart your development server** for changes to take effect:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Where These Are Used

- **USDT Wallet Addresses:** Displayed on the final payment step (Stage 5) when users select USDT_ERC20 or USDT_TRC20 payment method
- **UPI ID:** Displayed on the final payment step (Stage 5) when users select UPI payment method, shown below the QR code
- **Exchange Rate:** Used to calculate INR equivalent amounts throughout the payment flow

## Important Notes

- All environment variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser
- After updating environment variables, you must restart your development server
- For production deployments, ensure these environment variables are set in your hosting platform's environment configuration

