const request = require('request')

var NodeHelper = require("node_helper");
var fs = require("fs");

String.prototype.hashCode = function() {
  var hash = 0
  if (this.length == 0) {
    return hash
  }
  for (var i = 0; i < this.length; i++) {
    var char = this.charCodeAt(i)
    hash = ((hash<<5)-hash)+char
    hash = hash & hash
  }
  return hash
}

module.exports = NodeHelper.create({
  start: function() {
	console.log("NODE STARTED")
    this.countDown = 10000000
  },
  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
        case "INIT":
            this.config = payload
            console.log("[PortfolioPerformance] Initialized.")
            break
        case "REQUEST_STOCK_DATA":
            console.log("[PortfolioPerformance] Start scraping stock data.")
            console.log(payload)
            this.stocks = payload;
            this.startPooling();
            break
        case "REQUEST_CSV_DATA":
            var csv_txt = this.getCSV(this.config.path);
            this.sendSocketNotification("CSV_DATA", csv_txt);
            break
    }
  },
  
  getCSV: function(file_path){
    var contents = fs.readFileSync(file_path, 'utf8');
    return contents;
    },

  startPooling: function() {
    // Since December 2018, Alphavantage changed API quota limit.(5 per minute)
    if(this.stocks.length > 0)
    {
    stock = this.stocks[0]
    console.log("[PortfolioPerformance] Start scraping stock: " + stock)
    this.stocks.shift();
    this.callAPI(this.config, stock);
    
    var timer = setTimeout(()=>{
      this.startPooling()
    }, 20000) // Every 30 seconds a stock is requested
    }
    else
    {
          console.log("All stocks scraped")
          this.sendSocketNotification("FINISHED_REQUEST_STOCK_DATA", 0);       
    }
  },
  
  callAPI: function(cfg, symbol) {
    var url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=full&symbol="
    
    url += symbol + "&apikey=" + cfg.apiKey
    
    
    
    request(url, (error, response, body)=>{
      console.log("[PortfolioPerformance] API is called - ", symbol)
      var data = null
      if (error) {
        console.log("[PortfolioPerformance] API Error: ", error)
        return
      }
      data = JSON.parse(body)
      if (data.hasOwnProperty("Note")) {
        console.log("[PortfolioPerformance] Error: API Call limit exceeded.")
        return 0;
      }
      if (data.hasOwnProperty("Error Message")) {
        console.log("[PortfolioPerformance] Error:", data["Error Message"])
        return 0;
      }
      if (data["Time Series (Daily)"]) {
        console.log("[PortfolioPerformance] Response is parsed - ", symbol)
        var series = data["Time Series (Daily)"]
        var keys = Object.keys(series)
        //var dayLimit = (cfg.chartDays > 90) ? 90 : cfg.chartDays
        //var keys = keys.sort().reverse().slice(0, dayLimit)
        var ts = []
        for (k in keys) {
          var index = keys[k]
          var item = {
            "symbol": symbol,
            "date": index,
            "close": series[index]["4. close"],
            "volume": series[index]["5. volume"],
            "hash" : symbol.hashCode(),
          }
          ts.push(item)
        }
        //return ts;
        this.sendSocketNotification("NEW_STOCK_DATA", ts);       
      }
    })
  },
    
  
});
