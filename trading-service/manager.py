import subprocess
import sys
import time
import os
import shutil
import json
import glob
import urllib.request
import ssl
try:
    import mysql.connector
except ImportError:
    mysql = None
    print("⚠ Warning: mysql-connector-python not found. Database features will be disabled.")

# ---------------------------------------------------------
# DB CONFIGURATION
# ---------------------------------------------------------
# Load .env file
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_HOST = os.environ.get("DB_HOST", "stock-analysis-db.cx8ioemygq4m.ap-south-1.rds.amazonaws.com")
DB_USER = os.environ.get("DB_USER", "admin")
DB_PASS = os.environ.get("DB_PASS", os.environ.get("DB_PASSWORD", "Client_demo_25"))
DB_NAME = os.environ.get("DB_NAME", "stock_analysis_db")

print(f"🔌 DB Config: Host={DB_HOST}, User={DB_USER}, DB={DB_NAME}")

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# Check for command line argument override or Environment Variable
if "--production" in sys.argv:
    APP_ENV = "production"
else:
    APP_ENV = os.environ.get("APP_ENV", "local")

# Clean API_URL: remove spaces, newlines, and quotes that might have been accidentally added
API_URL = os.environ.get("API_URL", "").strip().strip("'").strip('"') 

if API_URL:
    print(f"🌍 API URL Configured: [{API_URL}]")
else:
    print("⚠️ No API_URL configured. Using local DB only.")

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

def get_subscriptions_from_db():
    """
    Reads subscriptions.
    Priority 1: database.json (Source of Truth - if available)
    Priority 2: subscriptions_v2.json (API Cache - if DB missing)
    Auto-creates subscriptions_v2.json if missing.
    """
    global last_db_mtime
    
    # Path to API Cache File
    api_file = os.path.join(BASE_DIR, "subscriptions_v2.json")

    # -1. Try MySQL Database (Ultimate Source of Truth)
    try:
        # INCREASED TIMEOUT: Added connection_timeout to prevent hanging if RDS is slow or unreachable
        conn = mysql.connector.connect(
            host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME,
            connection_timeout=10
        )
        cursor = conn.cursor(dictionary=True)
        
        # Query running strategies and join with wallet transactions/strategies
        query = """
        SELECT 
            rs.id AS rs_id,
            rs.user_id,
            rs.strategy_id,
            rs.plan,
            rs.status,
            s.master_account_id,
            s.master_account_password,
            s.master_account_server,
            s.master_platform,
            COALESCE(rsm.mt_account_id, wt.mt_account_id) AS slave_id,
            COALESCE(rsm.mt_account_password, wt.mt_account_password) AS slave_password,
            COALESCE(rsm.mt_account_server, wt.mt_account_server) AS slave_server,
            COALESCE(rsm.platform, wt.platform) AS slave_platform
        FROM running_strategies rs
        JOIN strategies s ON rs.strategy_id = s.id
        LEFT JOIN running_strategy_modifications rsm ON rsm.id = (
             SELECT id FROM running_strategy_modifications
             WHERE running_strategy_id = rs.id
             ORDER BY created_at DESC LIMIT 1
        )
        LEFT JOIN wallet_transactions wt ON wt.id = (
             SELECT id FROM wallet_transactions 
             WHERE user_id = rs.user_id AND strategy_id = rs.strategy_id 
             ORDER BY created_at DESC LIMIT 1
        )
        WHERE rs.status IN ('in-process', 'active') 
        AND s.master_account_id IS NOT NULL
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        mysql_subs = []
        for row in rows:
            if not row['slave_id'] or not row['slave_password']:
                continue
            
            # SANITIZATION: Remove invisible Unicode characters (like LRM \u200e)
            if row['slave_id']:
                row['slave_id'] = str(row['slave_id']).replace('\u200e', '').strip()
            if row['master_account_id']:
                row['master_account_id'] = str(row['master_account_id']).replace('\u200e', '').strip()
            if row['slave_server']:
                row['slave_server'] = row['slave_server'].replace('\u200e', '').strip()

            # Validate Numeric IDs (MT5 requires numeric login)
            if not str(row['slave_id']).isdigit():
                print(f"⚠ Skipping Subscription with Invalid Non-Numeric Slave ID: {row['slave_id']} (User: {row['user_id']})")
                continue
                
            master_id_str = str(row['master_account_id'])
            if not master_id_str.isdigit():
                 print(f"⚠ Skipping Subscription with Invalid Non-Numeric Master ID: {master_id_str}")
                 continue
            
            # HOTFIX: Correct Server for Slave 25285165 (Database has wrong 'Tickmill-Demo' value)
            slave_server = (row['slave_server'] or 'MetaQuotes-Demo').replace('\u200e', '').strip()
            if str(row['slave_id']) == '25285165' and 'Tickmill' in slave_server:
                print(f"🔧 HOTFIX: Overriding incorrect server '{slave_server}' for Slave 25285165 -> 'RoboForex-Pro'")
                slave_server = 'RoboForex-Pro'

            sub = {
                "id": f"sub_{row['user_id']}_{row['strategy_id']}_{row['slave_id']}",
                "externalId": row['rs_id'],
                "master": {
                    "id": str(row['master_account_id']),
                    "password": row['master_account_password'],
                    "server": row['master_account_server'],
                    "platform": row['master_platform'] or 'MT5'
                },
                "slave": {
                    "id": str(row['slave_id']),
                    "password": row['slave_password'],
                    "server": slave_server,
                    "platform": row['slave_platform'] or 'MT5'
                },
                "settings": {"riskType": "balance_multiplier", "riskValue": 1.0}
            }
            mysql_subs.append(sub)
            
        # Check for duplicate slave usage across DIFFERENT masters
        slave_master_map = {}
        for sub in mysql_subs:
            s_id = sub['slave']['id']
            m_id = sub['master']['id']
            if s_id in slave_master_map and slave_master_map[s_id] != m_id:
                print(f"⚠ WARNING: Slave {s_id} is assigned to MULTIPLE Masters! ({slave_master_map[s_id]} and {m_id})")
                # Potential Logic: We could mark it as invalid or skip, but for now just warn
            slave_master_map[s_id] = m_id
            
        conn.close()
        
        if mysql_subs:
            # print(f"✅ Loaded {len(mysql_subs)} subscriptions from MySQL.")
            # Sync to Cache File
            try:
                with open(api_file, 'w') as f:
                    json.dump(mysql_subs, f, indent=2)
            except: pass
            return mysql_subs
            
    except Exception as e:
        print(f"⚠ MySQL Fetch Failed: {e}")
        pass

    # 0. Try Remote Fetch (Active Pull)
    if API_URL:
        try:
            # Clean URL: remove trailing slash if present
            base_url = API_URL.rstrip('/')
            target_url = f"{base_url}/api/public/export-subscriptions"
            
            # Ensure protocol
            if not target_url.startswith("http"):
                target_url = "https://" + target_url
                
            # Create unverified SSL context to avoid certificate errors on Windows
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
                
            req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10, context=ctx) as response:
                if response.status == 200:
                    raw_data = response.read().decode('utf-8')
                    try:
                        data = json.loads(raw_data)
                        if isinstance(data, list):
                            # Update cache
                            with open(api_file, 'w') as f:
                                json.dump(data, f, indent=2)
                            return data
                        else:
                            print(f"⚠ Remote Fetch Warning: Expected list, got {type(data)}")
                    except json.JSONDecodeError:
                        print(f"⚠ Remote Fetch Error: Invalid JSON response. Content: {raw_data[:100]}...")
                else:
                    error_body = response.read().decode('utf-8')
                    print(f"⚠ Remote Fetch Error: HTTP {response.status}")
                    print(f"⚠ Server Response: {error_body[:500]}") # Print first 500 chars of error

        except Exception as e:
            print(f"⚠ Remote Fetch Failed: {e}")

    # 1. Try Local Database (Preferred Source of Truth)
    candidates = [
        os.path.join(BASE_DIR, "..", "src", "db", "database.json"),
        os.path.join(BASE_DIR, "database.json"),
        os.path.join(os.getcwd(), "database.json"),
        r"C:\Users\Administrator\Desktop\src\db\database.json",
    ]
    
    db_path = None
    for p in candidates:
        if os.path.exists(p):
            db_path = p
            break
    
    if db_path:
        try:
            with open(db_path, 'r') as f:
                data = json.load(f)
                
            # Convert DB format to Subscription format
            strategies = {s['id']: s for s in data.get('strategies', [])}
            transactions = data.get('wallet_transactions', [])
            subs = []
            transactions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            processed_keys = set()
            
            for tx in transactions:
                if tx.get('status') != 'completed': continue
                uid = tx.get('userId')
                sid = tx.get('strategyId')
                slave_id = tx.get('mt_account_id')
                
                if not slave_id: continue

                key = f"{uid}_{sid}_{slave_id}"
                if key in processed_keys: continue
                processed_keys.add(key)
                
                strat = strategies.get(sid)
                if not strat: continue
                
                master_id = strat.get('masterAccountId')
                master_pass = strat.get('masterAccountPassword')
                master_server = strat.get('masterAccountServer')
                
                # Filter out invalid Master IDs (e.g. "None", "null")
                if not master_id or str(master_id).lower() in ['none', 'null']: continue
                if not master_pass or not master_server: continue

                slave_pass = tx.get('mt_account_password')
                slave_server = tx.get('mt_account_server', 'MetaQuotes-Demo')
                
                if not slave_pass: continue

                sub = {
                    "id": f"sub_{uid}_{sid}_{slave_id}",
                    "externalId": tx.get('id'),
                    "master": {
                        "id": str(master_id).strip().replace('\u200e', ''),
                        "password": master_pass,
                        "server": master_server,
                        "platform": strat.get('masterPlatform', 'MT5')
                    },
                    "slave": {
                        "id": str(slave_id).strip().replace('\u200e', ''),
                        "password": slave_pass,
                        "server": slave_server,
                        "platform": tx.get('platform', 'MT5')
                    },
                    "settings": {"riskType": "balance_multiplier", "riskValue": 1.0}
                }
                subs.append(sub)
            
            # Sync to Cache File (Real-time update)
            try:
                with open(api_file, 'w') as f:
                    json.dump(subs, f, indent=2)
            except: pass
            
            return subs
        except Exception:
            pass # Fallback to API file

    # 2. Try API Push File (Fallback)
    if os.path.exists(api_file):
        try:
            with open(api_file, 'r') as f:
                data = json.load(f)
                return data
        except:
            return []

    # 3. Auto-Create if Missing
    try:
        with open(api_file, 'w') as f:
            json.dump([], f)
        print("ℹ Created new subscriptions_v2.json file.")
    except: pass

    return []

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

def kill_existing_mt5(exe_path):
    """
    Force kills any running process from this specific executable path.
    This ensures we don't have zombie processes or 'already running' issues.
    """
    try:
        import psutil
        for proc in psutil.process_iter(['pid', 'name', 'exe']):
            try:
                if proc.info['exe'] and os.path.normpath(proc.info['exe']) == os.path.normpath(exe_path):
                    print(f"🔪 Killing stale MT5 process: {proc.info['pid']} ({exe_path})")
                    proc.kill()
                    time.sleep(2) # Give it time to die
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except ImportError:
        print("⚠ psutil not installed. Skipping precise process kill. (Please run: pip install psutil)")
        # Fallback: We can't easily kill by path without psutil on Windows cleanly.
        # But since we use portable folders, maybe we don't need to kill GLOBAL mt5, just the one in this folder.
    except Exception as e:
        print(f"⚠ Failed to kill existing MT5: {e}")

def start_api():
    """Starts the API Server (Port 8000)"""
    global api_process
    print("🌐 Starting API Server...")
    cmd = [sys.executable, "main.py", "--api-only"]
    api_process = subprocess.Popen(cmd, cwd=BASE_DIR)

def generate_mt5_config(instance_dir, login, password, server):
    """
    Generates a startup.ini file for MT5 to force login and disable wizards.
    """
    config_path = os.path.join(instance_dir, "config", "startup.ini")
    
    # Ensure config directory exists
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
    except: pass
    
    # Standard INI content for MT5 startup
    content = f"""[Common]
Login={login}
Password={password}
Server={server}
CertPassword=
KeepPrivate=1
NewsEnable=0
CertInstall=0
[Charts]
MaxBars=5000
PrintColor=0
SaveDeleted=0
[Experts]
AllowDllImport=1
Enabled=1
Account=1
Trade=1
[StartUp]
Minimize=1

[Charts]
MaxBars=100000
PrintColor=1
SaveDeleted=0

[Experts]
AllowDllImport=1
Enabled=1
Account=1
Profile=1

[Objects]
ShowProperties=1
"""
    try:
        with open(config_path, 'w') as f:
            f.write(content)
        return config_path
    except Exception as e:
        print(f"❌ Failed to write config file: {e}")
        return None

def sync_srv_files(instance_dir, base_exe_path):
    """
    Copies .srv files (Server Definitions) from the Base MT5 Config to the Instance Config.
    This ensures that if the user adds a broker in the Base MT5, it becomes available to instances.
    """
    try:
        # Resolve Base Config Directory
        if os.path.basename(base_exe_path).lower() in ['terminal64.exe', 'terminal.exe']:
             base_dir_root = os.path.dirname(base_exe_path)
        else:
             base_dir_root = base_exe_path # Assume dir passed
             
        base_config_dir = os.path.join(base_dir_root, "Config")
        instance_config_dir = os.path.join(instance_dir, "Config")
        
        # print(f"   🔍 Syncing .srv files from {base_config_dir} -> {instance_config_dir}")
        
        if not os.path.exists(instance_config_dir):
            os.makedirs(instance_config_dir)

        # Copy all .srv files
        copied_count = 0
        
        # 1. SEARCH ADDITIONAL SOURCE DIRS (For "Upload" support)
        # Allows user to drop .srv files in project root or uploads folder
        
        # Define Public Uploads Path (Next.js)
        public_uploads = os.path.abspath(os.path.join(BASE_DIR, "..", "public", "uploads"))
        if not os.path.exists(public_uploads):
            try:
                os.makedirs(public_uploads, exist_ok=True)
                print(f"   ℹ Created missing public uploads directory: {public_uploads}")
            except: pass

        search_dirs = [
            base_config_dir, # Base MT5 Config
            BASE_DIR, # Current Script Directory
            public_uploads, # Next.js Uploads
            os.path.abspath(os.path.join(BASE_DIR, "uploads")), # Local Uploads
            r"C:\Program Files\MetaTrader 5\Config", # Fallback Standard Install
            r"D:\MetaTrader 5\Config", # Fallback Custom Install
        ]
        
        # Add any other potential Config folders (e.g. from other instances if base is empty?)
        
        for src_dir in search_dirs:
            if not os.path.exists(src_dir): 
                # print(f"      (Skipping missing source: {src_dir})")
                continue
            
            # print(f"      Checking {src_dir}...")
            
            for item in os.listdir(src_dir):
                if item.lower().endswith(".srv") or item.lower() == "servers.dat":
                    s = os.path.join(src_dir, item)
                    d = os.path.join(instance_config_dir, item)
                    
                    # Avoid re-copying if same size/time (Optimization)
                    # BUT force update if it's servers.dat to be safe, or if size differs
                    if os.path.exists(d):
                        try:
                            if os.path.getsize(s) == os.path.getsize(d):
                                continue
                        except: pass

                    try:
                        shutil.copy2(s, d)
                        copied_count += 1
                        print(f"   + Installed: {item} (from {src_dir})")
                    except Exception as copy_err:
                        print(f"   ⚠ Failed to copy {item}: {copy_err}")
        
        if copied_count > 0:
            print(f"🔄 Synced {copied_count} server definitions (.srv/dat) to Instance.")
        else:
            # Warn if no servers found at all
            if not os.path.exists(os.path.join(instance_config_dir, "servers.dat")):
                 print(f"⚠ WARNING: No server definitions synced! MT5 may fail to connect.")
            
    except Exception as e:
        print(f"⚠ Failed to sync .srv files: {e}")

def launch_terminal(exe_path, login, password, server):
    """
    Explicitly launches the MT5 terminal using a config file to force login.
    This is more robust than CLI arguments and handles special characters/popups better.
    """
    try:
        instance_dir = os.path.dirname(exe_path)
        
        # 0. Sync Server Definitions (Critical for "Unknown Server" errors)
        # We need to find the Base MT5 path. We can infer it or search again.
        # Since we don't store Base Path easily, let's try to find it.
        # But wait, exe_path IS the instance path.
        # We can re-use find_mt5_exe() logic or just look at common paths if not stored.
        # Better: Pass base_path to this function or finding it.
        # Let's just try standard paths.
        base_mt5 = find_mt5_exe() 
        if base_mt5:
            sync_srv_files(instance_dir, base_mt5)
            
            # FORCE RE-SCAN: Sometimes user adds .srv file to Base MT5 while Manager is running.
            # We should try to copy it again if the server is still missing in instance.
            srv_check = os.path.join(instance_dir, "Config", f"{server}.srv")
            if not os.path.exists(srv_check):
                print(f"   ℹ Server '{server}' still missing in Instance. Re-scanning Base MT5 Config...")
                sync_srv_files(instance_dir, base_mt5)

        # CHECK: Does the server definition exist?
        srv_name = f"{server}.srv"
        srv_path = os.path.join(instance_dir, "Config", srv_name)
        dat_path = os.path.join(instance_dir, "Config", "servers.dat")
        
        if not os.path.exists(srv_path) and not os.path.exists(dat_path):
            print(f"⚠ WARNING: Server definition '{srv_name}' AND 'servers.dat' NOT found in Instance Config!")
            print(f"   -> System attempts to auto-sync from Base MT5, but it seems missing there too.")
            print(f"   ⛔ CRITICAL: MT5 WILL FAIL TO CONNECT TO '{server}'.")
            print(f"   👉 ACTION REQUIRED: Open the BASE MT5 Terminal manually ({base_mt5}),")
            print(f"      Go to 'File > Open an Account', SEARCH for '{server}', and close it.")
            print(f"      Then restart this script.")
            # Optional: We could BLOCK launch here, but maybe user wants to try anyway?
            # User said "system is adding the account on the MT5 local server instead of broker's server".
            # This confirms that without .srv, it fails back to MetaQuotes-Demo.
            # So we should probably NOT launch it to avoid confusion, or at least warn loudly.
        else:
            if os.path.exists(srv_path):
                print(f"   ✔ Server definition '{srv_name}' found.")
            elif os.path.exists(dat_path):
                 print(f"   ✔ 'servers.dat' found (assuming '{server}' is inside).")

        # 1. Generate Config File
        config_path = generate_mt5_config(instance_dir, login, password, server)
        
        cmd = [
            exe_path,
            "/portable" # Critical: Use local instance data
        ]
        
        if config_path:
            # Path must be relative to the terminal executable or absolute?
            # MT5 documentation says /config:file_name.
            # If we are in the directory, relative path works.
            # "config\startup.ini"
            cmd.append(f"/config:config\\startup.ini")
        else:
            # Fallback to CLI args (less reliable)
            cmd.extend([
                f"/login:{login}",
                f"/password:{password}",
                f"/server:{server}"
            ])
        
        print(f"🖥 Launching Terminal for {login} using Config Injection...")
        
        # Use Popen to launch independent process
        # cwd must be the instance directory for /portable to work correctly relative to it?
        # Actually /portable makes it look in the dir where exe is located.
        subprocess.Popen(cmd, cwd=instance_dir)
        
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
    
    # CREATE_NEW_CONSOLE = 0x00000010 (Windows only)
    # This ensures each worker has its own window to display logs/trades
    creation_flags = 0x00000010 if os.name == 'nt' else 0
    
    p = subprocess.Popen(cmd, cwd=BASE_DIR, creationflags=creation_flags)
    processes[master_id] = p

def main():
    global APP_ENV
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
    
    # FORCE PRODUCTION MODE FOR RDP COMPATIBILITY
    # If we are running this script, we likely want it to work.
    if APP_ENV == 'local':
        print("⚠ [Manager] APP_ENV is 'local'. Defaulting to PRODUCTION behavior for RDP compatibility.")
        APP_ENV = 'production'

    while True:
        try:
            # Monitor API Server
            if api_process and api_process.poll() is not None:
                print("⚠ API Server died. Restarting...")
                start_api()

            # Sync from DB (Direct Read)
            current_subs = get_subscriptions_from_db()

            if current_subs:
                try:
                    # Extract Masters with Credentials
                    masters = {} # {id: {password, server}}
                    for sub in current_subs:
                        m = sub.get('master')
                        if m and m.get('id'):
                            masters[str(m['id'])] = {
                                'password': m.get('password'),
                                'server': m.get('server'),
                                'platform': m.get('platform', 'MT5')
                            }
                    
                    # Manage Processes
                    for mid, creds in masters.items():
                        # Environment Check: Block local launch if not production
                        if APP_ENV != 'production':
                            if mid not in printed_local_msg:
                                print(f"ℹ [Local Mode] Detected Master {mid}, but skipping MT5 Launch/Worker.")
                                print(f"   (To enable, set APP_ENV=production)")
                                printed_local_msg.add(mid)
                            continue

                        if mid not in processes or processes[mid].poll() is not None:
                            # 1. Setup Instance
                            exe_path = find_mt5_exe()
                            inst_exe = setup_instance(mid, exe_path)
                            
                            if not inst_exe:
                                print(f"❌ Failed to setup instance for {mid}")
                                continue
                                
                            # 2. Launch Terminal (with Config Injection)
                            # KILL STALE PROCESS
                            kill_existing_mt5(inst_exe)
                            
                            launch_terminal(inst_exe, mid, creds['password'], creds['server'])
                            
                            # Start Worker
                            print(f"👷 Debug: Spawning worker for {mid} with Filter ID: {mid}")
                            start_worker(mid, inst_exe)
                            
                except Exception as e:
                    print(f"⚠ Error processing subscriptions: {e}")
            else:
                print("⏳ Waiting for active subscriptions in DB...")
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
            if api_process: api_process.terminate()
            for p in processes.values():
                p.terminate()
            break

if __name__ == "__main__":
    main()
