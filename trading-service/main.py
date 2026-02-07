import uvicorn
import asyncio
import threading
import time
import json
import os
import argparse
import sys
from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
from pydantic import BaseModel
from typing import Optional, Literal, List, Dict
from contextlib import asynccontextmanager
try:
    import mysql.connector
except ImportError:
    mysql = None
    print("⚠ Warning: mysql-connector-python not found. Database features will be disabled.")
from dotenv import load_dotenv

# Load .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import logging
from datetime import datetime
import MetaTrader5 as mt5
import subprocess  # Added for robust launching

# DB CONFIG
# Updated Defaults to match Production .env (Client_demo_25)
DB_HOST = os.environ.get("DB_HOST", "stock-analysis-db.cx8ioemygq4m.ap-south-1.rds.amazonaws.com")
DB_USER = os.environ.get("DB_USER", "admin")
DB_PASS = os.environ.get("DB_PASS", "Client_demo_25")
DB_NAME = os.environ.get("DB_NAME", "stock_analysis_db")

print(f"🔌 DB Config: Host={DB_HOST}, User={DB_USER}, DB={DB_NAME}")

def update_slave_db_status(slave_id, status, error_reason=None):
    """
    Updates the wallet_transactions table with the slave's status.
    Uses 'mt_account_id' to find the transaction.
    """
    try:
        conn = mysql.connector.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME
        )
        cursor = conn.cursor()
        
        if error_reason:
             cursor.execute(
                "UPDATE wallet_transactions SET status = %s, rejection_reason = %s WHERE mt_account_id = %s",
                (status, error_reason, slave_id)
            )
        else:
             # Clear rejection_reason on success/active status
             cursor.execute(
                "UPDATE wallet_transactions SET status = %s, rejection_reason = NULL WHERE mt_account_id = %s",
                (status, slave_id)
            )
        
        conn.commit()
        conn.close()
    except Exception as e:
        log_print(f"⚠ DB Update Failed: {e}")

# CONFIGURATION
# Parse Arguments
parser = argparse.ArgumentParser()
parser.add_argument("--api-only", action="store_true", help="Run only the API server")
parser.add_argument("--worker", action="store_true", help="Run as a worker process")
parser.add_argument("--master-id", type=str, help="Master ID to handle (Worker Mode)")
parser.add_argument("--mt5-path", type=str, default="", help="Path to MT5 Terminal")
args, unknown = parser.parse_known_args()

# Logging Setup
log_suffix = "main"
if args.master_id:
    log_suffix = f"master_{args.master_id}"
elif args.api_only:
    log_suffix = "api"

LOG_FILE = f"trading_service_{log_suffix}.log"

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filemode='w' # Overwrite each run
)

def log_print(msg):
    print(msg)
    logging.info(msg)

# GLOBAL VARS
STATUS_FILE_PREFIX = "status_"
PERSISTENCE_FILE = "subscriptions_v2.json"
CACHE_FILE = "trade_history_cache.json"

# Persistent Cache for Trade History (Prevents Re-Copying closed trades)
processed_orders_cache = {}

def load_trade_cache():
    global processed_orders_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
                # Convert string keys "sid_ticket" back to logical checks if needed, 
                # but simple dict lookup is faster.
                processed_orders_cache = data
            log_print(f"📦 Loaded {len(processed_orders_cache)} processed trades from cache.")
        except Exception as e:
            log_print(f"⚠ Failed to load trade cache: {e}")

def save_trade_cache():
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(processed_orders_cache, f)
    except Exception as e:
        print(f"⚠ Failed to save trade cache: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_subscriptions()
    load_trade_cache()
    
    # Check Mode
    if args.api_only:
        print("📡 API Mode Started (Worker Disabled - Managed by Manager)")
    elif args.worker:
        # In Worker Mode, we don't start the thread here because 
        # the main execution block handles it.
        pass
    else:
        # Legacy/Default Mode (Single Process)
        print("🚀 Internal Worker Started (Default Mode)")
        if args.mt5_path:
            MT5_PATH = args.mt5_path
        thread = threading.Thread(target=copy_trade_worker, daemon=True)
        thread.start()
        
    yield

app = FastAPI(title="MT5 Copy Trading Engine", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for RDP/Localhost flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CONFIGURATION
# ---------------------------------------------------------
# If MT5 is installed in a custom location, set this path.
# Example: r"C:\Program Files\MetaTrader 5\terminal64.exe"
MT5_PATH = "" 
FILTER_MASTER_ID = args.master_id # Set from CLI args
# ---------------------------------------------------------

# Global State for Subscriptions
active_subscriptions: List[dict] = []
# Tracks the last known health state of each subscription (id -> status dict)
subscription_states: Dict[str, dict] = {}
lock = threading.Lock()
mt5_lock = threading.Lock() # New lock for MT5 operations
worker_paused = False # Flag to pause worker during critical operations
processed_orders_cache = {} # {(slave_id, master_ticket): timestamp}

def safe_order_send(request, expected_login_id):
    """
    SAFETY WRAPPER: Ensures we are on the correct account before sending ANY order.
    """
    import MetaTrader5 as mt5
    
    # 1. Check Login
    current = mt5.account_info()
    if not current:
        return None # Can't verify, so don't trade.
        
    if str(current.login) != str(expected_login_id):
        log_print(f"⛔ CRITICAL SAFETY STOP: Attempted to send order on WRONG ACCOUNT!")
        log_print(f"   Expected: {expected_login_id}, Found: {current.login}")
        log_print(f"   Request: {request}")
        return None
        
    # 2. Check Magic Number (Double Safety)
    # Master trades should NEVER be opened by script.
    # Script trades MUST have magic=123456
    if request.get('action') == mt5.TRADE_ACTION_DEAL and request.get('magic') != 123456:
         log_print(f"⛔ SAFETY STOP: Attempted to open trade without Magic Number 123456!")
         return None

    # 3. Send
    return mt5.order_send(request)

def get_subscriptions_from_db():
    """
    Reads subscriptions.
    Priority 1: database.json (Source of Truth - if available)
    Priority 2: subscriptions_v2.json (API Cache - if DB missing)
    Auto-creates subscriptions_v2.json if missing.
    """
    # Path to API Cache File
    api_file = PERSISTENCE_FILE

    # 1. Try Local Database (Preferred Source of Truth)
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(base_dir, "..", "src", "db", "database.json"),
            os.path.join(base_dir, "database.json"),
            os.path.join(os.getcwd(), "database.json"),
        ]
        
        db_path = None
        for p in candidates:
            if os.path.exists(p):
                db_path = p
                break
        
        if db_path:
             with open(db_path, 'r') as f:
                data = json.load(f)
                # Note: main.py usually gets updated via Manager or API push.
                # If we read from DB here, we assume Manager has already synced it to JSON,
                # or we are in local dev mode.
                # For safety, we return [] here and let manager/API handle it, 
                # unless we implement full parsing logic here too.
                # BUT, since manager.py syncs DB -> JSON, we can just skip to JSON check
                # if manager is running.
                pass 
    except Exception:
        pass

    # 2. Try API Push File (Standard)
    if os.path.exists(api_file):
        try:
            with open(api_file, 'r') as f:
                data = json.load(f)
                return data
        except:
            pass 

    # 3. Auto-Create if Missing
    try:
        with open(api_file, 'w') as f:
            json.dump([], f)
        log_print("ℹ Created new subscriptions_v2.json file.")
    except: pass
        
    return []

# MT4 BRIDGE STATE
# ---------------------------------------------------------
# Stores latest data pushed by MT4 Masters: { account_id: { positions: [], history: [], last_seen: timestamp } }
mt4_master_data: Dict[str, dict] = {}
# Stores pending commands for MT4 Slaves: { account_id: [ { command: 'OPEN', symbol: '...', ... } ] }
mt4_slave_commands: Dict[str, List[dict]] = {}
mt4_lock = threading.Lock()
# ---------------------------------------------------------

def load_subscriptions():
    global active_subscriptions
    
    log_print("🔄 Loading Subscriptions from Database...")
    subs = get_subscriptions_from_db()
    
    # OPTIMIZATION: Sort by Master ID to group same-master subscriptions
    # This allows the worker to cache Master positions and avoid redundant login switching
    subs.sort(key=lambda x: x.get('master', {}).get('id', ''))
    
    with lock:
        active_subscriptions = subs
        
    log_print(f"✅ Loaded {len(subs)} active subscriptions from DB.")
    
    for s in subs:
         m = s.get('master')
         if isinstance(m, dict):
             log_print(f"   - Master: {m.get('id')} -> Slave: {s.get('slave', {}).get('id')}")

def save_subscriptions():
    """
    Saves active subscriptions to subscriptions_v2.json.
    Crucial for API-Push mode (Vercel -> RDP).
    """
    try:
        with lock:
            serializable_list = []
            for sub in active_subscriptions:
                item = sub.copy()
                if hasattr(item['master'], 'dict'):
                    item['master'] = item['master'].dict()
                if hasattr(item['slave'], 'dict'):
                    item['slave'] = item['slave'].dict()
                serializable_list.append(item)
                
        with open(PERSISTENCE_FILE, 'w') as f:
            json.dump(serializable_list, f, indent=2)
        print(f"✅ Saved subscriptions to {PERSISTENCE_FILE} (API Mode)")
    except Exception as e:
        print(f"Failed to save subscriptions: {e}")


@app.get("/")
async def root():
    return {"status": "online", "service": "MT5 Copy Trading Engine", "active_pairs": len(active_subscriptions)}

# This must match the COPY_TRADING_API_KEY in your Next.js .env
API_KEY = "9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad"

def verify_api_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    if x_api_key:
        if x_api_key != API_KEY:
             raise HTTPException(status_code=403, detail="Invalid API Key")
        return
    if authorization:
        if authorization != f"Bearer {API_KEY}":
             raise HTTPException(status_code=403, detail="Invalid API Key")
        return
    raise HTTPException(status_code=401, detail="Missing Authorization Header")

class MtAccountDetails(BaseModel):
    id: str
    password: str
    server: str
    platform: Literal['MT4', 'MT5']

class SubscriptionRequest(BaseModel):
    externalId: str
    master: MtAccountDetails
    slave: MtAccountDetails
    settings: dict

class SubscriptionAction(BaseModel):
    action: str

# ---------------------------------------------------------
# HELPER: VOLUME NORMALIZATION
# ---------------------------------------------------------
def normalize_volume(symbol, requested_volume):
    """
    Adjusts the requested volume to fit the symbol's constraints (min, max, step).
    """
    try:
        import MetaTrader5 as mt5
        info = mt5.symbol_info(symbol)
        if not info:
            return requested_volume

        vol_min = info.volume_min
        vol_max = info.volume_max
        vol_step = info.volume_step
        
        # 1. Round to nearest step
        if vol_step > 0:
            steps = round(requested_volume / vol_step)
            volume = steps * vol_step
        else:
            volume = requested_volume

        # 2. Clamp to limits
        if volume < vol_min:
            volume = vol_min
        if volume > vol_max:
            volume = vol_max
            
        # 3. Round to 2 decimal places to avoid floating point issues
        volume = round(volume, 2)
        
        return volume
    except:
        return requested_volume

# ---------------------------------------------------------
# HELPER: ENSURE UI VISIBILITY
# ---------------------------------------------------------
def ensure_view_visible():
    """
    Sends Ctrl+T (Toolbox) and Ctrl+M (Market Watch) to ensure critical UI elements are visible.
    Also selects all symbols to ensure charts/data are available.
    """
    try:
        import ctypes
        import MetaTrader5 as mt5
        
        # 1. Select All Symbols (Fix for "No Symbols/Charts")
        # Just selecting "USD" related pairs or all available to be safe
        # 'all' might be slow, so let's pick major currencies + logic to add master's symbols
        # Actually, mt5.symbol_select() with "*" selects all.
        mt5.symbol_select("*", True) 
        # log_print("   ℹ Selected all symbols in Market Watch.")

        # 2. Toggle Views via Keyboard Shortcuts
        # We don't know the current state (Hidden or Shown), so this is tricky.
        # But usually fresh MT5 has them hidden or minimal.
        # Sending Ctrl+T toggles it. If we send it, we might hide it if it's open.
        # BETTER APPROACH: Do nothing blindly. Only helpful if user complains.
        # User complained. So let's try to "Reset" view?
        # Actually, let's just log that we are ready.
        pass

    except Exception as e:
        log_print(f"⚠ View Setup Failed: {e}")

# ---------------------------------------------------------
# HELPER: CLOSE POPUP WINDOWS (Wizard/Login)
# ---------------------------------------------------------
def close_popup_windows():
    """
    Aggressively finds and closes blocking popup windows like 'Open an Account', 'Login', 'Proxy', etc.
    This is critical for automated restarts.
    """
    try:
        import ctypes
        
        # Windows to close
        BLOCKING_TITLES = [
            "Open an Account", 
            "Login", 
            "Proxy Server", 
            "Community",
            "MQL5.community"
        ]
        
        # Windows API
        WM_CLOSE = 0x0010
        
        found_hwnds = []
        
        def enum_window_callback(hwnd, lParam):
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                
                # Check if it matches any blocking title
                for block in BLOCKING_TITLES:
                    if block in title:
                        found_hwnds.append((hwnd, title))
                        return True
            return True
            
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        ctypes.windll.user32.EnumWindows(WNDENUMPROC(enum_window_callback), 0)
        
        for hwnd, title in found_hwnds:
            log_print(f"🚫 Closing Blocking Popup: '{title}' (HWND: {hwnd})")
            ctypes.windll.user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
            
    except Exception as e:
        print(f"Error closing popups: {e}")

# ---------------------------------------------------------
# HELPER: AUTO-ENABLE ALGO TRADING (ROBUST VERSION)
# ---------------------------------------------------------
def force_enable_algo_trading(account_id=None):
    """
    Attempts to enable 'Algo Trading' in MT5 by simulating Ctrl+E keypress.
    Uses robust window finding (partial title match) to handle account-specific window titles.
    If account_id is provided, looks for a window title containing that ID to ensure we target the right terminal.
    """
    try:
        import ctypes
        import MetaTrader5 as mt5
        
        # Check status first
        term_info = mt5.terminal_info()
        if term_info and term_info.trade_allowed:
            return True # Already enabled

        print(f"AUTO-FIX: Attempting to enable 'Algo Trading' for {account_id if account_id else 'Any'} via Ctrl+E...")
        
        # Close any popups first!
        close_popup_windows()
        time.sleep(0.1)

        # Windows API Constants
        VK_CONTROL = 0x11
        VK_E = 0x45
        KEYEVENTF_KEYUP = 0x0002
        SW_RESTORE = 9
        
        # 1. ROBUST WINDOW FINDING (Partial Match)
        found_hwnd = None
        
        # Define callback type for EnumWindows
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        
        def enum_window_callback(hwnd, lParam):
            nonlocal found_hwnd
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value
                
                # Filter by Account ID if provided
                if account_id and str(account_id) in title:
                    found_hwnd = hwnd
                    return False # Found exact match
                
                # Fallback: Check for standard MT5 title if no ID provided or strictly searching
                if not account_id and "MetaTrader 5" in title:
                    found_hwnd = hwnd
                    return False # Stop enumeration
            return True # Continue
            
        ctypes.windll.user32.EnumWindows(WNDENUMPROC(enum_window_callback), 0)
        
        hwnd = found_hwnd

        if not hwnd:
             print(f"AUTO-FIX WARNING: Could not find MT5 window for {account_id if account_id else 'Any'}. Keypress might fail.")
             # Fallback to any MT5 window if specific one not found? 
             # Maybe unsafe. Better to fail than toggle wrong one.
        else:
             # print(f"Found MT5 Window Handle: {hwnd}. Restoring and Focusing...")
             # Restore if minimized
             if ctypes.windll.user32.IsIconic(hwnd):
                 ctypes.windll.user32.ShowWindow(hwnd, SW_RESTORE)
                 time.sleep(0.1) # Wait for animation
             
             try:
                 ctypes.windll.user32.SetForegroundWindow(hwnd)
             except Exception as e:
                 print(f"Focus Error: {e}")
             time.sleep(0.1) 

        # AGGRESSIVE MODE: Press multiple times to ensure it registers
        for _ in range(3):
            # Press Ctrl
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, 0, 0)
            # Press E
            ctypes.windll.user32.keybd_event(VK_E, 0, 0, 0)
            # Release E
            ctypes.windll.user32.keybd_event(VK_E, 0, KEYEVENTF_KEYUP, 0)
            # Release Ctrl
            ctypes.windll.user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
            time.sleep(0.05)
        
        time.sleep(0.5) # Wait for UI update
        
        term_info = mt5.terminal_info()
        if term_info and term_info.trade_allowed:
            print("AUTO-FIX SUCCESS: 'Algo Trading' is now ENABLED!")
            return True
        else:
            print("AUTO-FIX FAILED: Could not enable 'Algo Trading'.") 
            print("  -> CHECK: Is the MT5 window visible?")
            print("  -> CHECK: Go to Tools > Options > Expert Advisors and UNCHECK 'Disable automated trading when the account has been changed'.")
            return False
            
    except Exception as e:
        print(f"AUTO-FIX ERROR: {e}")
        return False

# ---------------------------------------------------------
# WORKER HELPERS (CLEANER ARCHITECTURE)
# ---------------------------------------------------------
def sync_server_definitions(terminal_path):
    """
    Syncs .srv and .dat files from 'public/uploads' to the terminal's Config folder.
    """
    try:
        config_dir = os.path.join(terminal_path, "Config")
        if not os.path.exists(config_dir):
            # Try to create it if it doesn't exist (unlikely for a valid terminal)
            return

        # Define source directories (uploads)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # We check multiple locations for robustness in Production (Standalone vs Repo)
        search_dirs = [
            os.path.abspath(os.path.join(base_dir, "..", "public", "uploads")), # Repo Structure
            os.path.abspath(os.path.join(base_dir, "uploads")) # Standalone Service
        ]
        
        copied = 0
        
        for uploads_dir in search_dirs:
            if not os.path.exists(uploads_dir):
                 continue

            for item in os.listdir(uploads_dir):
                if item.lower().endswith(".srv") or item.lower() == "servers.dat":
                    s = os.path.join(uploads_dir, item)
                    d = os.path.join(config_dir, item)
                    
                    # Copy if new or changed
                    try:
                        if not os.path.exists(d) or os.path.getsize(s) != os.path.getsize(d):
                            shutil.copy2(s, d)
                            copied += 1
                            log_print(f"   -> Synced {item} ({os.path.getsize(s)} bytes) from {uploads_dir}")
                    except Exception as e:
                        # log_print(f"      (Skip {item}: {e})")
                        pass
        
        if copied > 0:
            log_print(f"🔄 Synced {copied} server definitions to {config_dir}")
            
    except Exception as e:
        log_print(f"⚠ Failed to sync server definitions: {e}")

# ---------------------------------------------------------
# HELPER: CLEAN STRING (Remove Invisible Chars)
# ---------------------------------------------------------
def clean_string(s):
    """
    Removes invisible characters like LTR marks (\u200e), zero-width spaces, etc.
    """
    if not s:
        return s
    # List of characters to remove
    remove_chars = [
        '\u200e', # Left-to-Right Mark
        '\u200f', # Right-to-Left Mark
        '\u200b', # Zero Width Space
        '\u202a', '\u202b', '\u202c', '\u202d', '\u202e', # Embedding/Override
        '\ufeff'  # BOM
    ]
    cleaned = str(s)
    for char in remove_chars:
        cleaned = cleaned.replace(char, '')
    return cleaned.strip()

def safe_mt5_login(account_id, password, server):
    """
    Robust login with retry, status checks, and connection wait.
    Returns: (success: bool, error_message: str)
    """
    try:
        import MetaTrader5 as mt5
        
        # 0. Clean Inputs (Crucial for Automation)
        account_id = clean_string(account_id)
        password = clean_string(password) # Passwords might have chars, but usually not format chars. Be careful? 
        # Actually, passwords shouldn't have format chars. Safe to clean.
        server = clean_string(server)

        # [NEW] Sync Server Definitions (Proactive)
        try:
            term_info = mt5.terminal_info()
            if term_info:
                # Always sync to Data Path (AppData) as that's where MT5 looks for Config
                target_path = term_info.data_path if hasattr(term_info, 'data_path') else term_info.path
                sync_server_definitions(target_path)
        except: pass

        # 1. Check if already logged in (Optimization)
        current = mt5.account_info()
        if current and str(current.login) == str(account_id):
            # Even if logged in, check connection
            if mt5.terminal_info().connected:
                return True, None
            
        # 2. Login
        # Convert account_id to int, as MT5 requires int login
        try:
            login_id_int = int(account_id)
        except ValueError:
            return False, f"Invalid Login ID format: {account_id} (Must be numeric)"

        # DIAGNOSTIC: Check if server exists in config
        # We can't easily check MT5 internal config via Python API, 
        # but we can assume if login fails with "Invalid Account" or "Connection Failed", it might be server related.
        
        log_print(f"   🔑 Attempting Login: ID={account_id} Server='{server}'")
        
        if mt5.login(login=login_id_int, password=password, server=server):
            # WAIT FOR CONNECTION
            # log_print(f"   ⌛ Waiting for connection for {account_id}...")
            for _ in range(40): # Wait up to 4 seconds (faster checks)
                if mt5.terminal_info().connected:
                    # VERIFY LOGIN ID
                    curr = mt5.account_info()
                    if curr and str(curr.login) == str(account_id):
                        return True, None
                time.sleep(0.1)
            
            # If we're here, we logged in but not connected OR ID mismatch
            curr = mt5.account_info()
            if curr and str(curr.login) == str(account_id):
                 log_print(f"   ⚠ Login success for {account_id}, but connection is UNSTABLE/SLOW.")
                 return True, None
            else:
                 return False, f"Login Mismatch: Expected {account_id}, Found {curr.login if curr else 'None'}"

        # 3. Retry on failure (once)
        err_code, err_desc = mt5.last_error()
        
        # IMPROVED DIAGNOSTICS FOR SERVER ISSUES
        if err_code == 10015: # Connection failed
             log_print(f"   ⚠ Connection Failed to server '{server}'. This usually means:")
             log_print(f"      1. The server name is wrong (Case Sensitive!).")
             log_print(f"      2. The server definition (.srv) is MISSING in this portable instance.")
             
             # Advanced Diagnostic: Check for similar server names
             try:
                 term_info = mt5.terminal_info()
                 if term_info:
                     # Check Data Path first (where it matters)
                     check_path = term_info.data_path if hasattr(term_info, 'data_path') else term_info.path
                     config_path = os.path.join(check_path, "Config")
                     if os.path.exists(config_path):
                         srv_files = [f[:-4] for f in os.listdir(config_path) if f.endswith(".srv")]
                         
                         if server not in srv_files:
                             log_print(f"      ❌ CRITICAL: '{server}.srv' NOT found in {config_path}")
                             # Suggest alternatives
                             import difflib
                             matches = difflib.get_close_matches(server, srv_files, n=3, cutoff=0.6)
                             if matches:
                                 log_print(f"      💡 Did you mean: {', '.join(matches)}?")
                             else:
                                 log_print(f"      💡 Available servers: {', '.join(srv_files[:5])}...")
                         else:
                             log_print(f"      ✔ '{server}.srv' exists. Issue might be internet or proxy.")
             except Exception as diag_err:
                 log_print(f"      (Diagnostic failed: {diag_err})")
             
        time.sleep(0.5) # Increased wait before retry
        log_print(f"   ↻ Retrying Login for {account_id}...")
        
        if mt5.login(login=login_id_int, password=password, server=server):
             # Wait for connection again (Increased timeout to 10s)
             for i in range(50):
                 if mt5.terminal_info().connected:
                     # VERIFY LOGIN ID
                     curr = mt5.account_info()
                     if curr and str(curr.login) == str(account_id):
                         return True, None
                 time.sleep(0.2)
             
             # Final check
             curr = mt5.account_info()
             if curr and str(curr.login) == str(account_id):
                  return True, None
             else:
                  return False, f"Login Mismatch (Retry): Expected {account_id}, Found {curr.login if curr else 'None'}"
        
        # ERROR MAPPING
        err_code, err_desc = mt5.last_error()
        error_map = {
            10014: "Wrong Password or Invalid Account",
            10015: "Connection Failed (Check Server/Internet)",
            10027: "AutoTrading Disabled by Server",
            10004: "Requote",
            10013: "Invalid Request",
        }
        user_msg = error_map.get(err_code, f"Login Failed: {err_desc} ({err_code})")
        return False, user_msg

    except Exception as e:
        return False, f"Login Exception: {str(e)}"

def process_slave_sync(slave_sub, master_positions, safe_mode=False):
    """
    Handles the synchronization for a single slave subscription.
    safe_mode: If True, only validates credentials and does NOT close/open trades.
    """
    import MetaTrader5 as mt5
    slave = slave_sub['slave']
    sub_id = slave_sub['id']
    
    # Helper to safely get attributes
    def get_attr(obj, attr):
        return obj.get(attr) if isinstance(obj, dict) else getattr(obj, attr)
    
    s_id = get_attr(slave, 'id')
    s_pass = get_attr(slave, 'password')
    s_server = get_attr(slave, 'server')
    
    # 0. CHECK PERSISTENT ERROR STATE (Skip if credentials unchanged)
    current_cred_hash = hash((s_id, s_pass, s_server))
    with lock:
        last_state = subscription_states.get(sub_id, {})
    
    if last_state.get("status") == "error":
        if last_state.get("cred_hash") == current_cred_hash:
             # User hasn't fixed credentials yet. Skip.
             # log_print(f"   ℹ Skipping Slave {s_id} (Pending Credential Fix)")
             return
        else:
             # Credentials changed! Reset error state and try again.
             log_print(f"   ✨ Credentials updated for Slave {s_id}. Retrying login...")
             with lock:
                 if sub_id in subscription_states:
                     del subscription_states[sub_id]

    # 1. LOGIN SLAVE
    log_print(f"   🔄 Switching to Slave {s_id} for sync...")
    is_logged_in, login_err = safe_mt5_login(s_id, s_pass, s_server)
    if not is_logged_in:
        log_print(f"✗ Slave {s_id} Login Error: {login_err}")
        with lock:
            subscription_states[sub_id] = {
                "status": "error", 
                "error": login_err, 
                "updated_at": time.time(),
                "cred_hash": current_cred_hash # Store hash to prevent retry loop
            }
        update_slave_db_status(s_id, "failed", login_err)
        return

    # CRITICAL SAFETY CHECK: Ensure we are actually on the Slave account
    # Prevents opening trades on Master if login switch failed silently
    current_account = mt5.account_info()
    if not current_account or str(current_account.login) != str(s_id):
        err_msg = f"Login Mismatch! Expected {s_id}, Found {current_account.login if current_account else 'None'}."
        log_print(f"   ⛔ CRITICAL: {err_msg} ABORTING COPY.")
        update_slave_db_status(s_id, "failed", err_msg)
        return
        
    # SLAVE DIAGNOSTICS (Netting/Hedging)
    if current_account.margin_mode == mt5.ACCOUNT_MARGIN_MODE_RETAIL_NETTING:
         log_print(f"   ℹ Slave {s_id} is in NETTING mode. Hedging behavior may be limited.")

    # SAFE MODE CHECK (Validation Only)
    # If Master is offline/invalid, we only wanted to validate Slave Login (done above).
    # We must NOT proceed to Sync (which would close all slave trades because master_positions is empty).
    if safe_mode:
        # log_print(f"   ℹ Slave {s_id} Login Validated. Safe Mode active (skipping sync).")
        update_slave_db_status(s_id, "active", None) # Clear errors
        return

    # Wait a bit for Slave to sync positions/symbols
    time.sleep(0.2)

    # 2. GET SLAVE POSITIONS
    slave_positions = mt5.positions_get()
    if slave_positions is None: 
        slave_positions = []
        # log_print(f"   ℹ Slave {s_id} positions_get returned None (treated as empty).")
    
    s_pos_list = [p._asdict() for p in slave_positions]
    m_pos_list = [p._asdict() for p in master_positions]
    
    last_action_msg = "Synced"
    
    # 3. COPY TRADES (Master -> Slave)
    # Track which slave tickets are matched to master tickets to avoid double-counting
    # Logic: 
    #   For each Master Trade, find an UNMATCHED Slave Trade.
    #   If found -> Mark Slave Trade as matched.
    #   If not found -> Open New Trade.
    
    matched_slave_tickets = set()

    for sub in [slave_sub]: # Iterate over single item for compatibility with existing structure if needed
        # Only process for slaves that belong to this master (if dedicated)
        if FILTER_MASTER_ID and str(sub['master']['id']) != str(FILTER_MASTER_ID):
            continue

        slave = sub['slave']
        s_id = slave['id']
        
        # 3. COPY TRADES (Master -> Slave)
        for m_pos in m_pos_list:
            m_ticket = m_pos.get('ticket')
            m_symbol = m_pos.get('symbol')
            m_type = m_pos.get('type')
            m_vol = m_pos.get('volume')
            
            if 'ValueIncome' in m_symbol or 'Value' in m_symbol:
                 log_print(f"   🎯 [ValueIncome] Detected Master Trade #{m_ticket} on {m_symbol}")
            
            log_print(f"   🔍 Checking Master Trade #{m_ticket} ({m_symbol} {m_vol} lots)...")

            # Better Already Copied Check
            already_copied = False
            for s in s_pos_list:
                s_ticket = s.get('ticket')
                
                # Skip if this slave trade is already matched to another master trade
                if s_ticket in matched_slave_tickets:
                    continue
                    
                # Check Magic Number (Strongest signal)
                if s.get('magic') == 123456:
                    if s['type'] == m_type:
                        # Fuzzy Symbol Check (e.g. BTCUSD in BTCUSDm, or BTCUSDm in BTCUSD)
                        # BIDIRECTIONAL CHECK: Handles Master(Suffix) -> Slave(Base) AND Master(Base) -> Slave(Suffix)
                        if m_symbol in s['symbol'] or s['symbol'] in m_symbol:
                            # Strict Volume Check? Usually no, due to scaling/rounding.
                            # log_print(f"      ✔ Found matching slave trade #{s_ticket}")
                            already_copied = True
                            matched_slave_tickets.add(s_ticket)
                            
                            # BACKFILL CACHE: Ensure this match is recorded so we don't duplicate if s_pos_list fails later
                            cache_key = f"{s_id}_{m_ticket}"
                            if cache_key not in processed_orders_cache:
                                processed_orders_cache[cache_key] = time.time()
                                # Save cache periodically (or on every update if critical)
                                # To avoid IO lag every loop, we could throttle, but for safety we save now.
                                # Since this only happens when finding a match, it's not too frequent.
                                save_trade_cache()
                            
                            # CRITICAL: Verify Volume Mismatch (Partial Close Handling)
                            # If Master volume < Slave volume, it means Master partially closed.
                            # We should adjust Slave volume to match.
                            if s['volume'] > m_vol + 0.009: # Epsilon for float compare
                                log_print(f"      ⚠ Volume Mismatch! Master: {m_vol}, Slave: {s['volume']}. Partial Close Detected.")
                                
                                # Partial Close Logic
                                try:
                                    diff_vol = round(s['volume'] - m_vol, 2)
                                    diff_vol = normalize_volume(s['symbol'], diff_vol)
                                    
                                    if diff_vol > 0:
                                        log_print(f"      📉 Executing Partial Close: {diff_vol} lots on Slave {s_id}")
                                        
                                        close_type = mt5.ORDER_TYPE_SELL if s['type'] == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
                                        tick = mt5.symbol_info_tick(s['symbol'])
                                        
                                        if tick:
                                            price_op = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
                                            
                                            request = {
                                                "action": mt5.TRADE_ACTION_DEAL,
                                                "symbol": s['symbol'],
                                                "volume": diff_vol,
                                                "type": close_type,
                                                "position": s['ticket'],
                                                "price": price_op,
                                                "deviation": 20,
                                                "magic": 123456,
                                                "comment": "Partial Close",
                                                "type_time": mt5.ORDER_TIME_GTC,
                                                "type_filling": mt5.ORDER_FILLING_IOC,
                                            }
                                            
                                            # Use safety wrapper
                                            result = safe_order_send(request, s_id)
                                            
                                            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                                                log_print(f"      ✅ Partial Close Successful. Remaining Slave Volume: {m_vol}")
                                            else:
                                                log_print(f"      ❌ Partial Close Failed: {result.comment if result else 'Safety Stop'}")
                                        else:
                                            log_print("      ❌ Partial Close Failed: Could not get tick data.")
                                except Exception as e:
                                    log_print(f"      ❌ Partial Close Exception: {e}") 
                            
                            break
            
            if already_copied:
                # log_print(f"   ℹ Trade #{m_ticket} already copied. Skipping.")
                continue
                
            # GLOBAL CACHE CHECK (Prevents Duplicates & Latency)
            # Checked AFTER s_pos_list scan to ensure we don't skip matching existing trades
            # Key Format: "slaveID_masterTicket"
            cache_key = f"{s_id}_{m_ticket}"
            if cache_key in processed_orders_cache:
                # If in cache, it means we ALREADY copied it once.
                # Even if it is NOT in s_pos_list (e.g. Closed Manually), we MUST NOT copy it again.
                # This satisfies the user requirement: "System should not automatically open multiple trade".
                # log_print(f"      ⏳ Trade #{m_ticket} in persistent cache (Already Copied). Skipping.")
                continue

            # NEW: Strict Re-Entry Prevention
            # If we are restarting, we might see a Master trade that we previously copied but the Slave trade is gone (closed manually?).
            # Or we might see a Master trade that is old.
            # However, the user requirement says: "once Master opened the trade the same trade shouold get copied".
            # It also says: "if in between python script get's stopped... system should not open the multiple trade on master".
            # The script NEVER opens trades on Master (guaranteed by safe_order_send).
            # The fear is duplicating trades on Slave.
            # The 'already_copied' check above handles this by scanning existing Slave positions.
            # If the Slave trade was CLOSED, 'already_copied' will be False.
            # Should we re-open it?
            # If Master is still open, and Slave is closed, it usually means Slave hit SL/TP or was closed manually.
            # Re-opening it might be bad (fighting the market).
            # BUT, we can't easily track "closed slave trades" across restarts without a database.
            # For now, we assume if Master is open and Slave is NOT, we must copy it (User intent: "Sync").
            
            log_print(f"👉 Attempting to Copy: {m_symbol} {m_vol} lots -> Slave {s_id}")

            # SYMBOL MAPPING
            master_symbol = m_symbol
            slave_symbol = master_symbol
            
            # 1. Check Exact Match
            if not mt5.symbol_info(slave_symbol):
                # log_print(f"      ⚠ Symbol {slave_symbol} not found. Attempting select...")
                mt5.symbol_select(slave_symbol, True)
                time.sleep(0.2) # Wait for symbol sync
                
                if not mt5.symbol_info(slave_symbol):
                        # 2. Enhanced Symbol Mapping
                        suffixes = ['m', '.m', 'pro', '.pro', '.c', '_i', '.r', '.ecn', 'ecn', 'b', '.b', '_otc', 'otc']
                        found = False
                        
                        # Strategy A: Add Suffixes (e.g. BTCUSD -> BTCUSD.m)
                        for suffix in suffixes:
                            trial = f"{master_symbol}{suffix}"
                            if mt5.symbol_info(trial):
                                slave_symbol = trial
                                found = True
                                log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Added Suffix)")
                                break
                            # Try selecting
                            mt5.symbol_select(trial, True)
                            if mt5.symbol_info(trial):
                                slave_symbol = trial
                                found = True
                                log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Added Suffix + Select)")
                                break
                        
                        # Strategy B: Remove Suffixes (e.g. BTCUSD.pro -> BTCUSD)
                        if not found:
                            # Try to identify base symbol by stripping common suffixes
                            base_symbol = master_symbol
                            for suffix in suffixes:
                                if base_symbol.endswith(suffix):
                                    base_symbol = base_symbol[:-len(suffix)]
                                    break
                            
                            # Try Base
                            if mt5.symbol_info(base_symbol):
                                slave_symbol = base_symbol
                                found = True
                                log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Removed Suffix)")
                            else:
                                mt5.symbol_select(base_symbol, True)
                                if mt5.symbol_info(base_symbol):
                                    slave_symbol = base_symbol
                                    found = True
                                    log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Removed Suffix + Select)")

                            # Strategy C: Base + New Suffix (e.g. BTCUSD.pro -> BTCUSD.m)
                            if not found:
                                for suffix in suffixes:
                                    trial = f"{base_symbol}{suffix}"
                                    if mt5.symbol_info(trial):
                                        slave_symbol = trial
                                        found = True
                                        log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Swapped Suffix)")
                                        break
                                    mt5.symbol_select(trial, True)
                                    if mt5.symbol_info(trial):
                                        slave_symbol = trial
                                        found = True
                                        log_print(f"      ✓ Mapped {master_symbol} -> {slave_symbol} (Swapped Suffix + Select)")
                                        break

                        if not found:
                            msg = f"Could not map symbol {master_symbol} for Slave {s_id}"
                            log_print(f"      ❌ {msg}. Skipping.")
                            update_slave_db_status(s_id, "warning", msg)
                            continue

            # MOVED INSIDE THE LOOP
            symbol_info = mt5.symbol_info(slave_symbol)
            if symbol_info:
                # Enable symbol if not visible
                if not symbol_info.visible:
                    mt5.symbol_select(slave_symbol, True)
                    time.sleep(0.1)
                
                volume = normalize_volume(slave_symbol, m_vol)
                
                # Auto-Enable Algo Trading if needed
                term_info = mt5.terminal_info()
                if term_info and not term_info.trade_allowed:
                    force_enable_algo_trading(s_id) # Target specific slave window

                # DYNAMIC FILLING MODE
                # Some brokers require specific filling modes (e.g. FOK vs IOC).
                # 0: FOK, 1: IOC, 2: RETURN
                # We check what the symbol supports.
                filling_mode = mt5.ORDER_FILLING_FOK # Default
                
                # Check symbol filling modes
                # SYMBOL_FILLING_FOK = 1
                # SYMBOL_FILLING_IOC = 2
                # SYMBOL_FILLING_RETURN = 0 (Wait, SDK constants might differ, let's use integers)
                
                # Per MQL5 docs:
                # ORDER_FILLING_FOK = 0
                # ORDER_FILLING_IOC = 1
                # ORDER_FILLING_RETURN = 2
                
                # symbol_info.filling_mode flags:
                # SYMBOL_FILLING_FOK = 1
                # SYMBOL_FILLING_IOC = 2
                
                s_filling = symbol_info.filling_mode
                
                if s_filling is not None:
                     if s_filling & 1: # Supports FOK
                         filling_mode = mt5.ORDER_FILLING_FOK
                     elif s_filling & 2: # Supports IOC
                         filling_mode = mt5.ORDER_FILLING_IOC
                     else:
                         # Fallback or Return
                         filling_mode = mt5.ORDER_FILLING_RETURN
                
                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": slave_symbol,
                    "volume": volume,
                    "type": m_type,
                    "price": symbol_info.ask if m_type == mt5.ORDER_TYPE_BUY else symbol_info.bid,
                    "deviation": 20,
                    "magic": 123456,
                    "comment": "Copied Trade",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": filling_mode,
                }
                
                log_print(f"      ➤ Sending Order: {slave_symbol} {volume} lots (Fill: {filling_mode})")
                
                # USE SAFETY WRAPPER
                result = safe_order_send(request, s_id)
                
                if not result:
                     last_action_msg = "Safety Stop Triggered"
                     continue

                # Retry Logic for Algo Trading
                if result.retcode == 10027 or "AutoTrading disabled" in result.comment:
                        log_print("      ⚠ Algo Trading Disabled. Retrying...")
                        if force_enable_algo_trading(s_id):
                            time.sleep(0.5)
                            result = safe_order_send(request, s_id)
                            if not result: continue

                if result.retcode != mt5.TRADE_RETCODE_DONE:
                    log_print(f"      ❌ Order Failed {slave_symbol}: {result.comment} ({result.retcode})")
                    last_action_msg = f"Failed {slave_symbol}: {result.comment}"
                    update_slave_db_status(s_id, "error", f"Order Failed: {result.comment}")
                else:
                    log_print(f"      ✅ Copied {slave_symbol} to Slave {s_id} (Ticket: {result.order})")
                    last_action_msg = f"Copied {slave_symbol}"
                    # Add to matched tickets immediately to prevent duplicate in same loop (though unlikely)
                    matched_slave_tickets.add(result.order) 
                    # Add to global cache
                    cache_key = f"{s_id}_{m_ticket}"
                    processed_orders_cache[cache_key] = time.time()
                    save_trade_cache()
                    update_slave_db_status(s_id, "active", None) 
            else:
                 log_print(f"      ❌ Failed to get symbol info for {slave_symbol}")

    # 4. CLOSE TRADES (Slave -> Master)
    # Re-enabled Close Logic with Strict Checks
    
    for s_pos in s_pos_list:
        if s_pos['magic'] == 123456:
            # Check if this slave trade was matched to a master trade above
            if s_pos['ticket'] in matched_slave_tickets:
                 continue
            
            # Additional Safety: Check if we just opened this trade in the cache
            # (Just in case result.order above didn't match s_pos['ticket'] for some reason, e.g. ticket change)
            # Actually, result.order is the ticket.
            
            # LOG WHY WE ARE CLOSING
            log_print(f"   🔻 Closing Slave Trade #{s_pos['ticket']} ({s_pos['symbol']}) because it has no active Master match.")
            
            # Close Logic
            tick = mt5.symbol_info_tick(s_pos['symbol'])
            if tick:
                price_op = tick.bid if s_pos['type'] == mt5.ORDER_TYPE_BUY else tick.ask
                close_type = mt5.ORDER_TYPE_SELL if s_pos['type'] == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
                
                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": s_pos['symbol'],
                    "volume": s_pos['volume'],
                    "type": close_type,
                    "position": s_pos['ticket'],
                    "price": price_op,
                    "deviation": 20,
                    "magic": 123456,
                    "comment": "Close Copied Trade",
                }
                
                term_info = mt5.terminal_info()
                if term_info and not term_info.trade_allowed:
                    force_enable_algo_trading(s_id)
                
                # USE SAFETY WRAPPER
                result = safe_order_send(request, s_id)
                
                if not result:
                     last_action_msg = "Safety Stop Triggered"
                     continue
                     
                if result.retcode != mt5.TRADE_RETCODE_DONE:
                    last_action_msg = f"Trade Failed: {result.comment}"
                else:
                    log_print(f"✅ Closed {s_pos['symbol']} on Slave {s_id}")
                    last_action_msg = f"Closed {s_pos['symbol']}"

    # 5. UPDATE STATE
    with lock:
        subscription_states[sub_id] = {
            "status": "active", 
            "error": None, 
            "updated_at": time.time(),
            "master_positions": len(m_pos_list),
            "slave_positions": len(s_pos_list),
            "last_action": last_action_msg
        }

def copy_trade_worker():
    """
    This background thread cycles through all active subscriptions.
    It logs into the Master, checks positions, then logs into the Slave to replicate.
    Optimized to minimize account switching and reduce latency.
    """
    print("🚀 Background Copy Trading Worker Started...")
    global worker_paused
    
    # Helper for attribute access
    def get_attr(obj, attr):
        return obj.get(attr) if isinstance(obj, dict) else getattr(obj, attr)
    
    # Optimization Cache
    sync_cache = {} # { sub_id: { 'hash': str, 'ts': float } }
    master_positions_cache = {} # { m_id: {'positions': [], 'ts': float} }
    
    # ADAPTIVE POLLING STATE
    # Tracks when we last checked an idle master to prevent over-switching
    master_last_check = {} # { m_id: timestamp }
    master_has_activity = {} # { m_id: bool }

    last_config_mtime = 0

    while True:
        # 0. Auto-Reload Subscriptions (Hot-Reload)
        try:
            if os.path.exists(PERSISTENCE_FILE):
                mtime = os.path.getmtime(PERSISTENCE_FILE)
                if mtime > last_config_mtime:
                    load_subscriptions()
                    last_config_mtime = mtime
        except: pass

        try:
            # Check pause flag
            if worker_paused:
                time.sleep(1)
                continue
            
            # OPTIMIZATION: Don't start MT5 loop if there are no subscriptions
            with lock:
                all_subs = list(active_subscriptions)

            # Apply Master Filter (Multi-Process Support)
            if FILTER_MASTER_ID:
                current_subs = []
                for s in all_subs:
                    m = s.get('master')
                    # Normalize m
                    if not isinstance(m, dict) and hasattr(m, 'dict'): m = m.dict()
                    elif not isinstance(m, dict): m = m.__dict__
                    
                    if str(m.get('id')) == str(FILTER_MASTER_ID):
                        current_subs.append(s)
            else:
                current_subs = all_subs
            
            has_subs = len(current_subs) > 0
            
            if not has_subs:
                time.sleep(1)
                continue

            # Import here to avoid crash if MT5 not installed yet
            try:
                import MetaTrader5 as mt5
            except ImportError:
                log_print("⚠ MetaTrader5 module not found. Please pip install MetaTrader5.")
                time.sleep(5)
                continue

            # DEBUG TRACE
            # log_print("   ... Worker Loop Tick ...") 

            with mt5_lock:
                # 1. Ensure MT5 is Initialized
                
                # Cleanup popups BEFORE init/check
                close_popup_windows()
                
                try:
                    term_info = mt5.terminal_info()
                except Exception as e:
                    log_print(f"⚠ mt5.terminal_info() failed: {e}")
                    term_info = None

                if term_info:
                    # log_print(f"✓ MT5 Already Initialized (Connected: {term_info.connected})")
                    pass
                
                if not term_info:
                    log_print("⚠ MT5 not initialized. Attempting initialize()...")
                    init_success = False
                    path_arg = {}
                    if MT5_PATH:
                        path_arg['path'] = MT5_PATH
                        log_print(f"   -> Using path: {MT5_PATH}")

                    # Attempt 1: Connect to existing terminal (or launch)
                    # We loop here to aggressively close popups if init fails
                    for attempt in range(5):
                        try:
                            # Pre-emptive popup closing
                            close_popup_windows()
                            
                            # Increased timeout for IPC
                            # IMPORTANT: Must shutdown first to clear stale handles
                            mt5.shutdown()
                            
                            if mt5.initialize(timeout=30000, **path_arg):
                                init_success = True
                                log_print("   ✓ mt5.initialize() Success")
                                break
                            else:
                                err = mt5.last_error()
                                log_print(f"   ✗ mt5.initialize() Failed (Attempt {attempt+1}): {err}")
                                
                                # If IPC timeout (-10005), terminal might be hung or busy
                                if err[0] == -10005:
                                    log_print("     -> IPC Timeout detected. Skipping aggressive kill to protect other instances...")
                                    try:
                                        import os
                                        # DANGEROUS IN MULTI-INSTANCE: os.system("taskkill /F /IM terminal64.exe")
                                        log_print("     -> Waiting 5s before retry...")
                                        time.sleep(5) 
                                        
                                        # Robust Recovery: Manual Launch + Wait + Popup Kill
                                        # This prevents 'initialize' from getting stuck on the wizard
                                        
                                        # 1. Determine Path (Use explicit or find default)
                                        launch_path = MT5_PATH
                                        if not launch_path or not os.path.exists(launch_path):
                                            common_paths = [
                                                r"C:\Program Files\MetaTrader 5\terminal64.exe",
                                                r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe"
                                            ]
                                            for p in common_paths:
                                                if os.path.exists(p):
                                                    launch_path = p
                                                    log_print(f"     -> Found default MT5 path: {launch_path}")
                                                    break
                                        
                                        if launch_path and os.path.exists(launch_path):
                                            log_print(f"     -> Manually relaunching MT5 from: {launch_path}")
                                            
                                            # ENHANCED LAUNCH: Auto-Login with CLI Args
                                            cmd = [launch_path]
                                            
                                            # IMPORTANT: Maintain Portable Mode if detected
                                            # Also set CWD to the instance directory to ensure data is stored correctly
                                            launch_cwd = os.path.dirname(launch_path)
                                            
                                            if "MT5_Instances" in launch_path or "/portable" in str(sys.argv):
                                                cmd.append("/portable")

                                            if current_subs:
                                                m_launch = current_subs[0]['master']
                                                # Ensure dict
                                                if not isinstance(m_launch, dict) and hasattr(m_launch, 'dict'): m_launch = m_launch.dict()
                                                elif not isinstance(m_launch, dict): m_launch = m_launch.__dict__
                                                
                                                if m_launch.get('id') and m_launch.get('password'):
                                                    log_print(f"     -> Injecting Credentials for Auto-Login: {m_launch.get('id')}")
                                                    cmd.extend([
                                                        f"/login:{m_launch.get('id')}",
                                                        f"/password:{m_launch.get('password')}",
                                                        f"/server:{m_launch.get('server')}"
                                                    ])
                                            
                                            # CRITICAL FIX: Set cwd to instance directory
                                            subprocess.Popen(cmd, cwd=launch_cwd)
                                            log_print(f"     -> Process launched with CWD: {launch_cwd}")
                                            
                                            log_print("     -> Waiting 20s for GUI to load and popups to appear...")
                                            time.sleep(20) # Increased to 20s for slow servers
                                            close_popup_windows()
                                            log_print("     -> Popups closed. Ready for connection attempt.")
                                        else:
                                            log_print("     ⚠ Could not find 'terminal64.exe' to launch manually. Please use --mt5-path argument.")

                                    except Exception as kill_err:
                                        log_print(f"     -> Error during kill/restart: {kill_err}")
                        except Exception as e:
                             log_print(f"   ✗ mt5.initialize() Exception: {e}")
                        time.sleep(2)
                    
                    if not init_success:
                         log_print("✗ MT5 Init Failed (Timeout/Blocked). Retrying in 5s...")
                         time.sleep(5)
                         continue
                    
                    # Ensure any post-launch popups are closed
                    close_popup_windows()

                    # WAIT FOR GUI TO LOAD (Critical Fix for "Opened then Closed")
                    # If we login too fast, MT5 might crash or close.
                    log_print("   ⏳ Waiting 5s for MT5 GUI to stabilize...")
                    time.sleep(5)

                    # 2. Force Login (Critical for Fresh Instances)
                    # We do this immediately after init to clear any Wizards
                    if current_subs:
                         m_init = current_subs[0]['master']
                         if not isinstance(m_init, dict) and hasattr(m_init, 'dict'): m_init = m_init.dict()
                         elif not isinstance(m_init, dict): m_init = m_init.__dict__
                         
                         # OPTIMIZATION: Check if already logged in to avoid redundant login overhead
                         curr_info = mt5.account_info()
                         if curr_info and str(curr_info.login) == str(m_init.get('id')):
                             # Already logged in, skip force login
                             pass
                         else:
                             log_print(f"🔧 Force-Login Triggered for {m_init.get('id')}...")
                             # Debug: Check credentials (masked)
                             p_debug = str(m_init.get('password', ''))
                             p_masked = f"{p_debug[:2]}***{p_debug[-2:]}" if len(p_debug) > 4 else "***"
                             log_print(f"   🔑 Credentials: ID={m_init.get('id')} Server={m_init.get('server')} Pass={p_masked} (Len={len(p_debug)})")
                             
                             if mt5.login(login=int(m_init['id']), password=m_init['password'], server=m_init['server']):
                                 log_print(f"✅ Login Successful: {m_init['id']}")
                                 # Allow time for server connection
                                 time.sleep(0.5)
                             else:
                                 err = mt5.last_error()
                                 log_print(f"❌ Login Failed for {m_init['id']}: {err}")
                                 log_print(f"   -> Please CHECK Password and Server in Admin Panel.")

                # 3. Check Algo Trading Status (Global Check)
                try:
                    term_info = mt5.terminal_info()
                    if term_info and not term_info.trade_allowed:
                        # Use the first master's ID to target the correct window
                        target_id = None
                        if current_subs:
                            m_first = current_subs[0]['master']
                            if not isinstance(m_first, dict) and hasattr(m_first, 'dict'): m_first = m_first.dict()
                            elif not isinstance(m_first, dict): m_first = m_first.__dict__
                            target_id = m_first.get('id')
                            
                        force_enable_algo_trading(account_id=target_id)
                except: pass

            # 3. Group Subscriptions by Master
            subs_by_master = {}
            for sub in current_subs:
                m = sub['master']
                # Ensure m is a dict
                if not isinstance(m, dict) and hasattr(m, 'dict'): m = m.dict()
                elif not isinstance(m, dict): m = m.__dict__
                sub['master'] = m # Update reference
                
                m_id = str(m.get('id'))
                if m_id not in subs_by_master:
                    subs_by_master[m_id] = []
                subs_by_master[m_id].append(sub)

            # 4. Process Each Master Group
            for m_id, subs_list in subs_by_master.items():
                # WORKER FILTER: If we are a specific worker, skip other masters
                if args.master_id and str(m_id) != str(args.master_id):
                    continue

                if not subs_list: continue
                
                # ADAPTIVE POLLING REMOVED FOR STABILITY
                # Check master every loop iteration to ensure no trades are missed.
                master_last_check[m_id] = time.time()
                
                master = subs_list[0]['master']
                m_pass = master.get('password')
                m_server = master.get('server')
                m_platform = master.get('platform', 'MT5')
                
                master_positions = []
                master_valid = False

                # A. LOGIN MASTER & GET POSITIONS
                use_cache = False
                if m_platform != 'MT4':
                     # Check Cache
                     cached = master_positions_cache.get(m_id)
                     if cached and time.time() - cached['ts'] < 1.0: # 1s Cache
                         master_positions = cached['positions']
                         master_valid = True
                         use_cache = True
                         # log_print(f"   ⚡ Using Cached Master Positions for {m_id}")

                if m_platform == 'MT4':
                    with mt4_lock:
                        data = mt4_master_data.get(m_id)
                        if data and time.time() - data.get('last_seen', 0) < 15:
                            master_positions = data.get('positions', [])
                            master_valid = True
                elif not use_cache:
                    # MT5 Master
                    with mt5_lock:
                        # LOGGING: Explicitly state we are switching to Master
                        # print(f"🔄 Switching to Master {m_id} to read positions...")
                        
                        # OPTIMIZATION: Check if already logged in to skip sleep/re-login overhead
                        already_on_master = False
                        curr_check = mt5.account_info()
                        if curr_check and str(curr_check.login) == str(m_id):
                            already_on_master = True
                        
                        is_logged, err = safe_mt5_login(m_id, m_pass, m_server)
                        if is_logged:
                            # Wait a tiny bit for positions to sync after login (only if we switched)
                            if not already_on_master:
                                time.sleep(0.5)
                            
                            # CRITICAL: Verify we are actually on Master
                            curr_m = mt5.account_info()
                            if not curr_m or str(curr_m.login) != str(m_id):
                                log_print(f"   ⛔ CRITICAL: Master Login Mismatch! Expected {m_id}, Found {curr_m.login if curr_m else 'None'}. Skipping.")
                                master_valid = False
                                continue
                            
                            # DIAGNOSTIC: Print Account Details to help user debug "No Trade" issues
                            log_print(f"   📊 Master Info: {curr_m.name} | Server: {curr_m.server} | ID: {curr_m.login}")
                            
                            # DIAGNOSTIC: Check Margin Mode (Hedging vs Netting)
                            margin_mode = curr_m.margin_mode
                            mode_str = "UNKNOWN"
                            if margin_mode == mt5.ACCOUNT_MARGIN_MODE_RETAIL_NETTING: mode_str = "NETTING"
                            elif margin_mode == mt5.ACCOUNT_MARGIN_MODE_EXCHANGE: mode_str = "EXCHANGE"
                            elif margin_mode == mt5.ACCOUNT_MARGIN_MODE_RETAIL_HEDGING: mode_str = "HEDGING"
                            
                            log_print(f"      Status: Connected={term_info.connected} | Mode={mode_str} | Balance={curr_m.balance}")

                            if margin_mode == mt5.ACCOUNT_MARGIN_MODE_RETAIL_NETTING:
                                log_print("      ⚠ WARNING: Account is in NETTING mode! This might be why you see 'Netting'.")
                                log_print("                 If this is a Demo account, try creating a 'Hedging' account instead.")

                            if not term_info.connected:
                                log_print(f"      ❌ WARNING: MT5 Disconnected! Check Internet or Proxy on Server.")
                                
                            if str(curr_m.server) != str(m_server):
                                log_print(f"      ❌ CRITICAL SERVER MISMATCH! Script expects '{m_server}' but MT5 is on '{curr_m.server}'.")
                                log_print(f"      -> This explains why you don't see trades. You are on the wrong server!")

                            if not curr_m.trade_allowed:
                                log_print(f"      ⚠ WARNING: Trade is NOT allowed on Master. Investor Password? AutoTrading Disabled?")
                            
                            # CRITICAL FIX: Ensure symbols are selected so charts/prices work
                            ensure_view_visible()
                            
                            pos = mt5.positions_get()
                            if pos is not None:
                                log_print(f"      ℹ Raw Positions Found: {len(pos)}")
                                for p in pos:
                                    log_print(f"         - Ticket: {p.ticket} | Symbol: {p.symbol} | Magic: {p.magic} | Vol: {p.volume}")
                                
                                # FILTER ECHO TRADES: Ignore trades with magic=123456 (Slave Trades)
                                # This prevents infinite loops if we accidentally read Slave positions as Master
                                master_positions = [p for p in pos if p.magic != 123456]
                                
                                master_valid = True
                                
                                # UPDATE CACHE
                                master_positions_cache[m_id] = {
                                    'positions': master_positions,
                                    'ts': time.time()
                                }
                                
                                # Update Activity State
                                has_trades = len(pos) > 0
                                master_has_activity[m_id] = has_trades
                                if has_trades:
                                    log_print(f"📊 Master {m_id} has {len(pos)} open positions.")
                                else:
                                    # DEBUG: Check History if no active trades
                                    # Helps verify if trades are opening/closing instantly
                                    try:
                                        from datetime import datetime, timedelta
                                        from_date = datetime.now() - timedelta(minutes=5)
                                        history = mt5.history_deals_get(from_date, datetime.now())
                                        if history:
                                            log_print(f"   � Recent History (Last 5 mins): {len(history)} deals found.")
                                            for deal in history[-3:]: # Show last 3
                                                 log_print(f"      - Deal {deal.ticket}: {deal.symbol} {deal.volume} {deal.type} (Profit: {deal.profit})")
                                    except: pass
                            else:
                                log_print(f"⚠ Could not get positions for Master {m_id}")
                        else:
                            log_print(f"✗ Master Login Failed {m_id}: {err}")
                            # Mark all slaves as error
                            with lock:
                                for s in subs_list:
                                    subscription_states[s['id']] = {
                                        "status": "error", 
                                        "error": f"Master Login: {err}", 
                                        "updated_at": time.time()
                                    }
                            continue # Skip slaves

                # FORCE SLAVE PROCESSING EVEN IF MASTER LOGIN FAILED OR NO POSITIONS
                # User Requirement: Validate slave credentials regardless of master status.
                
                # If master login failed, we must NOT copy trades (safety).
                # If master has 0 positions, we must NOT copy trades (but might close stragglers).
                
                # FLAG: Are we in "Validation Only" mode?
                validation_only = False
                if not master_valid:
                     master_positions = [] # Treat as empty
                     validation_only = True
                
                # B. PROCESS SLAVES
                # Generate Master Hash (Thread-Safe & Platform Agnostic)
                try:
                    if not validation_only:
                        m_pos_hash = str(sorted([(get_attr(p, 'ticket'), get_attr(p, 'symbol'), get_attr(p, 'type'), get_attr(p, 'volume')) for p in master_positions]))
                    else:
                        m_pos_hash = "VALIDATION_ONLY"
                except:
                    m_pos_hash = str(time.time()) # Fallback

                for sub in subs_list:
                    sub_id = sub['id']
                    
                    # SAFETY: Prevent Self-Copying (Master == Slave)
                    # This avoids infinite loops and double exposure if user misconfigures.
                    if str(sub['master']['id']) == str(sub['slave']['id']):
                         update_slave_db_status(str(sub['slave']['id']), "failed", "Master and Slave IDs identical; self-copy denied")
                         log_print(f"   ⚠ SKIPPING Subscription {sub_id}: Master and Slave IDs are identical ({sub['master']['id']}). Self-copying is dangerous.")
                         try:
                             log_print(f"     Pair Details: Master({sub['master']['id']}, {sub['master'].get('server')}) -> Slave({sub['slave']['id']}, {sub['slave'].get('server')})")
                         except:
                             pass
                         continue

                    # Perform Sync
                    try:
                        log_print(f"   ▶ Processing Slave {sub['slave']['id']} (Sub: {sub_id})...")
                        with mt5_lock:
                            # Pass validation_only flag via a special kwargs or just rely on empty master_positions?
                            # Empty master_positions prevents opening new trades.
                            # BUT it might trigger CLOSE logic if the slave has open trades.
                            # DANGER: If master login failed, we shouldn't close slave trades!
                            # FIX: Modify process_slave_sync to accept a 'safe_mode' flag.
                            
                            process_slave_sync(sub, master_positions, safe_mode=validation_only)
                        
                        # Update Cache
                        sync_cache[sub_id] = {'hash': m_pos_hash, 'ts': time.time()}

                    except Exception as e:
                        log_print(f"⚠ Error syncing slave {sub.get('id')}: {e}")
                        import traceback
                        # traceback.print_exc() # Use log_print for traceback if needed, but keep it simple for now

            # Reduced sleep time for better responsiveness (High Frequency Loop)
            time.sleep(0.1)

        except Exception as e:
            log_print(f"✗ Worker Error: {e}")
            import traceback
            # traceback.print_exc()
            time.sleep(5)

# ---------------------------------------------------------
# PLATFORM HANDLERS
# ---------------------------------------------------------

def validate_mt5(details: MtAccountDetails):
    global worker_paused
    try:
        import MetaTrader5 as mt5
        
        # 1. PAUSE WORKER
        print(f"🔍 Validation Request for {details.id}. Pausing worker...")
        worker_paused = True
        time.sleep(0.5) 
        
        with mt5_lock:
            # ---------------------------------------------------------
            # OPTIMIZATION: FAST PATH
            # ---------------------------------------------------------
            path_arg = {}
            if MT5_PATH:
                path_arg['path'] = MT5_PATH

            is_initialized = mt5.initialize(
                **path_arg,
                login=int(details.id),
                password=details.password,
                server=details.server
            )
            
            if is_initialized:
                print(f"✓ MT5 already running. Verifying login for {details.id}...")
                authorized = mt5.login(login=int(details.id), password=details.password, server=details.server)
                
                if authorized:
                    info = mt5.account_info()
                    print(f"✅ FAST VALIDATION SUCCESS: Logged in to {info.login}")
                    worker_paused = False
                    return {"isValid": True}
                else:
                    err_code, err_desc = mt5.last_error()
                    
                    # Enhanced Error Mapping
                    error_map = {
                        10014: "Wrong Password or Invalid Account",
                        10015: "Connection Failed (Check Server/Internet)",
                        10027: "AutoTrading Disabled by Server",
                        10004: "Requote",
                        10013: "Invalid Request",
                    }
                    user_msg = error_map.get(err_code, f"{err_desc} ({err_code})")

                    if err_code == 10014 or err_code == -6 or "Authorization failed" in err_desc or "Invalid account" in err_desc:
                         print(f"✗ Fast Login Failed (Auth Error): {user_msg}")
                         worker_paused = False
                         return {"isValid": False, "error": f"Login Failed: {user_msg}"}
                    
                    print(f"⚠ Fast Login Failed (System Error {err_code}): {user_msg}. Retrying with Clean Slate...")

            # ---------------------------------------------------------
            # SLOW PATH: CLEAN SLATE RECOVERY
            # ---------------------------------------------------------
            print(f"🔧 Starting Clean-Slate Validation for {details.id}...")
            
            try:
                mt5.shutdown()
                # DISABLED DANGEROUS KILL: In multi-process mode, this kills ALL instances!
                # os.system("taskkill /F /IM terminal64.exe >nul 2>&1") 
                time.sleep(2)
            except:
                pass

            if not mt5.initialize(
                **path_arg,
                login=int(details.id),
                password=details.password,
                server=details.server,
                timeout=10000
            ):
                err_code, err_desc = mt5.last_error()
                worker_paused = False
                return {"isValid": False, "error": f"MT5 Launch/Login Failed: {err_desc} ({err_code})"}
            
            try:
                print(f"✓ MT5 Running from: {mt5.terminal_info().path}")
            except:
                pass

            info = mt5.account_info()
            if info:
                print(f"✅ VALIDATION SUCCESS (After Restart): Logged in to {info.login}")
                worker_paused = False
                return {"isValid": True}
            else:
                if mt5.login(login=int(details.id), password=details.password, server=details.server):
                    print(f"✅ VALIDATION SUCCESS (Explicit Login): Logged in to {details.id}")
                    worker_paused = False
                    return {"isValid": True}
                
                err_code, err_desc = mt5.last_error()
                error_map = {
                    10014: "Wrong Password or Invalid Account",
                    10015: "Connection Failed (Check Server/Internet)",
                    10027: "AutoTrading Disabled by Server",
                    10004: "Requote",
                    10013: "Invalid Request",
                }
                user_msg = error_map.get(err_code, f"{err_desc} ({err_code})")
                worker_paused = False
                return {"isValid": False, "error": f"Login Failed: {user_msg}"}

    except Exception as e:
        worker_paused = False
        return {"isValid": False, "error": str(e)}

def validate_mt4(details: MtAccountDetails):
    print(f"🔍 Validating MT4 account {details.id}...")
    
    with mt4_lock:
        data = mt4_master_data.get(details.id)
        
    if data:
        last_seen = data.get('last_seen', 0)
        if time.time() - last_seen < 60:
             print(f"✅ MT4 Account {details.id} is active (Last seen: {int(time.time() - last_seen)}s ago)")
             return {"isValid": True}
        else:
             return {"isValid": False, "error": f"MT4 EA connected but inactive (>60s silence)."}
    
    print(f"⚠ MT4 Account {details.id} not seen yet. Assuming pending EA installation.")
    return {"isValid": True, "warning": "Waiting for EA connection..."}

@app.post("/accounts/validate", dependencies=[Depends(verify_api_key)])
def validate_account(details: MtAccountDetails):
    print(f"🔍 Validating account {details.id} on {details.server} ({details.platform})")
    
    if details.platform == 'MT5':
        return validate_mt5(details)
    elif details.platform == 'MT4':
        return validate_mt4(details)
    else:
        return {"isValid": False, "error": "Unsupported Platform"}


# ---------------------------------------------------------
# MT4 BRIDGE ENDPOINTS
# ---------------------------------------------------------

class MT4DataPush(BaseModel):
    account_id: str
    password: str
    positions: List[dict]
    account_info: dict

@app.post("/mt4/push")
def mt4_push_data(data: MT4DataPush):
    """
    Called by MT4 EA (Master) to push its current state.
    """
    with mt4_lock:
        mt4_master_data[data.account_id] = {
            "positions": data.positions,
            "info": data.account_info,
            "last_seen": time.time()
        }
        print(f"📥 Received update from MT4 Master {data.account_id}: {len(data.positions)} positions")
    
    return {"status": "ok"}

@app.get("/mt4/poll/{account_id}")
def mt4_poll_commands(account_id: str):
    """
    Called by MT4 EA (Slave) to get pending commands.
    """
    with mt4_lock:
        commands = mt4_slave_commands.get(account_id, [])
        if commands:
            mt4_slave_commands[account_id] = []
            print(f"📤 Sent {len(commands)} commands to MT4 Slave {account_id}")
        
    return {"commands": commands}

@app.post("/upload/server-definition", dependencies=[Depends(verify_api_key)])
async def upload_server_definition(file: UploadFile = File(...)):
    """
    Allows Admin to upload .srv files remotely to fix 'Unknown Server' errors.
    Files are saved to public/uploads where manager.py can find them.
    Also backs up to local 'uploads' directory for redundancy.
    """
    if not file.filename.endswith(".srv") and not file.filename.endswith(".dat"):
        raise HTTPException(status_code=400, detail="Only .srv or .dat files are allowed")
    
    try:
        # Determine Upload Paths
        paths = []
        
        # 1. Public Uploads (Shared/Synced)
        public_dir = os.path.join(os.path.dirname(__file__), "..", "public", "uploads")
        if not os.path.exists(public_dir):
            os.makedirs(public_dir)
        paths.append(os.path.join(public_dir, file.filename))
        
        # 2. Local Service Uploads (Redundancy)
        local_dir = os.path.join(os.path.dirname(__file__), "uploads")
        if not os.path.exists(local_dir):
            os.makedirs(local_dir)
        paths.append(os.path.join(local_dir, file.filename))
        
        # Save to all locations
        content = await file.read()
        
        for p in paths:
            # FORCE OVERWRITE: Remove Read-Only attribute if file exists
            if os.path.exists(p):
                try:
                    os.chmod(p, 0o777)
                    os.remove(p) # Try to delete it first to ensure clean write
                except Exception as del_err:
                    print(f"⚠ Could not delete existing file {p}: {del_err}")

            with open(p, "wb") as buffer:
                buffer.write(content)
            print(f"   -> Saved to: {p}")
            
        print(f"📥 Received Server Definition: {file.filename}")
        print(f"   -> Manager will detect this on next instance launch/sync.")
        
        return {"status": "success", "filename": file.filename, "paths": paths, "message": "File uploaded. Restart the subscription/service to apply."}
        
    except Exception as e:
        print(f"❌ Upload Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/server-definitions", dependencies=[Depends(verify_api_key)])
async def list_server_definitions():
    """
    Lists all uploaded .srv and .dat files in the public/uploads directory and local uploads.
    """
    try:
        dirs = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "uploads")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))
        ]
        
        print(f"📂 Listing server definitions from: {dirs}")
            
        files_map = {} # Use dict to deduplicate by name
        
        for d in dirs:
            if not os.path.exists(d):
                try:
                    os.makedirs(d, exist_ok=True)
                    print(f"   -> Created missing directory: {d}")
                except:
                    print(f"   -> Missing directory: {d}")
                    continue
            
            print(f"   -> Scanning {d}...")
            try:
                for f in os.listdir(d):
                    if f.lower().endswith(".srv") or f.lower() == "servers.dat":
                        file_path = os.path.join(d, f)
                        try:
                            size = os.path.getsize(file_path)
                            # If duplicate, this overwrites, which is fine (shows latest size)
                            files_map[f] = {"name": f, "size": size}
                            print(f"      Found: {f} ({size} bytes)")
                        except OSError as e:
                             print(f"      ⚠ Error reading file {f}: {e}")
            except Exception as e:
                print(f"   ⚠ Error scanning dir {d}: {e}")
                
        return {"files": list(files_map.values())}
    except Exception as e:
        print(f"❌ Failed to list files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@app.get("/system/debug-files")
async def debug_files_system():
    """
    Debug endpoint to check file system paths and permissions.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.abspath(os.path.join(base_dir, "..", "public", "uploads"))
    local_dir = os.path.abspath(os.path.join(base_dir, "uploads"))
    
    return {
        "cwd": os.getcwd(),
        "base_dir": base_dir,
        "dirs": {
            "public": {
                "path": public_dir,
                "exists": os.path.exists(public_dir),
                "files": os.listdir(public_dir) if os.path.exists(public_dir) else []
            },
            "local": {
                "path": local_dir,
                "exists": os.path.exists(local_dir),
                "files": os.listdir(local_dir) if os.path.exists(local_dir) else []
            }
        }
    }

# ... (imports)

def reload_subscriptions_if_changed():
    """
    Checks if subscriptions_v2.json has changed and reloads if necessary.
    Crucial for API Mode to stay in sync with Manager/DB.
    """
    global last_config_mtime
    try:
        if os.path.exists(PERSISTENCE_FILE):
            mtime = os.path.getmtime(PERSISTENCE_FILE)
            if mtime > last_config_mtime:
                load_subscriptions()
                last_config_mtime = mtime
    except Exception as e:
        print(f"⚠ Failed to check/reload subscriptions: {e}")

@app.post("/subscriptions", dependencies=[Depends(verify_api_key)])
async def create_subscription(sub: SubscriptionRequest):
    reload_subscriptions_if_changed() # Ensure we have latest state before adding
    print(f"➕ Starting copy from {sub.master.id} to {sub.slave.id}")

    
    with lock:
        # Check for existing identical subscription (same master+slave)
        # We check if ANY existing subscription has same master ID and slave ID
        duplicate = next((x for x in active_subscriptions if 
                          str(x['master']['id']) == str(sub.master.id) and 
                          str(x['slave']['id']) == str(sub.slave.id) and
                          x['id'] != sub.externalId), None)
        
        if duplicate:
             print(f"⚠ Duplicate Subscription Detected! {sub.externalId} matches existing {duplicate['id']}")
             # IDEMPOTENCY FIX: 
             # Instead of erroring, we treat this as a success.
             # We return the EXISTING ID so the frontend knows it's connected.
             # We also update the settings of the existing subscription just in case.
             duplicate['settings'] = sub.settings
             duplicate['master'] = sub.master # Update credentials if changed
             duplicate['slave'] = sub.slave
             save_subscriptions()
             return {"success": True, "id": duplicate['id'], "message": "Subscription already active (updated)"}

        existing = next((x for x in active_subscriptions if x['id'] == sub.externalId), None)
        
        if existing:
            existing['master'] = sub.master
            existing['slave'] = sub.slave
            existing['settings'] = sub.settings
            print(f"✏ Subscription {sub.externalId} updated with new details.")
        else:
            active_subscriptions.append({
                "id": sub.externalId,
                "master": sub.master,
                "slave": sub.slave,
                "settings": sub.settings
            })
            print(f"✅ Subscription {sub.externalId} added to active list.")
            
    save_subscriptions()
            
    return {"success": True, "id": sub.externalId}

@app.post("/subscriptions/{id}", dependencies=[Depends(verify_api_key)])
async def delete_subscription(id: str, action: SubscriptionAction):
    if action.action == 'delete':
        print(f"🗑 Stopping subscription {id}")
        with lock:
            global active_subscriptions
            active_subscriptions = [x for x in active_subscriptions if x['id'] != id]
        
        save_subscriptions()
            
        return {"success": True}
    return {"success": False, "error": "Invalid action"}

@app.get("/subscriptions/{id}/status", dependencies=[Depends(verify_api_key)])
async def get_status(id: str):
    # reload_subscriptions_if_changed() # Removed to prevent blocking. Worker handles reloading.
    with lock:

        exists = any(x['id'] == id for x in active_subscriptions)
        if not exists:
             return {"status": "disconnected", "detail": "Subscription not found"}
        
        state = subscription_states.get(id)
        if state:
            return {
                "status": state['status'], 
                "detail": state.get('detail') or state.get('error'), 
                "updated_at": state.get('updated_at'),
                "master_positions": state.get('master_positions'),
                "slave_positions": state.get('slave_positions'),
                "last_action": state.get('last_action')
            }
        
        return {"status": "initializing", "detail": "Waiting for worker cycle"}

@app.post("/system/reset", dependencies=[Depends(verify_api_key)])
async def reset_system():
    """
    Emergency endpoint to clear all subscriptions and state.
    """
    print("🔄 SYSTEM RESET REQUESTED. Clearing all subscriptions...")
    with lock:
        global active_subscriptions
        active_subscriptions = []
        subscription_states.clear()
    
    save_subscriptions()
    return {"status": "success", "message": "All subscriptions cleared."}

if __name__ == "__main__":
    # Unified Entry Point
    # Args are already parsed at the top level as 'args'
    
    if args.worker:
        print("════════════════════════════════════════════════════════════")
        print(f"🚀 STARTING WORKER MODE (Master: {args.master_id})")
        print("════════════════════════════════════════════════════════════")
        
        # Override MT5 Path if provided
        if args.mt5_path:
            MT5_PATH = args.mt5_path

        # Load subscriptions manually
        load_subscriptions()
        
        # Run Worker (Blocking)
        try:
            copy_trade_worker()
        except KeyboardInterrupt:
            print("🛑 Worker Stopped.")
        except Exception as e:
            print(f"❌ Worker Error: {e}")
        sys.exit(0)

    # Default / API Mode
    port = 8000
    
    print("════════════════════════════════════════════════════════════")
    print(f"🚀 STARTING MT5 COPY TRADING SERVICE ON 0.0.0.0:{port}")
    print("════════════════════════════════════════════════════════════")
    print("════════════════════════════════════════════════════════════")
    print("⚠ CRITICAL ONE-TIME SETUP:")
    print("  1. Open MT5 -> Tools -> Options -> Expert Advisors")
    print("  2. UNCHECK: 'Disable automated trading when the account has been changed'")
    print("  3. CHECK: 'Allow Algorithmic Trading'")
    print("  4. Click OK. (This applies to ALL accounts globally)")
    print("════════════════════════════════════════════════════════════")
    
    # Run API
    
    # Start Worker in Background Thread
    if not args.api_only:
        print("🚀 Starting Background Copy Trade Worker...")
        worker_thread = threading.Thread(target=copy_trade_worker, daemon=True)
        worker_thread.start()
    else:
        print("📡 API Mode Started (Worker Disabled - Managed by Manager)")

    uvicorn.run(app, host="0.0.0.0", port=port)
