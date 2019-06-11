import * as d3 from 'd3'
// import fs from 'fs'
// import {PI} from './constants'
import { colors } from './global'


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

    // var fileName=path.join('/Users/chand/workbench/work/keynotes/photovoltaics/viz/band.csv')
    var dataFile = blueprint.data.file.split('[')[0]
    d3.csv(dataFile).then(function(data) {
        trace(blueprint, data, svg)
    })

    return svg
}


function trace(blueprint, data, svg) {

    // domain sould be set here
    var x, y, xy, xselect, yselect, xcol, ycol
    var xDom, yDom

    // style variables
    var opacity, strokeWidth

    xselect = 0
    yselect = 1

    var columnRegex = /\[(.*?)\]|\[(.*?)\]/g;
    var cols = blueprint.data.file.match(columnRegex); // TODO-file not provided
    var scatterColors = colors(blueprint.data.color)

    if (cols != null) {
        xselect = Number(cols[0].slice(1, 2)) - 1
        yselect = Number(cols[0].slice(3, 4)) - 1
    }
    xcol = `${data.columns[xselect]}`
    ycol = `${data.columns[yselect]}`

    // TODO - domain defaults based on data multiple files
    // 
    xDom = [d3.min(data, d => +d[xcol]), d3.max(data, d => +d[xcol])]
    yDom = [d3.min(data, d => +d[ycol]), d3.max(data, d => +d[ycol])]
    if (blueprint.data.domain) {
        blueprint.data.domain.x? xDom = blueprint.data.domain.x:xDom
        blueprint.data.domain.y? yDom = blueprint.data.domain.y:yDom
    }

    xy = setAxis(blueprint, xDom, yDom, svg)
    x = xy.x
    y = xy.y

    // TODO - scatterColors length != cols.length ??
    for (let i = 0; i < cols.length; i++) {
        if (cols != null) {
            xselect = Number(cols[i].slice(1, 2)) - 1
            yselect = Number(cols[i].slice(3, 4)) - 1
        }
        xcol = `${data.columns[xselect]}`
        ycol = `${data.columns[yselect]}`

        var groupBy = `${data.columns[blueprint.data.groupBy[0] -1]}` //TODO -groupBy[i]

        var band = d3.nest() // nest based on bandindex
            .key(function(d) { return d[groupBy] })
            .entries(data)

        var line = d3.line()
            .defined((d) => +d[ycol] >= y.domain()[0] && +d[ycol] <= y.domain()[1])
            .x(d => x(+d[xcol])).y(d => y(+d[ycol]))

        if (blueprint.data.smooth) {
            if (blueprint.data.smooth == 'spline-cat') {
                line.curve(d3.curveCatmullRom)
            }
        }

        svg.selectAll('band')
            .data(band).enter().append("path")
            .attr('class', 'someclass')
            .attr('stroke', scatterColors[i])
            .attr("stroke-width", 2.5)
            .attr("opacity", 1)
            .attr("fill", 'none')
            .attr("d", (d) => line(d.values));
    }
}


function setAxis(blueprint, xDom, yDom, svg) {

    var width = blueprint.canvas.width - blueprint.canvas.margin.left - blueprint.canvas.margin.right
    var height = blueprint.canvas.height - blueprint.canvas.margin.top - blueprint.canvas.margin.bottom

    var x = d3.scaleLinear().range([0, width]).domain(xDom)
    var y = d3.scaleLinear().range([height, 0]).domain(yDom)

    var tickLabel = blueprint.data.tick.label //TODO-default

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