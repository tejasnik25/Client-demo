# AWS Windows Server Deployment Guide for Trading Engine

This guide will walk you through setting up your **Trading Engine** (the Python microservice) on AWS EC2. This allows your Vercel-hosted website to control MetaTrader 5 terminals running 24/7 in the cloud.

## Architecture
-   **Frontend/Backend:** Hosted on **Vercel** (UI, Database, User Management).
-   **Trading Engine:** Hosted on **AWS EC2 Windows** (Runs MT5 Terminals and Python API).
-   **Communication:** Vercel sends HTTP requests to your AWS Server IP on port 8000.

---

## Step 1: Launch AWS EC2 Instance

1.  Log in to your AWS Console.
2.  Go to **EC2** Dashboard and click **Launch Instance**.
3.  **Name:** `CopyTrading-Engine`
4.  **AMI (OS Image):** Select **Windows**. Choose **Microsoft Windows Server 2022 Base**.
5.  **Instance Type:**
    *   **Recommended:** `t3.medium` (2 vCPU, 4GB RAM) or `t3.large`.
    *   *Note: `t2.micro` (Free tier) is usually too slow for Windows Server + MT5.*
6.  **Key Pair:** Create a new key pair (save the `.pem` file) or use an existing one.
7.  **Network Settings (Security Group):**
    *   Create a new security group.
    *   **Allow RDP** traffic from: `My IP` (for security) or `Anywhere` (easier but less secure).
    *   **IMPORTANT:** Click "Add security group rule":
        *   **Type:** Custom TCP
        *   **Port range:** `8000`
        *   **Source:** `0.0.0.0/0` (Allows Vercel to connect).
8.  Click **Launch Instance**.

---

## Step 2: Server Setup

1.  **Connect to your Instance:**
    *   Wait for the instance to initialize.
    *   Select the instance -> Click **Connect** -> **RDP Client**.
    *   Click **Get Password** -> Upload your `.pem` key file -> Decrypt Password.
    *   Download the **Remote Desktop File** and open it. Enter the Administrator password.

2.  **Install Software (inside the Remote Desktop):**
    *   **Python:** Download and install Python (latest version) from python.org.
        *   **CRITICAL:** Check "Add Python to PATH" during installation.
    *   **MetaTrader 5:** Download and install your broker's MT5 terminal.
        *   Login to your Master and Slave accounts in the terminal.
        *   **Enable AutoTrading:** Click the "Algo Trading" button in MT5 toolbar so it is Green.
        *   **Allow WebRequest (Optional):** If your EAs need internet access, go to Tools -> Options -> Expert Advisors -> Allow WebRequest.

---

## Step 3: Deploy Trading Service

1.  **Copy Files:**
    *   Copy the `trading-service` folder from your local computer.
    *   Paste it onto the Desktop of your AWS Windows Server (you can copy-paste directly via RDP).

2.  **Configure Dependencies:**
    *   Open the `trading-service` folder on the server.
    *   Open `requirements.txt`.
    *   **Uncomment** (remove `#`) the line: `MetaTrader5`.
    *   Save the file.

3.  **Install Libraries:**
    *   Open PowerShell or Command Prompt on the server.
    *   Navigate to the folder:
        ```powershell
        cd C:\Users\Administrator\Desktop\trading-service
        ```
    *   Install dependencies (Run this command and wait for it to finish):
        ```powershell
        python -m pip install -r requirements.txt
        ```
    *   *Troubleshooting:* If that fails, try installing manually:
        ```powershell
        python -m pip install fastapi uvicorn pydantic MetaTrader5
        ```

4.  **Start the Engine:**
    *   Run the server:
        ```powershell
        python main.py
        ```
    *   You should see: `Uvicorn running on http://0.0.0.0:8000`.
    *   *Windows Firewall Alert:* If asked, allow Python to communicate on Private and Public networks.

5.  **Keep it Running:**
    *   **Do not close** the PowerShell window.
    *   **Do not log out** of Windows.
    *   Simply **Disconnect** from the Remote Desktop session (click the "X" at the top).
    *   *Pro Tip:* To run it automatically at startup (in case the server reboots), use **Windows Task Scheduler** to run `python main.py` at "System Startup".

---

## Step 4: Connect Vercel to AWS

1.  Find your AWS Instance's **Public IPv4 address** in the EC2 console (e.g., `54.123.45.67`).
2.  Go to your **Vercel Dashboard** -> Settings -> Environment Variables.
3.  Edit (or Add) `COPY_TRADING_API_URL`:
    *   Value: `http://54.123.45.67:8000` (Replace with your actual AWS IP).
4.  Edit `USE_MOCK_TRADING`:
    *   Value: `false`
5.  **Redeploy** your Vercel project for changes to take effect.

---

## FAQ: Features & Expert Advisors (EAs)

**Q: Will my EAs (robots) and indicators work?**
**A: YES.**
Since you are running the full MetaTrader 5 Desktop application on the AWS server:
1.  You can drag and drop your EAs onto charts just like on your personal computer.
2.  The Python API runs in the background and talks to MT5. It does **not** interfere with your EAs.
3.  You can have an EA trading on one chart, while our Copy Trading system manages trades on another chart (or even the same one, though be careful with magic numbers).

**Q: Does the server need to stay open?**
**A:** You can close the Remote Desktop (RDP) window, and the server will keep running. However, **do not log out** (Sign out) inside Windows; just disconnect.
*   *Pro Tip:* To ensure the Python script restarts if the server reboots, look into using "Task Scheduler" to run `python main.py` at system startup.

## Troubleshooting

**Error: `ModuleNotFoundError: No module named 'uvicorn'`**
*   **Cause:** The libraries were not installed successfully.
*   **Fix:** Run `python -m pip install uvicorn fastapi pydantic MetaTrader5` in PowerShell.

**Error: `pip : The term 'pip' is not recognized`**
*   **Cause:** Python was installed without the "Add to PATH" option.
*   **Fix:** Use `python -m pip` instead of just `pip`.
