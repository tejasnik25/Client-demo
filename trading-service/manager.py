import subprocess
import sys
import time
import os
import shutil
import json
import glob

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# Check for command line argument override or Environment Variable
if "--production" in sys.argv:
    APP_ENV = "production"
else:
    APP_ENV = os.environ.get("APP_ENV", "local")

BASE_MT5_PATH = os.environ.get("MT5_PATH", r"C:\Program Files\MetaTrader 5")
INSTANCES_DIR = os.path.abspath("MT5_Instances")

# Dynamic path resolution for production
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUBSCRIPTION_FILES = [
    "subscriptions_v2.json",
    "subscription2.json",
    os.path.join(BASE_DIR, "subscriptions_v2.json"),
    os.path.join(BASE_DIR, "..", "subscriptions_v2.json"),
    os.path.join(os.getcwd(), "subscriptions_v2.json"),
    # Look in parent/public/uploads where API might save it
    os.path.abspath(os.path.join(BASE_DIR, "..", "public", "uploads", "subscriptions_v2.json")),
    # Production path common pattern
    os.path.abspath(os.path.join(BASE_DIR, "..", "..", "subscriptions_v2.json")),
    r"C:\inetpub\wwwroot\subscriptions_v2.json", 
]
    
# Global Process Registry
processes = {} # {master_id: subprocess.Popen}
api_process = None
last_db_mtime = 0

def sync_subscriptions_from_db():
    """
    Fallback: Reads ../src/db/database.json and generates subscriptions_v2.json
    if it doesn't exist or is outdated.
    """
    global last_db_mtime
    try:
        db_path = os.path.join(BASE_DIR, "..", "src", "db", "database.json")
        if not os.path.exists(db_path):
            # print(f"⚠ DB Path not found: {db_path}") # Silent to avoid log spam
            return False
            
        # Check modification time to avoid unnecessary writes
        current_mtime = os.path.getmtime(db_path)
        sub_path = os.path.join(BASE_DIR, "subscriptions_v2.json")
        
        if os.path.exists(sub_path) and current_mtime <= last_db_mtime:
            return False # No changes in DB
            
        last_db_mtime = current_mtime
        
        with open(db_path, 'r') as f:
            data = json.load(f)
            
        strategies = {s['id']: s for s in data.get('strategies', [])}
        transactions = data.get('wallet_transactions', [])
        
        # We derive active subscriptions from COMPLETED transactions
        # This bypasses 'running_strategies' which might be missing or out of sync.
        
        print(f"🔍 Sync: Found {len(transactions)} txs, {len(strategies)} strats")
        
        subs = []
        processed_keys = set() # To avoid duplicates (user_id + strategy_id)
        
        # Sort transactions by date (newest first) to get latest settings if multiple exist
        # Assuming created_at is ISO string
        transactions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        for tx in transactions:
            # 1. Filter Valid Transactions
            if tx.get('status') != 'completed':
                continue
                
            # Optional: Check transaction_type if needed (e.g. 'deposit')
            if tx.get('transaction_type') != 'deposit':
                continue
                
            uid = tx.get('user_id')
            sid = tx.get('strategy_id')
            
            if not uid or not sid:
                continue
                
            # unique key for subscription
            key = f"{uid}_{sid}"
            if key in processed_keys:
                continue # Already processed latest tx for this user/strategy
                
            processed_keys.add(key)
            
            # 2. Get Strategy (Master Details)
            strat = strategies.get(sid)
            if not strat:
                print(f"   ⚠ Strategy {sid} not found for tx {tx.get('id')}")
                continue
                
            master_id = strat.get('masterAccountId')
            master_pass = strat.get('masterAccountPassword')
            master_server = strat.get('masterAccountServer')
            
            if not master_id:
                print(f"   ⚠ Master ID missing in strategy {sid}")
                continue

            # 3. Get Slave Details (From Transaction)
            slave_id = tx.get('mt_account_id')
            slave_pass = tx.get('mt_account_password')
            slave_server = tx.get('mt_account_server', 'MetaQuotes-Demo') # Default if missing
            
            if not slave_id or not slave_pass:
                print(f"   ⚠ Slave credentials missing in tx {tx.get('id')}")
                continue

            # 4. Construct Subscription
            sub = {
                "id": f"sub_{uid}_{sid}", # Generate a stable ID
                "externalId": tx.get('id'),
                "master": {
                    "id": str(master_id),
                    "password": master_pass,
                    "server": master_server,
                    "platform": strat.get('masterPlatform', 'MT5')
                },
                "slave": {
                    "id": str(slave_id),
                    "password": slave_pass,
                    "server": slave_server,
                    "platform": tx.get('platform', 'MT5')
                },
                "settings": {
                    "riskType": "balance_multiplier",
                    "riskValue": 1.0
                }
            }
            subs.append(sub)
            
        if subs:
            out_path = os.path.join(BASE_DIR, "subscriptions_v2.json")
            with open(out_path, 'w') as f:
                json.dump(subs, f, indent=2)
            print(f"✅ Synced {len(subs)} subscriptions from DB to {out_path}")
            return True
            
    except Exception as e:
        print(f"⚠ DB Sync Failed: {e}")
        
    return False

def find_mt5_exe():
    """Finds the base terminal64.exe"""
    candidates = [
        os.path.join(BASE_MT5_PATH, "terminal64.exe"),
        r"C:\Program Files\MetaTrader 5\terminal64.exe",
        r"D:\MetaTrader 5\terminal64.exe"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def find_subscriptions():
    """Locates the subscription file"""
    for f in SUBSCRIPTION_FILES:
        if os.path.exists(f):
            return f
    return None

def setup_instance(master_id, base_exe_path):
    """
    Creates a dedicated folder for this Master and copies MT5 files.
    """
    target_dir = os.path.join(INSTANCES_DIR, f"Master_{master_id}")
    if not os.path.exists(target_dir):
        print(f"📦 Creating Instance for Master {master_id} (Local Copy - No Internet Download)...")
        try:
            os.makedirs(target_dir)
            
            # Copy Essentials (EXE + DLLs)
            source_dir = os.path.dirname(base_exe_path)
            
            # Critical files needed for MT5 to run minimally
            critical_extensions = ['.exe', '.dll', '.dat']
            
            # Files to copy
            for item in os.listdir(source_dir):
                s = os.path.join(source_dir, item)
                d = os.path.join(target_dir, item)
                
                # Skip heavy folders (Data is generated fresh)
                if os.path.isdir(s):
                    # Copy 'config' if exists, skip others like 'Bases', 'MQL5' (unless needed?)
                    # MT5 needs minimal files to start.
                    if item.lower() in ['config']:
                        try:
                            shutil.copytree(s, d, dirs_exist_ok=True)
                        except: pass
                    continue
                
                # Copy Files (EXE, DLL, DAT)
                _, ext = os.path.splitext(item)
                if os.path.isfile(s) and ext.lower() in critical_extensions:
                    try:
                        shutil.copy2(s, d)
                    except Exception as e:
                        print(f"   ⚠ Failed to copy {item}: {e}")
        except Exception as e:
            print(f"❌ Failed to create instance for {master_id}: {e}")
            return None

    return os.path.join(target_dir, "terminal64.exe")

def start_api():
    """Starts the API Server (Port 8000)"""
    global api_process
    print("🌐 Starting API Server...")
    cmd = [sys.executable, "main.py", "--api-only"]
    api_process = subprocess.Popen(cmd, cwd=BASE_DIR)

def launch_terminal(exe_path, login, password, server):
    """
    Explicitly launches the MT5 terminal with login credentials.
    This forces the terminal to log in and bypasses the 'Open Account' wizard.
    """
    try:
        # Check if already running
        # (Simple check: if we just spawned it, we might not need to do anything, 
        # but for robustness we can try to find it. 
        # However, for now, we assume if the worker is down, we might need to relaunch the terminal too 
        # OR the worker will attach to the existing one.)
        
        # Actually, best practice: Launch it detached.
        # Arguments for MT5: /login:123 /password:pass /server:Server
        
        cmd = [
            exe_path,
            f"/login:{login}",
            f"/password:{password}",
            f"/server:{server}",
            "/portable" # Ensure it runs in portable mode to use local config
        ]
        
        # print(f"🖥 Launching Terminal for {login}...") # Don't print password
        print(f"🖥 Launching Terminal for {login} (Server: {server}, Password: {'*' * len(str(password))})...")
        
        # Use Popen to launch independent process
        subprocess.Popen(cmd, cwd=os.path.dirname(exe_path))
        
        # Wait a bit for it to start
        time.sleep(5)
        return True
    except Exception as e:
        print(f"❌ Failed to launch terminal for {login}: {e}")
        return False

def start_worker(master_id, exe_path):
    """Starts a Worker Process"""
    print(f"👷 Starting Worker for Master {master_id}...")
    cmd = [
        sys.executable, "main.py", 
        "--worker", 
        "--master-id", str(master_id),
        "--mt5-path", exe_path
    ]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes[master_id] = p

def main():
    print("════════════════════════════════════════════════════════════")
    print("🚀 MULTI-TERMINAL MANAGER (ROLLBACK)")
    print(f"🌍 ENVIRONMENT: {APP_ENV.upper()}")
    print("════════════════════════════════════════════════════════════")
    
    # 1. Locate MT5
    exe_path = find_mt5_exe()
    if not exe_path:
        print("❌ Critical: MT5 terminal64.exe not found.")
        return
    print(f"✔ Found Base MT5: {exe_path}")

    # 2. Start API
    start_api()
    
    # 3. Monitor Loop
    printed_local_msg = set()
    
    while True:
        try:
            # Monitor API Server
            if api_process and api_process.poll() is not None:
                print("⚠ API Server died. Restarting...")
                start_api()

            # Sync from DB (if changed)
            sync_subscriptions_from_db()

            sub_file = find_subscriptions()
            if sub_file:
                try:
                    with open(sub_file, 'r') as f:
                        data = json.load(f)
                        
                    # Extract Masters with Credentials
                    masters = {} # {id: {password, server}}
                    for sub in data:
                        m = sub.get('master', {})
                        if isinstance(m, dict):
                            mid = str(m.get('id'))
                            if mid:
                                masters[mid] = {
                                    "password": m.get('password', ''),
                                    "server": m.get('server', 'MetaQuotes-Demo')
                                }
                            
                    # Spawn missing workers
                    for mid, creds in masters.items():
                        if mid not in processes or processes[mid].poll() is not None:
                            
                            # ENV CHECK: Only launch terminals in production
                            if APP_ENV != 'production':
                                if mid not in printed_local_msg:
                                    print(f"ℹ [Local Mode] Detected Master {mid}, but skipping MT5 Launch/Worker.")
                                    print(f"   (To enable, set APP_ENV=production)")
                                    printed_local_msg.add(mid)
                                continue

                            # Create Instance
                            inst_exe = setup_instance(mid, exe_path)
                            
                            # Launch Terminal Explicitly (Auto-Login)
                            launch_terminal(inst_exe, mid, creds['password'], creds['server'])
                            
                            # Start Worker
                            start_worker(mid, inst_exe)
                            
                except Exception as e:
                    print(f"⚠ Error reading subscriptions: {e}")
            else:
                print("⏳ Waiting for subscriptions_v2.json...")
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
            if api_process: api_process.terminate()
            for p in processes.values():
                p.terminate()
            break

if __name__ == "__main__":
    main()
