import os
import glob
import difflib

def find_mt5_paths():
    paths = [
        r"C:\Program Files\MetaTrader 5",
        r"C:\Program Files (x86)\MetaTrader 5",
        # Add common broker paths if known, e.g.
        r"C:\Program Files\Exness MetaTrader 5",
        r"C:\Program Files\RoboForex - MetaTrader 5",
    ]
    found = []
    for p in paths:
        if os.path.exists(p):
            found.append(p)
    return found

def list_servers():
    print("🔍 Scanning system for MT5 Server Definitions (.srv files)...")
    
    base_dirs = find_mt5_paths()
    if not base_dirs:
        print("❌ No MT5 installations found in standard paths.")
        print("   Please ensure MetaTrader 5 is installed.")
        return

    all_servers = set()
    
    for base_dir in base_dirs:
        config_dir = os.path.join(base_dir, "Config")
        if os.path.exists(config_dir):
            print(f"\n📂 Checking: {config_dir}")
            srv_files = glob.glob(os.path.join(config_dir, "*.srv"))
            if not srv_files:
                print("   (No .srv files found)")
                continue
                
            for f in srv_files:
                srv_name = os.path.basename(f)[:-4] # Remove .srv
                all_servers.add(srv_name)
                print(f"   - {srv_name}")
        else:
            print(f"   (Config folder missing in {base_dir})")

    print("\n" + "="*50)
    print(f"✅ Total Unique Servers Found: {len(all_servers)}")
    print("="*50)
    
    if len(all_servers) == 0:
        print("⚠ CRITICAL: No server definitions found!")
        print("   You MUST open your MT5 Terminal manually, go to 'File > Open an Account',")
        print("   and SEARCH for your broker (e.g., 'Exness', 'ICMarkets').")
        print("   This will download the required .srv files.")

if __name__ == "__main__":
    list_servers()
