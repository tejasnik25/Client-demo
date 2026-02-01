
# Production Copy Trading Setup Guide

This guide explains how to transition from the "Mock" trading environment to a "Live" environment using the provided Python Trading Engine.

## 1. Architecture Overview

- **Next.js App (Frontend/Admin):** Manages users, payments, and strategy configurations. It sends commands to the Trading Engine.
- **Trading Engine (Python):** A microservice running on a Windows VPS. It controls the actual MetaTrader 5 terminals.
- **MetaTrader 5 Terminals:** The actual trading software running on the VPS.

## 2. Prerequisites

1.  **Windows VPS:** You need a Windows Server to run MT5 terminals.
2.  **Python 3.9+:** Installed on the VPS.
3.  **MetaTrader 5:** Installed on the VPS.

## 3. Setup Steps

### A. Deploy the Trading Engine (On your VPS)

1.  Copy the `trading-service` folder to your VPS.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Run the service:
    ```bash
    python main.py
    ```
    *This will start the API server on port 8000.*

### B. Configure Next.js App

1.  Open your `.env` file in the Next.js project.
2.  Update the following variables:

    ```env
    # Enable Real Trading Mode
    USE_MOCK_TRADING=false

    # Point to your VPS IP address (e.g., http://123.45.67.89:8000)
    COPY_TRADING_API_URL=http://localhost:8000

    # The Secure Key generated for you
    COPY_TRADING_API_KEY=9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad
    ```

### C. Implement the "Real" Logic

The provided `trading-service/main.py` is a **scaffold**. You need to add the actual MT5 connection code.

**Option 1: Using `MetaTrader5` Python Package (Direct Connection)**
*Requires MT5 Terminal running on the same machine.*

In `main.py`, uncomment and implement:
```python
import MetaTrader5 as mt5

def connect_mt5(id, password, server):
    if not mt5.initialize():
        return False
    authorized = mt5.login(id, password=password, server=server)
    return authorized
```

**Option 2: Using MetaApi (Cloud Service)**
*Does not require managing terminals yourself.*
Refer to [MetaApi Python SDK documentation](https://github.com/metaapi/metaapi-python-sdk).

## 4. Testing

1.  Start the Python service (`python main.py`).
2.  Restart your Next.js app.
3.  Try to approve a payment or connect a strategy.
4.  Check the Python console logs to see the requests coming in.
