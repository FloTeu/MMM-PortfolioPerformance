

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
		csvArray = this.getArrayCSV(payload)
		csvArray.sort(function(a,b){
		  // Turn your strings into dates, and then subtract them
		  // to get a value that is either negative, positive, or zero.
		  return new Date(a.Date) - new Date(b.Date);
		});
		var stocks = getCol(csvArray, "Ticker Symbol");
		var stocks_unique = stocks.filter( onlyUnique );
		var stock_request = this.config.benchmark.concat(stocks_unique);
		this.sendSocketNotification("REQUEST_STOCK_DATA", stock_request)
		//this.plot(csvArray)
		break
	      case "NEW_STOCK_DATA":
		console.log("GOT STOCK DATA")
		this.stock_data.push(payload);
		var test = 0;
		this.updatePlot();
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
	  for (var i = 0; i < data_stock.length; i++)
	    {
		if(data_stock[i]["date"] == date)
		{
		  return parseFloat(data_stock[i]["close"]);
		}
	    }
		return 0;
	},
	
	get_plot_data: function(stock_data)
	{
	  var d = new Date();
	  d.setMonth(d.getMonth() - 2);
	  console.log(d.toISOString())
	  var date_threshold = d.toISOString().split("T");
	  date_threshold = date_threshold[0];
	  var data = [];
	  for (var j = 0; j < stock_data.length; j++)
	  {
	    performance_root = this.get_price_pastdate(stock_data[j], date_threshold)
	    var datapoints = [];
	    for (var i = 0; i < stock_data[j].length; i++)
	    {
	      var stock_line = stock_data[j][i];
	      if(stock_line["date"] > date_threshold)
	      {
		  var value_str = stock_line["close"].replace(",","");
		  var value = (parseFloat(value_str) / performance_root - 1)*100;
		  datapoints.push({x: new Date(stock_line["date"]), y: value});
	      }
	    }
	    
	    data.push({        
		type: "line",  
		name: stock_data[j][0]["symbol"],   
		showInLegend: true,
		xValueFormatString: "DD MMM, YYYY",
		dataPoints: datapoints
	    })
	  }
	  return data;
	  
	},
	
	updatePlot: function() {
	    console.log(this.stock_data);
	    var data = this.get_plot_data(this.stock_data)
	    console.log(data);
	    this.plot_stocks(data)
	
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
		  includeZero: false,
		  reversed: true,
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
