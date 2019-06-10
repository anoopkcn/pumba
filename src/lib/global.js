import katex from '../../resources/katex/katex.mjs'

String.prototype.tex = function() {
    var laTexRegex = /\$\$(.*?)\$\$|\$(.*?)\$/g;
    var laTex = this.match(laTexRegex);
    if (laTex) {
        var tex = this;
        for (let i = 0; i < laTex.length; i++) {
            var laTexHtml = katex.renderToString(
                String.raw `${laTex[i].replace(/\$/g, "")}`, {
                    throwOnError: false
                }
            );
            tex = tex.replace(laTex[i], laTexHtml);
        }
        return tex;
    } else {
        return this;
    }
}

/**
 * build a color list
 * @param  {strin} specifier sring with hex colors without the # and space between them
 * @return {array}           an array of all the colors
 */
export function colors(specifier) {
    var n = specifier.length / 6 | 0,
        colors = new Array(n),
        i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
}