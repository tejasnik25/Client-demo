import MetaTrader5 as mt5
import os

if not mt5.initialize():
    print(f"MT5 Init Failed: {mt5.last_error()}")
else:
    info = mt5.terminal_info()
    print(f"MT5 Path: {info.path}")
    print(f"Connected: {info.connected}")
    print(f"Current Login: {mt5.account_info().login}")
    
    config_path = os.path.join(info.path, "Config")
    if os.path.exists(config_path):
        srv_files = [f for f in os.listdir(config_path) if f.endswith('.srv')]
        print(f"Found {len(srv_files)} .srv files:")
        for s in srv_files:
            print(f" - {s}")
    else:
        print(f"Config path not found: {config_path}")

    mt5.shutdown()
