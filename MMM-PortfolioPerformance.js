

function onlyUnique(value, index, self) { 
    return self.indexOf(value) === index;
}

function getCol(matrix, col){
       var column = [];
       for(var i=0; i<matrix.length; i++){
          column.push(matrix[i][col]);
       }
       return column;
    }

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function monthDiff(d1, d2) {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth() + 1;
    months += d2.getMonth();
    return months <= 0 ? 0 : months + 1;
}


function transformCsvData(csv_data, stock_names){
  var new_csv = []
  for (var i = 0;i < stock_names.length; i++)
  {
    var stock = stock_names[i];
    new_csv[stock] = [];
    for(var j = 0; j < csv_data.length; j++)
    {
      if(csv_data[j]["Ticker Symbol"] == stock)
      {
	var date = formatDate(new Date(csv_data[j]["Date"]));
	var dates = Object.keys(new_csv[stock]);
	if (!(dates.includes(date)))
	{
	  new_csv[stock][date] = [];
	}
	new_csv[stock][date].push(csv_data[j]["Type"]);
	new_csv[stock][date].push(csv_data[j]["Shares"].replace(",",""));
	new_csv[stock][date].push(csv_data[j]["Value"].replace(",",""));	
	new_csv[stock][date].push(csv_data[j]["Fees"].replace(",",""));	
      }
    }
  }
  return new_csv;
}

function create_portfolio_performance(past_month)
{
  var portfolio_performance = [];
  var now = new Date();
  var date_past = new Date();
  date_past.setMonth(date_past.getMonth() - past_month);
  for (var d = date_past; d <= now; d.setDate(d.getDate() + 1))
       {
	 var date_dayformat = formatDate(d);
	 portfolio_performance[date_dayformat] = 0;
       }
  return portfolio_performance;
}

Module.register("MMM-PortfolioPerformance",{
	// Default module config.
	defaults: {
	  path: "/home/pi/MagicMirror/modules/MMM-PortfolioPerformance/example.csv",
	  apiKey : "",
	  benchmark: ["X010.DE", "^GSPC", "^GDAXI"],
	  symbols : ["aapl", "GOOGL", "005930.KS"],
	  benchmark_label: ["MSCI World", "S&P 500", "DAX"],
	  timeframes: [1,2,12],
	  changetime: 1000 * 60,
	  },
	
	start: function (){
	  this.stock_data = [];
	  this.stocks_portfolio = [];
	  this.plotdata_total = [];
	  this.count_plots_total = 0;
	  this.sendSocketNotification("INIT", this.config);
	  
	},

	getStyles: function() {
	  return ["MMM-PortfolioPerformance.css"]
	},
	
	getDom: function() {
	  
	  var chart_div = document.createElement("div")
	  chart_div.setAttribute("id", "chartContainer")
	  
	  var element = document.createElement("div")
	  element.className = "myContent"
	  //element.innerHTML = "Hello, World! " + this.config.path
	  var subElement = document.createElement("p")
	  subElement.id = "COUNT"
	  element.appendChild(subElement)
	  element.appendChild(chart_div)

	  return element

	},
	
	notificationReceived: function(notification, payload, sender) {
	    switch(notification) {
	      case "DOM_OBJECTS_CREATED":
		this.sendSocketNotification("REQUEST_CSV_DATA", 0)
		break
	    }
	  },

	
	  socketNotificationReceived: function(notification, payload) {
	    console.log("JOB ANSWER")
	    //console.log(payload)
	    switch(notification) {
	      case "I_DID":
		console.log("NEW COUNTER")
		var elem = document.getElementById("COUNT")
		elem.innerHTML = "Count:" + payload.toString()
		break
	      case "CSV_DATA":
		console.log("GOT CSV DATA")
		// create portfolio performance
		var highest_month = Math.max.apply(Math, this.config.timeframes);
		this.portfolio_performance = create_portfolio_performance(highest_month);
		
		// request stock data
		var csvArray = this.getArrayCSV(payload)
		csvArray.sort(function(a,b){
		  return new Date(a.Date) - new Date(b.Date);
		});
		var minDate = new Date(csvArray[0]["Date"]);
		console.log(minDate);
		var first_transaction = monthDiff(minDate, new Date());
		console.log(first_transaction);
		this.config.timeframes.push(first_transaction + 1);
		var stocks = getCol(csvArray, "Ticker Symbol");
		var stocks_unique = stocks.filter( onlyUnique );
		// save all unique portfolio stocks in global variable
		this.stocks_portfolio = stocks_unique
		var stock_request = this.config.benchmark.concat(stocks);
		var stocks_unique_all = stock_request.filter( onlyUnique );
		this.sendSocketNotification("REQUEST_STOCK_DATA", stocks_unique_all)
		
		this.csv_data = transformCsvData(csvArray, this.stocks_portfolio);
		console.log(this.csv_data);
		break
	      case "NEW_STOCK_DATA":
		console.log("GOT STOCK DATA")
		this.stock_data.push(payload);
		this.updatePlot(0, false);
		break
	      case "FINISHED_REQUEST_STOCK_DATA":
		console.log("FINISHED_REQUEST_STOCK_DATA")
		var t0 = performance.now();
		this.fill_portfolio_performance();
		var t1 = performance.now();
		console.log("Filling portfolio data toke: " + String((t1-t0)/1000/60) + " min.");
		console.log(this.portfolio_performance);
		this.plotTimeframes(0);
		break
	    }
	  },
	
	getArrayCSV: function(csv_txt) {
	    console.log("START transform csv text to Array")
	    var allTextLines = csv_txt.split(/\r\n|\n/);
	    var headers = allTextLines[0].split(';');
	    var lines = [];
	    
	    for (var i=1; i<allTextLines.length; i++) {
		var data = allTextLines[i].split(';');
		if (data.length == headers.length) {
		    var tarr = [];
		    for (var j=0; j<headers.length; j++) {
			tarr[headers[j]] =  data[j];
		    }
		    lines.push(tarr);
		}
	    }
	    console.log('Transforming complete!');
	    return lines;
	
	},
	
	get_price_pastdate: function(data_stock_index, date)
	{
	  // get nearest datapoint to given date

	  var beforedate = this.stock_data[data_stock_index].filter(function(d) {
	      return new Date(d.date) - new Date(date) < 0;
	  });
	  var i = 0;
	  while (parseFloat(beforedate[i]["close"]) == 0.0)
	  {
	    i++;
	  }
	  var close = beforedate[i]["close"];
	  
	  // free up memory
	  beforedate = null;
	  return parseFloat(close);
	},
	
	get_shares_pastdate: function(date, stock_name)
	{
	  var stock_transactions = this.csv_data[stock_name];
	  var transactions = Object.keys(stock_transactions).length;
	  var shares = 0.0;
	  for (var i = 0; i < transactions; i++)
	    {
		if(Object.keys(stock_transactions)[i] <= date)
		{
		  for (var j = 0; j < stock_transactions[Object.keys(stock_transactions)[i]].length; j++)
		  {
		    if(stock_transactions[Object.keys(stock_transactions)[i]][j] == "Buy")
		    {
			shares = shares + parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+1])
		    }
		    if(stock_transactions[Object.keys(stock_transactions)[i]][j] == "Sell")
		    {
			shares = shares - parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+1])
		    }
		    j++;
		    j++;
		    j++;
		  }
		}
	    }
	    // free up memory
	    stock_transactions = null;
	    transactions = null;
	    return shares;
	},

	
	get_transaction_value_pastdate: function(date, stock_name)
	{
	  var stock_transactions = this.csv_data[stock_name];
	  var transactions = Object.keys(stock_transactions).length;
	  var trans_value = 0.0;
	  for (var i = 0; i < transactions; i++)
	    {
		if(Object.keys(stock_transactions)[i] == date)
		{
		  for (var j = 0; j < stock_transactions[Object.keys(stock_transactions)[i]].length; j++)
		  {
		    if (stock_transactions[Object.keys(stock_transactions)[i]][j] == "Buy")
		    {
		      var transactionCosts = parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+2]) - parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+3])
		    }
		    else
		    {
		      var transactionCosts = parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+2]) - parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+3])
		    }
		    trans_value = trans_value + transactionCosts
		    //var stock_data_index = this.get_index_stock_in_data(stock_name);
		    //var price_stock = this.get_price_pastdate(stock_data_index, date);
		    //var transactionCosts_2 = parseFloat(stock_transactions[Object.keys(stock_transactions)[i]][j+1]) * parseFloat(price_stock)
		    //console.log("Stock transaction costs of: " + String(stock_name))
		    //console.log(transactionCosts)
		    //console.log(transactionCosts_2)
		    //console.log(parseFloat(transactionCosts-transactionCosts_2))
		    j++;
		    j++;
		    j++;
		  }
		}
	    }
	    // free up memory
	    stock_transactions = null;
	    transactions = null;
	    return trans_value;
	},
	
	get_plot_data_benchmark: function(timeframe)
	{
	  var d = new Date();
	  d.setMonth(d.getMonth() - timeframe);
	  var date_threshold = formatDate(d);
	  var data = [];
	  // iterate over all stock data from alphavantage (benchmarks and portfolio stocks)
	  for (var j = 0; j < this.stock_data.length; j++)
	  {
	    var stock_name = this.stock_data[j][0]["symbol"];
	    // case benchmark stock
	    if (this.config.benchmark.includes(stock_name))
	    {
	      var performance_root = this.get_price_pastdate(j, date_threshold);
	      var last_coorect_value = performance_root;
	      var datapoints = [];
	      for (var i = 0; i < this.stock_data[j].length; i++)
	      {
		var stock_line = this.stock_data[j][i];
		if(stock_line["date"] > date_threshold)
		{
		    var value_str = stock_line["close"].replace(",","");
		    if (parseInt(value_str) == 0)
		    {
		      var value = last_coorect_value;
		    }
		    else
		    {
			var value = (parseFloat(value_str) / performance_root - 1)*100;
			last_coorect_value = value;
		    }
		    datapoints.push({x: new Date(stock_line["date"]), y: value});
		}
		stock_line = null;
	      }
	    
	    data.push({        
		type: "line",  
		axisYType: "secondary",
		name: this.config.benchmark_label[this.config.benchmark.indexOf(this.stock_data[j][0]["symbol"])],   
		showInLegend: true,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	    })
	    }
	  }
	  
	    
	  return data;
	  
	},
	
	/**
	 *  This method returns change of the portfolio regarding the provided timeframe 
	 */
	get_plot_data_portfolio: function(timeframe)
	{
	  var base_date = new Date();
	  base_date.setMonth(base_date.getMonth() - timeframe);
	  var value_portfolio_day_base = this.portfolio_performance[formatDate(base_date)];
	  var data = [];
	  
	  // create datapoints for the portfolio stocks
	  var datapoints = [];
	  var transaction_value_since_base_date = 0.0;
	  var now = new Date()
	  // set performance for the first date
	  datapoints.push({x: new Date(base_date), y: 0.0});
	  base_date.setDate(base_date.getDate() + 1);
	  for (var d = base_date; d <= now; d.setDate(d.getDate() + 1))
	       {
		  var date_dayformat = formatDate(d);
		  var date_before_dayformat = new Date(d.getTime());
		  date_before_dayformat.setDate(date_before_dayformat.getDate() - 1);
		  date_before_dayformat = formatDate(date_before_dayformat);
		  var value_portfolio = this.portfolio_performance[date_dayformat];
		  var transaction_value_at_date = 0.0;
		  // iterate over all stocks and check if transaction happened
		  for(var i = 0; i < this.stocks_portfolio.length; i++)
		    {
			var stock_name = this.stocks_portfolio[i];
			var key_list = Object.keys(this.csv_data[stock_name])
			// Check if transaction happend
			 if(key_list.includes(date_dayformat))
			  {
			    value_portfolio_day_base = value_portfolio_day_base + this.get_transaction_value_pastdate(date_dayformat, stock_name);
			   }
		    }
		    //transaction_value_since_base_date = transaction_value_since_base_date + transaction_value_at_date
		    //value_portfolio = value_portfolio - transaction_value_since_base_date;
		    var performance_change = (parseFloat(value_portfolio) / parseFloat(value_portfolio_day_base) - 1)*100;
		    datapoints.push({x: new Date(d), y: performance_change});
	      }
	      // include portfolio performance
	    data.push({        
		type: "line",  
		axisYType: "secondary",
		name: "Portfolio",   
		showInLegend: true,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	    })
	    return data;
	},
	
	/**
	 * This method returns the portfolio value for the whole investing time.
	 *  
	 */
	get_plot_data_portfoliovalue: function(timeframe)
	{
	  var data = [];
	  var datapoints = [];
	  var dates = Object.keys(this.portfolio_performance).sort(function(a,b){
				  return new Date(a) - new Date(b);
				});
	  for (var d = 0; d <= dates.length; d++)
	       {
		  datapoints.push({x: new Date(dates[d]), y: this.portfolio_performance[dates[d]]});
	      }
	      // include portfolio performance
	    data.push({        
		type: "line",  
		axisYType: "secondary",
		name: "Portfolio total asset",   
		showInLegend: false,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	    })
	    return data;
	},
	
	
      interval_function_a: function()
	{
	    console.log(this.timeframe_count)
	    var new_index = this.timeframe_count%(this.config.timeframes.length+1);
	    this.updatePlot(new_index, true)
	    new_index = null
	    this.timeframe_count = this.timeframe_count + 1
	    //setTimeout(this.interval_function_b, this.config.changetime)
	},
	
	interval_function_b: function()
	{
	    console.log(this.timeframe_count)
	    var new_index = this.timeframe_count%(this.config.timeframes.length+1);
	    this.updatePlot(new_index, true)
	    new_index = null
	    this.timeframe_count = this.timeframe_count + 1
	    setTimeout(this.interval_function_a, this.config.changetime)	
	},

	
	plotTimeframes: function(timeframe_index){
	  /*var base_date = new Date()
	  var current_date = new Date()
	  var time_passed_seconds = parseInt((current_date.getTime() - base_date.getTime())/1000);
	  var time_passed_seconds_before = time_passed_seconds
	  while(true)
	  {
	      current_date = new Date()
	      time_passed_seconds_before = time_passed_seconds
	      time_passed_seconds = parseInt((current_date.getTime() - base_date.getTime())/1000);
	      // if certain defined seconds have passed we plot a new timeframe
	      if((time_passed_seconds%(this.config.changetime*1000)) == 0 && time_passed_seconds_before != time_passed_seconds)
	      {
		  var new_index = timeframe_index%(this.config.timeframes.length+1);
		  this.updatePlot(new_index, true)
		  timeframe_index ++;
	      }
	  }*/
	  //let timeframe_obj = {frame:timeframe_index};
	  this.timeframe_count = timeframe_index;
	  this.timeframes_length = this.config.timeframes.length
	  setInterval(() => {this.interval_function_a()}, this.config.changetime)
	},
	
	updatePlot: function(timeframe_index, show_portfolio) {
	  if(this.count_plots_total < this.config.timeframes.length)
	    {
	      if(timeframe_index == this.config.timeframes.length)
	      {
		  var data = this.get_plot_data_portfoliovalue();
		  this.plotdata_total.push(data);
		  this.count_plots_total = this.count_plots_total + 1
		  this.plot_stocks(data, timeframe_index);
		  data = null;
	      }
	      else
	      {

		var data = this.get_plot_data_benchmark(this.config.timeframes[timeframe_index]);
		 if(show_portfolio)
		    {
		      var data_porfolio = this.get_plot_data_portfolio(this.config.timeframes[timeframe_index]);
		      data.push.apply(data, data_porfolio);
		      data_porfolio = null;
		      this.plotdata_total.push(data);
		      this.count_plots_total = this.count_plots_total + 1
		    }
		this.plot_stocks(data, timeframe_index);
		data = null;
		}
	    }
	  else
	    {
	      this.plot_stocks(this.plotdata_total[timeframe_index], timeframe_index);
	    }
	},
	
	plot_stocks: function(data_stocks, timeframe_index){
	  var valueFormatString = "##.#";
	  var suffix = "%";
	  var months = "Months";
	  if(this.config.timeframes[timeframe_index] == 1)
	  {
	    months = "Month"
	  }
	  var title = "Portfolio Performance - " + String(this.config.timeframes[timeframe_index]) + " " + months;
	  if (timeframe_index == this.config.timeframes.length)
	  {
	    valueFormatString = "#";
	    suffix = "";
	    title = "Portfolio Performance - Total Asset"
	  }
	  var chart = new CanvasJS.Chart("chartContainer", {
	  animationEnabled: true,
	  theme: "dark1",
	  backgroundColor: "transparent",
	  title:{
		  text: title
	  },
	  axisY2:{
		  valueFormatString:  valueFormatString,
		  includeZero: false,
		  suffix: suffix,
		  labels: {
		      align: 'right',
		  },
		  includeZero: false,
	  },
	  data: data_stocks
	  });
	
	chart.render();
	data_stocks = null;
	delete(chart);
	},
	
	get_index_stock_in_data: function(stock_name)
	{
	  for(var i = 0; i < this.stock_data.length; i++)
	  {
	    var stock_data_name = this.stock_data[i][0]["symbol"];
	    if(stock_data_name == stock_name)
	    {
	      return i;
	    }
	  }
	  return -1;
	},
	
	get_value_at_date: function(date_base)
	{
	  var portfolio_value = 0.0;
	  for (var i = 0; i < this.stocks_portfolio.length; i++)
	  {
	      var stock_name = this.stocks_portfolio[i];
	      var shares_base = this.get_shares_pastdate(date_base,stock_name);
	      var stock_data_index = this.get_index_stock_in_data(stock_name);
	      if(stock_data_index == -1)
	      {
		console.log("ERROR: stock (" + stock_name + ") could not be found in stock data")
		stock_data_index = 0;
	      }
	      if(shares_base == 0.0)
		{
		  var value_base = 0.0;
		}
	      else
		{
		  var value_base = this.get_price_pastdate(stock_data_index, date_base);
		}
	      portfolio_value = portfolio_value + (shares_base * value_base);
	  }
	  return portfolio_value;
	},
	
	fill_portfolio_performance: function()
	{
	    var first_month = Math.max.apply(Math, this.config.timeframes);
	    var now = new Date();
	    var date_past = new Date();
	    date_past.setMonth(date_past.getMonth() - first_month);
	    var count = 0;
	    for (var d = date_past; d <= now; d.setDate(d.getDate() + 1))
		 {
		   var date_dayformat = formatDate(d);
		   var value = this.get_value_at_date(date_dayformat);
		   this.portfolio_performance[date_dayformat] = value;
		   count ++;
		 }
	},

})
