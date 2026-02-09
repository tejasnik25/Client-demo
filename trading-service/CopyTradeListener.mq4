//+------------------------------------------------------------------+
//|                                          CopyTradeListener.mq4 |
//|                                     Copyright 2024, MT5 Bridge |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, MT5 Bridge"
#property link      "https://www.mql5.com"
#property version   "1.00"
#property strict

// --- INPUTS ---
input string ApiUrl = "http://localhost:8000"; // Python Service URL
input string AccountID_Override = ""; // Leave empty to use AccountNumber

// --- GLOBALS ---
int MagicNumber = 123456;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   EventSetTimer(1); // Run every 1 second
   Print("🚀 CopyTradeListener Started. URL: ", ApiUrl);
   
   // Check WebRequest permission
   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED)) {
      Print("⚠ Warning: DLLs must be allowed (though we use WebRequest, some envs need it).");
   }
   if(!IsDllsAllowed()) Print("⚠ Ensure 'Allow WebRequest' is enabled for: ", ApiUrl);
   
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| Timer function (Main Loop)                                       |
//+------------------------------------------------------------------+
void OnTimer()
  {
   string accId = AccountID_Override == "" ? IntegerToString(AccountNumber()) : AccountID_Override;
   
   // 1. PUSH POSITIONS
   PushPositions(accId);
   
   // 2. POLL COMMANDS
   PollCommands(accId);
  }

//+------------------------------------------------------------------+
//| Push current positions to Python                                 |
//+------------------------------------------------------------------+
void PushPositions(string accId) {
   string json = "{";
   json += "\"account_id\": \"" + accId + "\",";
   json += "\"password\": \"dummy\","; // Not needed for status push
   
   // Account Info
   json += "\"account_info\": {";
   json += "\"balance\": " + DoubleToString(AccountBalance(), 2) + ",";
   json += "\"equity\": " + DoubleToString(AccountEquity(), 2);
   json += "},";
   
   // Positions
   json += "\"positions\": [";
   int total = OrdersTotal();
   int count = 0;
   for(int i=0; i<total; i++) {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) {
         if(count > 0) json += ",";
         
         json += "{";
         json += "\"ticket\": " + IntegerToString(OrderTicket()) + ",";
         json += "\"symbol\": \"" + OrderSymbol() + "\",";
         json += "\"type\": " + IntegerToString(OrderType()) + ","; // 0=Buy, 1=Sell
         json += "\"volume\": " + DoubleToString(OrderLots(), 2) + ",";
         json += "\"magic\": " + IntegerToString(OrderMagicNumber()) + ",";
         json += "\"comment\": \"" + OrderComment() + "\"";
         json += "}";
         count++;
      }
   }
   json += "]";
   json += "}";
   
   // Send Request
   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));
   char resultData[];
   string resultHeaders;
   
   int res = WebRequest("POST", ApiUrl + "/mt4/push", "Content-Type: application/json\r\n", 500, postData, resultData, resultHeaders);
   if(res != 200) {
      // Print("Error pushing data: ", res);
   }
}

//+------------------------------------------------------------------+
//| Poll for new commands                                            |
//+------------------------------------------------------------------+
void PollCommands(string accId) {
   char postData[]; // Empty for GET
   char resultData[];
   string resultHeaders;
   
   int res = WebRequest("GET", ApiUrl + "/mt4/poll/" + accId, NULL, 500, postData, resultData, resultHeaders);
   
   if(res == 200) {
      string jsonResponse = CharArrayToString(resultData);
      // Simple parsing (MQL4 has no native JSON parser, doing crude string search)
      // Expecting: {"commands": [...]}
      
      if(StringFind(jsonResponse, "\"commands\": []") > 0) return; // Empty
      
      // If we have commands, ideally we use a JSON library. 
      // For this demo, we assume the Python format is simple enough or we parse manually.
      // Since MQL4 JSON parsing is hard without a lib, we will assume Python sends ONE command at a time or we just process the raw string logic.
      
      // CRITICAL: MQL4 JSON Parsing is complex. 
      // Simplified: We search for action types
      
      // --- ACTION: OPEN ---
      if(StringFind(jsonResponse, "OPEN") > 0) {
         // Extract details (Crude parsing)
         string symbol = ExtractJsonValue(jsonResponse, "symbol");
         string s_vol = ExtractJsonValue(jsonResponse, "volume");
         string s_type = ExtractJsonValue(jsonResponse, "type");
         
         double vol = StringToDouble(s_vol);
         int type = (int)StringToInteger(s_type);
         
         if(symbol != "") {
             Print("Executing OPEN Command: ", symbol, " ", vol);
             int cmd = (type == 0) ? OP_BUY : OP_SELL;
             double price = (cmd == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
             
             int ticket = OrderSend(symbol, cmd, vol, price, 10, 0, 0, "CopyTrade", MagicNumber, 0, CLR_NONE);
             if(ticket < 0) Print("OrderSend Failed: ", GetLastError());
             else Print("Order Opened: ", ticket);
         }
      }
      
      // --- ACTION: CLOSE ---
      if(StringFind(jsonResponse, "CLOSE") > 0) {
         string s_ticket = ExtractJsonValue(jsonResponse, "ticket");
         int ticket = (int)StringToInteger(s_ticket);
         
         if(OrderSelect(ticket, SELECT_BY_TICKET)) {
             Print("Executing CLOSE Command for Ticket: ", ticket);
             int cmd = OrderType();
             double price = (cmd == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
             
             if(!OrderClose(ticket, OrderLots(), price, 10, CLR_NONE)) {
                 Print("OrderClose Failed: ", GetLastError());
             } else {
                 Print("Order Closed: ", ticket);
             }
         } else {
             Print("OrderClose Failed: Ticket not found or invalid: ", ticket);
         }
      }
   }
}

// Helper to extract value from JSON string (Very basic, assumes simple format)
string ExtractJsonValue(string json, string key) {
   string pattern = "\"" + key + "\":";
   int start = StringFind(json, pattern);
   if(start < 0) return "";
   
   start += StringLen(pattern);
   
   // Skip spaces/quotes
   while(StringSubstr(json, start, 1) == " " || StringSubstr(json, start, 1) == "\"") start++;
   
   int end = start;
   while(StringSubstr(json, end, 1) != "\"" && StringSubstr(json, end, 1) != "," && StringSubstr(json, end, 1) != "}") end++;
   
   return StringSubstr(json, start, end-start);
}
