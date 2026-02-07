import MetaTrader5 as mt5
import os

if not mt5.initialize():
    print(f"MT5 Init Failed: {mt5.last_error()}")
else:
    info = mt5.terminal_info()
    print(f"MT5 Path: {info.path}")
    print(f"MT5 Data Path: {info.data_path}")
    print(f"Connected: {info.connected}")
    
    config_path = os.path.join(info.data_path, "Config")
    if os.path.exists(config_path):
        srv_files = [f for f in os.listdir(config_path) if f.endswith('.srv')]
        print(f"Found {len(srv_files)} .srv files in Data Path:")
        for s in srv_files[:5]:
            print(f" - {s}")
        if len(srv_files) > 5: print("...")
    else:
        print(f"Config path not found: {config_path}")

    mt5.shutdown()
