# Production Deployment Guide: MT5 Copy Trading System

This guide outlines the steps to deploy the Copy Trading System in a production environment, connecting a Vercel-hosted Next.js frontend with an AWS-hosted Python/MT5 backend.

## Architecture Overview

*   **Frontend (Vercel)**: Next.js application that manages user UI, payments, and strategy configuration.
*   **Backend (AWS Windows VPS)**: Python FastAPI service (`main.py`) that controls MetaTrader 5 terminals directly.
*   **Communication**: The Frontend sends HTTP requests to the Backend (Port 8000) to start/stop copy trading and check status.

---

## Step 1: AWS Windows VPS Configuration

The Python service **must** run on the same Windows machine as the MetaTrader 5 terminals because the `MetaTrader5` Python library requires a local IPC connection to the terminal.

### 1.1. Server Requirements
*   **OS**: Windows Server 2019 or 2022 (or Windows 10/11).
*   **Network**: Public Static IP (Elastic IP in AWS) is required.
*   **Firewall**: Allow **Inbound TCP Traffic on Port 8000**.
    *   *AWS Security Group*: Add Inbound Rule -> Custom TCP -> Port 8000 -> Source: 0.0.0.0/0 (or restrict to Vercel IPs if possible).
    *   *Windows Firewall*: Open "Windows Defender Firewall with Advanced Security" -> Inbound Rules -> New Rule -> Port -> TCP -> 8000 -> Allow the connection -> Name: "MT5 API".

### 1.2. Software Installation
1.  **Install Python**: Download and install Python 3.10 or newer. Check "Add Python to PATH" during installation.
2.  **Install MetaTrader 5**: Install the MT5 terminal(s). You can use a single terminal for multiple logins, but the Python script will launch its own instances if needed.
3.  **Install Dependencies**:
    Open PowerShell/CMD and run:
    ```powershell
    pip install fastapi uvicorn pydantic MetaTrader5 requests
    ```

### 1.3. Deploy the Python Service
1.  Copy the `trading-service` folder to your VPS (e.g., `C:\trading-service`).
2.  **Test Run**:
    ```powershell
    cd C:\trading-service
    python main.py
    ```
    *   You should see: `STARTING MT5 SERVICE ON 0.0.0.0:8000`.
    *   If it fails with `IndentationError`, ensure you have the latest fixed version.

### 1.4. Set Up Persistence (Auto-Start)
To ensure the service runs 24/7 and restarts after reboots:
*   **Option A: Task Scheduler**: Create a Basic Task -> Trigger: "When the computer starts" -> Action: "Start a program" -> Program: `python.exe` -> Arguments: `C:\trading-service\main.py`.
*   **Option B: NSSM (Recommended)**: Use "Non-Sucking Service Manager" to run Python as a Windows Service.

---

## Step 2: Vercel Frontend Configuration

### 2.1. Environment Variables
Go to your Vercel Project Settings -> **Environment Variables** and add:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `COPY_TRADING_API_URL` | `http://<YOUR_AWS_PUBLIC_IP>:8000` | **Crucial**: Must start with `http://` and end with port `8000`. Do NOT add a trailing slash `/`. |
| `COPY_TRADING_API_KEY` | `9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad` | Must match the `API_KEY` in `main.py`. |
| `USE_MOCK_TRADING` | `false` | **Must be false** for production. |

### 2.2. Redeploy
**IMPORTANT**: After changing Environment Variables, you **MUST Redeploy** your project for changes to take effect.
1.  Go to Vercel Dashboard -> Deployments.
2.  Click the three dots on the latest deployment -> **Redeploy**.

---

## Step 3: Verification & Troubleshooting

### 3.1. Verify Connection
1.  Open your deployed website.
2.  Go to the **Strategies** page.
3.  Click the **Heartbeat Icon (Activity)** on a running strategy.
4.  **Success**: You see a popup with "Status: active", "Master Positions: X", "Slave Positions: Y".
5.  **Failure**:
    *   *Error: "Failed to reach service [Target: http://localhost:8000]"*: This means Vercel did not pick up the `COPY_TRADING_API_URL`. **Redeploy again**.
    *   *Error: "Failed to fetch"*: The AWS Firewall is blocking the connection. Check Step 1.1.

### 3.2. Verify Copying
1.  Open the MT5 Terminal on the VPS.
2.  Manually open a trade on the **Master Account**.
3.  Watch the Python Console logs (if visible) or the **Slave Account** in MT5.
4.  The trade should appear on the Slave Account within 1-2 seconds.

### 3.3. "Wrong - Account id" Error
If users report this error:
1.  The system now automatically trims spaces from inputs.
2.  Ask the user to click the **Settings (Gear Icon)** on the strategy card and click **Save/Update** to re-submit cleaned credentials.

---

## Maintenance

*   **Logs**: Check the console output of the Python script for errors.
*   **Persistence**: The system now creates a `subscriptions.json` file. **Do not delete this file** unless you want to reset all connections.
*   **Updates**: If you update `main.py`, restart the Python process.
