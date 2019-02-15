

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
Module.register("MMM-PortfolioPerformance",{
	// Default module config.
	defaults: {
		text: "Hello World!"
	},
	
	start: function (){
	  this.stock_data = [];
	  this.stocks_portfolio = [];
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
	  console.log("THIS IS DOM FUNCTION");

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
		var csvArray = this.getArrayCSV(payload)
		csvArray.sort(function(a,b){
		  return new Date(a.Date) - new Date(b.Date);
		});
		var stocks = getCol(csvArray, "Ticker Symbol");
		var stocks_unique = stocks.filter( onlyUnique );
		// save all unique portfolio stocks in global variable
		this.stocks_portfolio = stocks_unique
		var stock_request = this.config.benchmark.concat(stocks);
		var stocks_unique_all = stock_request.filter( onlyUnique );
		this.sendSocketNotification("REQUEST_STOCK_DATA", stocks_unique_all)
		
		// prepare portfolio performance array for each stock
		for (var i = 0; i < stocks_unique.length; i++)
		{
		  this.stock_basic_value = [];
		  this.stock_basic_value[stocks_unique[i]] = [];
		  for (var j = 0; j < this.config.timeframes.length; j++)
		  {
		     this.stock_basic_value[stocks_unique[i]].push(0);
		  }
		}
		console.log(this.stock_basic_value)
		this.csvArray = csvArray
		break
	      case "NEW_STOCK_DATA":
		console.log("GOT STOCK DATA")
		this.stock_data.push(payload);
		var test = 0;
		this.updatePlot(this.config.timeframes[0]);
		break
	      case "FINISHED_REQUEST_STOCK_DATA":
		console.log("FINISHED_REQUEST_STOCK_DATA")
		this.plotTimeframes(1);
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
	    console.log(lines.length);
	    return lines;
	
	},
	
	get_price_pastdate: function(data_stock, date)
	{
	  data_stock.sort(function(a, b) {
	      var distancea = Math.abs(new Date(date) - new Date(a.date));
	      var distanceb = Math.abs(new Date(date) - new Date(b.date));
	      return distancea - distanceb; // sort a before b when the distance is smaller
	  });
	  var close = data_stock[0]["close"];
	  return parseFloat(close);

	  for (var i = 0; i < data_stock.length; i++)
	    {
		if(data_stock[i]["date"] == date)
		{
		  return parseFloat(data_stock[i]["close"]);
		}
	    }
		return 0;
	},
	
	get_plot_data: function(data_stocks, timeframe)
	{
	  var d = new Date();
	  d.setMonth(d.getMonth() - timeframe);
	  console.log(d.toISOString())
	  var date_threshold = d.toISOString().split("T");
	  date_threshold = date_threshold[0];
	  var data = [];
	  for (var j = 0; j < data_stocks.length; j++)
	  {
	    if (this.config.benchmark.includes(data_stocks[j][0]["symbol"]))
	    {
	      var performance_root = this.get_price_pastdate(data_stocks[j], date_threshold)
	      var datapoints = [];
	      for (var i = 0; i < data_stocks[j].length; i++)
	      {
		var stock_line = data_stocks[j][i];
		if(stock_line["date"] > date_threshold)
		{
		    var value_str = stock_line["close"].replace(",","");
		    var value = (parseFloat(value_str) / performance_root - 1)*100;
		    datapoints.push({x: new Date(stock_line["date"]), y: value});
		}
	      }
	    
	    data.push({        
		type: "line",  
		name: this.config.benchmark_label[this.config.benchmark.indexOf(data_stocks[j][0]["symbol"])],   
		showInLegend: true,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	    })
	    }
	  }
	  return data;
	  
	},
	
	plotTimeframes: function(timeframe_index){
	  this.updatePlot(this.config.timeframes[timeframe_index])
	  
	  var timer = setTimeout(()=>{
	    timeframe_index ++;
	    var new_index = timeframe_index%this.config.timeframes.length;
	    this.plotTimeframes(new_index)
	  }, 10000)
	},
	
	updatePlot: function(timeframe) {
	    console.log(this.stock_data);
	    var data = this.get_plot_data(this.stock_data, timeframe)
	    console.log(data);
	    this.plot_stocks(data);
	},
	
	plot_stocks: function(data_stocks){
	  var chart = new CanvasJS.Chart("chartContainer", {
	  animationEnabled: true,
	  theme: "dark1",
	  backgroundColor: "transparent",
	  title:{
		  text: "Portfolio Performance"
	  },
	  axisY:{
		  valueFormatString:  "##.#",
		  suffix: "%",
		  labels: {
		      align: 'right',
		  },
		  includeZero: false,
	  },
	  data: data_stocks
	  });
	
	chart.render();
	},
	
	plot: function(csvArray) {
	  var datapoints = [];
	  var value_sum = 0;
	  for (var i = 0; i < csvArray.length; i++){
	       var date = csvArray[i]["Date"].split('T');
		var date = date[0].split("-");
		var value_str = csvArray[i]["Value"].replace(",","");
		var value = parseInt(value_str);
		value_sum = value_sum + value
		datapoints.push({x: new Date(date[0],date[1],date[2]), y: value_sum});
	   }
	  var chart = new CanvasJS.Chart("chartContainer", {
	animationEnabled: true,
	theme: "dark1",
	backgroundColor: "transparent",
	title:{
		text: "Portfolio Performance"
	},
	axisY:{
		includeZero: false
	},
	data: [{        
		type: "line",  
		name: "S&P 500",   
		showInLegend: true,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	},
	     /*{   
		type: "line",  
		name: "My Portfolio",   
		showInLegend: true,  
		dataPoints: [
			{ y: 350 },
			{ y: 314},
			{ y: 420, indexLabel: "highest",markerColor: "red", markerType: "triangle" },
			{ y: 360 },
			{ y: 350 },
			{ y: 400 },
			{ y: 380 },
			{ y: 380 },
			{ y: 410 , indexLabel: "lowest",markerColor: "DarkSlateGrey", markerType: "cross" },
			{ y: 500 },
			{ y: 480 },
			{ y: 510 }
		]
	}*/
	]
	});
	
	chart.render();
	
	var timer = setTimeout(()=>{
      this.plot(csvArray)
    }, 60000)
     
	},

})
