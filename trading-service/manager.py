import subprocess
import sys
import time
import os
import shutil
import json
import glob
import urllib.request
import ssl

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
                key = f"{uid}_{sid}"
                if key in processed_keys: continue
                processed_keys.add(key)
                
                strat = strategies.get(sid)
                if not strat: continue
                
                master_id = strat.get('masterAccountId')
                master_pass = strat.get('masterAccountPassword')
                master_server = strat.get('masterAccountServer')
                
                if not master_id or not master_pass or not master_server: continue

                slave_id = tx.get('mt_account_id')
                slave_pass = tx.get('mt_account_password')
                slave_server = tx.get('mt_account_server', 'MetaQuotes-Demo')
                
                if not slave_id or not slave_pass: continue

                sub = {
                    "id": f"sub_{uid}_{sid}",
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
"""
    try:
        with open(config_path, 'w') as f:
            f.write(content)
        return config_path
    except Exception as e:
        print(f"❌ Failed to write config file: {e}")
        return None

def launch_terminal(exe_path, login, password, server):
    """
    Explicitly launches the MT5 terminal using a config file to force login.
    This is more robust than CLI arguments and handles special characters/popups better.
    """
    try:
        instance_dir = os.path.dirname(exe_path)
        
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
