import * as d3 from 'd3'
// import {PI} from './constants'
// import {colors} from './global'
export function scatter(blueprint) {
    var width = blueprint.canvas.width
    var height = blueprint.canvas.height
    var svg = d3.select(`#${blueprint.canvas.name}`).append("svg")
        .attr('id', 'svg-canvas')
        .attr("preserveAspectRatio", "xMinYMin")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + blueprint.canvas.margin.left + "," + blueprint.canvas.margin.top + ")")

    // kmin = Math.min(d3.min(MAPI, d => d.k), d3.min(PI, d => d.k))
    // kmax = Math.max(d3.max(MAPI, d => d.k), d3.max(PI, d => d.k))
    // emax = 5
    // emin = -9
    // var fileName=path.join('/Users/chand/workbench/work/keynotes/photovoltaics/viz/band.csv')
    d3.csv(blueprint.data.file).then(function(data) {
        trace(blueprint, data, svg)
    })

    return svg
}

function trace(blueprint, data, svg) {
    // domain sould be set here
    var x, y, xy
    xy = setAxis(blueprint, [0, 1.72], [-5, 5], svg)
    x = xy.x; y = xy.y
    var line = d3.line().defined(function(d, i) {
        var next = 0
        var dataSize = data.length
        if (i < dataSize - 1) {
            next = data[i + 1].k
            return d.k <= next && d.e >= y.domain()[0] && d.e <= y.domain()[1];
        }
    }).x(d => x(d.k)).y(d => y(d.e))

    svg.selectAll('band')
        .data([data]).enter().append("path")
        .attr('class', 'someclass')
        .attr('stroke', 'red') //d => bandColor(style.name)
        .attr("stroke-width", 2)
        .attr("opacity", 1)
        .attr("fill", 'none')
        .attr("d", line);
}

function setAxis(blueprint, xDom, yDom, svg) {

    var width = blueprint.canvas.width - blueprint.canvas.margin.left - blueprint.canvas.margin.right
    var height = blueprint.canvas.height - blueprint.canvas.margin.top - blueprint.canvas.margin.bottom

    var x = d3.scaleLinear().range([0, width]).domain(xDom)
    var y = d3.scaleLinear().range([height, 0]).domain(yDom)

    var tickLabel = blueprint.data.tick.label

    // Add the x-axis at bottom of the page
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + (height) + ")")
        .call(d3.axisBottom(x).tickValues(tickLabel.slice(0, tickLabel.length - 1).map((d) => d.x)).tickFormat(() => '').tickSize(-height))

    // Add the y-axis.
    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(" + 0 + ",0)")
        .call(d3.axisLeft(y).ticks(7).tickSize(-10));

    var tx = -5;
    var ty = 10;
    var tw = 40;
    var th = 50;

    svg.append("g")
        .call(x)
        .selectAll("g").data(tickLabel).enter().append("foreignObject")
        .attr('class', 'xTicks')
        .attr("transform", "translate(0," + (height) + ")")
        .attr("width", tw)
        .attr("height", th)
        .attr("x", (d) => x(d.x) + tx)
        .attr("y", ty)
        .html(function(d) { return d.label })

    // add the x-axis at top of the page
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0,-1)")
        .call(d3.axisTop(x).tickValues(tickLabel.map((d) => d.x)).tickFormat(() => '').tickSize(-5))

    // add the y-axis at right of the page
    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", "translate(" + (width) + ",0)")
        .call(d3.axisRight(y).ticks(7).tickSize(-5).tickFormat(() => ''))

    return { x: x, y: y }
}