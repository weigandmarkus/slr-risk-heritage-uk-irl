var width = 1600;
var height = 900;

var svg = d3.select("#mapContainer") 
    .append("svg") 
    .attr("preserveAspectRatio", "xMidYMid slice") 
    .attr("viewBox", [0, 0, width, height]) 
    .attr("title", "Vienna's Oldest Trees"); 

var g = svg.append("g"); 
var l = svg.append("g"); 

var projection = d3.geoTransverseMercator();

var path = d3.geoPath()
.projection(projection);


d3.json("https://raw.githubusercontent.com/AndreasDiv/D3js-Files/main/streets-oldtown.geojson")
    .then(function(streets) {
        projection.fitSize([width, height], streets);
        
        g.selectAll("path")
         .data(streets.features)
         .enter()
         .append("path")
         .attr("d", path)
         .attr("fill", "none")
         .attr("stroke", "#3d4144ff")
         .attr("stroke-width", 0.5)
         .attr("stroke-opacity", 0.3);
    })
    .catch(function(error) {
        alert("There are some problems with the street dataset");
    });



d3.json("https://raw.githubusercontent.com/AndreasDiv/D3js-Files/main/trees-oldtown.geojson")
  .then(function(trees) {
    
    //Filter for trees older than 1950 and exclude no data values (0) (TASK 2)

    var filteredTrees = trees.features.filter(function(d) {
        return d.properties.PlantingYear < 1950 && d.properties.PlantingYear > 0;
    });

    //Scales (3)
    
    // 1. Color (Planting Year) - linear
    var colorScale = d3.scaleLinear()
        .domain([1800, 1850, 1900, 1950])
        .range(["#67000d", "#a50f15", "#ef3b2c", "#fcbba1"]); 
    
    // 2. Radius (Tree Height) - linear
    var minHeight = d3.min(filteredTrees, function(d) {
        return d.properties.TreeHeight;
        });
    
    var maxHeight = d3.max(filteredTrees, function(d) {
        return d.properties.TreeHeight;
        });

    var radiusScale = d3.scaleLinear()
        .domain([minHeight, maxHeight])
        .range([3, 10]);
        
    // 3. Stroke Width (Trunk Size) - linear
    var strokeScale = d3.scaleLinear()
        .domain([6, 600]) 
        .range([0.5, 4.5]);

    // Visualization visual variables (TASK 1)
    l.selectAll("circle")
     .data(filteredTrees)
     .enter()
     .append("circle")
     .attr('cx', function(d) { return projection(d.geometry.coordinates)[0] })
     .attr('cy', function(d) { return projection(d.geometry.coordinates)[1] })
     
     .attr("r", function(d) { 
         return radiusScale(d.properties.TreeHeight); 
     })
     .attr("fill", function(d){ 
         return colorScale(d.properties.PlantingYear); 
     })
     .attr("fill-opacity", 0.8)
     .attr("stroke", "#1d1c1cff") 
     .attr("stroke-width", function(d) {
         return strokeScale(d.properties.TrunkSize);
     })

     // Tooltips & Buttons (TASK 4)
     .on("mouseover", function(event, d) {
        d3.select(this)
          .raise()
          .transition().duration(200)
          .attr("fill", "yellow") 
          .attr("stroke-width", 4)
          .attr("cursor", "pointer");
        
        div.transition()
           .duration(200)
           .style("opacity", .9);

        div.html(
            "<table>" +
            "<tr><th colspan='2'>Tree ID: " + d.properties.TreeID + "</th></tr>" +
            "<tr><td>Species:</td><td>" + d.properties.TreeType + "</td></tr>" +
            "<tr><td>Planting Year:</td><td>" + d.properties.PlantingYear + "</td></tr>" +
            "<tr><td>Tree Height:</td><td>" + d.properties.TreeHeight + " m</td></tr>" +
            "<tr><td>Trunk Size:</td><td>" + d.properties.TrunkSize + " cm</td></tr>" +
            "</table>"
        )
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
     })
     
     .on("mouseout", function(event, d) {
        d3.select(this)
          .lower() 
          .transition()
          .duration(500)
          .attr("fill", function(d){ return colorScale(d.properties.PlantingYear); }) 
          .attr("stroke-width", function(d) { return strokeScale(d.properties.TrunkSize); });

        div.transition()
           .duration(500)
           .style("opacity", 0);
     });

     createLegend(colorScale);
})
.catch(function(error) {
    console.log(error);
    alert("There are some problems with the trees dataset");
});

  // Zoom
  var zoom = d3.zoom()
  .scaleExtent([1, 7])
  .on('zoom', function(event) {
    l.attr('transform', event.transform);
    g.attr('transform', event.transform);
  });

  svg.call(zoom);

  function zoomIn() {
  d3.select('svg')
    .transition()
    .duration(750)
    .call(zoom.scaleBy, 2, [width / 2, height / 2]);
  }

  function zoomOut() {
    d3.select('svg')
    .transition()
    .duration(750)
    .call(zoom.scaleBy, 0.5, [width / 2, height / 2]);
    }

    function resetZoom() {
    d3.select('svg')
    .call(zoom.transform, d3.zoomIdentity);
    }

    // Tooltip
    var div = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
    

// Legend (TASK 3)
function createLegend(colorScale) {
    
    var legendContainer = d3.select("#legend-svg-container");
    
    var legendSvg = legendContainer.append("svg")
        .attr("width", 250)
        .attr("height", 265);

    // Planting Year (Color)
    
    legendSvg.append("text")
             .attr("x", 0)
             .attr("y", 15)
             .text("Planting Year")
             .style("font-weight", "bold")
             .style("font-size", "14px")
             .style("fill", "#3d4144");

    var legendData = [1800, 1850, 1900, 1950]; 
    var legendLabels = ["< 1800", "< 1850", "< 1900", "< 1950"];
    var rectWidth = 20;
    var rectHeight = 12;
    var startY = 30;

    legendSvg.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", function(d, i){ return startY + (i * (rectHeight + 5)) })
      .attr("width", rectWidth)
      .attr("height", rectHeight)
      .style("fill", function(d){ return colorScale(d) })
      .style("stroke", "black");

    legendSvg.selectAll("text.labels")
      .data(legendLabels)
      .enter()
      .append("text")
      .attr("x", rectWidth + 10)
      .attr("y", function(d, i){ return startY + (i * (rectHeight + 5)) + (rectHeight / 2) })
      .style("fill", "#333")
      .text(function(d){ return d })
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")
      .style("font-size", "12px");

    // Tree Height (Size)
    
    var part2Y = startY + (legendData.length * (rectHeight + 5)) + 25;

    legendSvg.append("text")
             .attr("x", 0)
             .attr("y", part2Y)
             .text("Tree Height (Size)")
             .style("font-weight", "bold")
             .style("font-size", "14px")
             .style("fill", "#3d4144");
    
    var heightCircles = [3, 5, 8, 10]; 
    var heightLabels = ["0-5 m", "", "", ">35m"];

    legendSvg.selectAll("circle.heights")
      .data(heightCircles)
      .enter()
      .append("circle")
      .attr("cx", function(d, i) {
          return 20 + (i * 40); 
      })
      .attr("cy", part2Y + 30) 
      .attr("r", function(d){ return d })
      .style("fill", "none")
      .style("stroke", "black");

    legendSvg.selectAll("text.heightLabels")
      .data(heightLabels)
      .enter()
      .append("text")
      .attr("x", function(d, i) {
          return 20 + (i * 40); 
      })
      .attr("y", part2Y + 55) 
      .text(function(d){ return d })
      .style("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#333");

    // Trunk Size (Stroke Width)
    
    var part3Y = part2Y + 85;


    legendSvg.append("text")
             .attr("x", 0)
             .attr("y", part3Y)
             .text("Trunk Size (Stroke Width)")
             .style("font-weight", "bold")
             .style("font-size", "14px")
             .style("fill", "#3d4144");

    var trunkStrokes = [0.5, 1.8, 3.2, 4.5];
    var trunkLabels = ["6 cm", "", "", "600 cm"];

    legendSvg.selectAll("circle.trunks")
      .data(trunkStrokes)
      .enter()
      .append("circle")
      .attr("cx", function(d, i) {
          return 20 + (i * 40); 
      })
      .attr("cy", part3Y + 30)
      .attr("r", 10) 
      .style("fill", "none")
      .style("stroke", "black")
      .style("stroke-width", function(d){ return d }); 

    legendSvg.selectAll("text.trunkLabels")
      .data(trunkLabels)
      .enter()
      .append("text")
      .attr("x", function(d, i) {
          return 20 + (i * 40);
      })
      .attr("y", part3Y + 55)
      .text(function(d){ return d })
      .style("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#333");
}         
    