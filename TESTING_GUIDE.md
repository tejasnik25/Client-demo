# API Testing Guide for Copy Trading System

This guide explains how to test the newly implemented API connections for Master/Slave account validation, strategy creation, and real-time copy trading simulation.

## Prerequisites

1.  **Directory**: Make sure you are in the `Client-demo` directory.
    ```bash
    cd Client-demo
    ```
2.  **Dependencies**: Install dependencies if you haven't already.
    ```bash
    npm install
    ```
3.  **Database**: Ensure your MySQL database is running and accessible. The application will automatically attempt to create/update tables on startup, but you can also manually run `database_setup.sql` if needed.
4.  **Environment**: Ensure your `.env` file has the correct `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` set up. (Defaults: localhost, root, admin, stock_analysis_db).
5.  **Run Application**:
    ```bash
    npm run dev
    ```

## 1. Admin: Create Strategy with Master Account

**Endpoint**: `PUT /api/strategies` (or `POST` depending on how the frontend calls it, currently the code supports `PUT` for creation/update based on ID presence, but `createStrategy` is internal. The route usually handles POST/PUT. *Note: Check `src/app/api/strategies/route.ts` to confirm method, usually POST for creation.*)

**Test Steps (using Postman or cURL):**

*   **URL**: `http://localhost:3000/api/strategies`
*   **Method**: `POST` (assuming you have a POST handler, or use the UI)
*   **Headers**: `Content-Type: application/json`
*   **Body**:
    ```json
    {
      "name": "Super Profit Strategy",
      "description": "High risk high reward",
      "masterAccountId": "123456",
      "masterAccountPassword": "master_password",
      "masterAccountServer": "Vantage-Server",
      "masterPlatform": "MT5",
      "planPrices": { "Pro": 100 },
      "details": "Strategy details..."
    }
    ```
*   **Expected Result**: Strategy created in `strategies` table with Master account details.

## 2. User: Purchase Strategy (Simulate Payment)

Since we are testing APIs, we can simulate the payment flow which eventually calls the approval API.

1.  **User UI**: Go to `/plan-usage/new-strategy/pending-new-strategy`.
2.  **Action**: Submit a payment. This creates a `wallet_transaction` with status `pending`.
3.  **DB Verification**: Check `wallet_transactions` table for the new record. Note the `id`.

## 3. Admin: Approve Payment & Trigger Validation

This is the critical step where the API triggers MT validation.

**Endpoint**: `POST /api/admin/payments/[TRANSACTION_ID]/approve`

**Test Steps:**

*   **URL**: `http://localhost:3000/api/admin/payments/YOUR_TRANSACTION_ID/approve`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` (Ensure you are logged in as Admin or have valid session cookies if testing via browser/Postman with auth).
*   **Scenario A: Success**
    *   Ensure the transaction in DB has valid `mt_account_id` (e.g., "1001") and `mt_account_password` (not "wrong").
    *   **Response**: `200 OK`, JSON `{ success: true, ... }`.
    *   **DB Check**:
        *   `running_strategies` table: New row with `admin_status = 'running'`.
        *   `running_strategy_modifications`: New row with `status = 'running'`.
        *   Console Logs: You should see "[MT5 Service] Starting Copy Trading..." in the server terminal.

*   **Scenario B: Validation Error (Wrong Password)**
    *   **Setup**: Update the transaction in DB (or create new) with `mt_account_password = 'wrong'`.
    *   **Send Request**.
    *   **Response**: `200 OK` (Payment approved), but...
    *   **DB Check**:
        *   `running_strategies` table: `admin_status = 'wrong-account-password'`.
        *   `running_strategy_modifications`: New row with `status = 'wrong-account-password'`.

## 4. User: Fix Credentials (Modification)

If Scenario B occurred, the user needs to update credentials.

**Endpoint**: `POST /api/running-strategies/[RUNNING_STRATEGY_ID]/modification`

**Test Steps:**

*   **URL**: `http://localhost:3000/api/running-strategies/YOUR_RUNNING_STRATEGY_ID/modification`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "mt_account_id": "1001",
      "mt_account_password": "correct_password",
      "mt_account_server": "Vantage-Server",
      "platform": "MT5"
    }
    ```
*   **Expected Result**:
    *   JSON `{ success: true, status: 'running' }`.
    *   `running_strategies` table: `admin_status` updates to `'running'`.
    *   `running_strategy_modifications`: New row logged.
    *   Console Logs: "[MT5 Service] Starting Copy Trading..."

## 5. User: Disconnect Strategy

**Endpoint**: `POST /api/running-strategies/[RUNNING_STRATEGY_ID]/modification`

**Body**:
```json
{
  "action": "disconnect"
}
```

*   **Expected Result**: `admin_status` becomes `'disconnected'`.

## Notes on "Real-Time" & Microservices

*   **Simulation**: The `src/lib/mt5-service.ts` file currently simulates the connection. In a real production environment, you would replace the code inside `validateConnection` and `startCopyTrading` with HTTP calls to your actual Trading Engine (e.g., a Python/C++ microservice running close to the exchange/broker).
*   **Database**: All status changes are committed to MySQL immediately. External services can poll the `running_strategies` table or listen for webhook events (if you implement them) to sync state.
