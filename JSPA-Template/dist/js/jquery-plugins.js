// https://stackoverflow.com/a/12187548 - adapted to also be capabale of returning the array of text nodes
// Extract the text from a jquery element - but not the text from its children
(function ($) {
    function elementText(el, vals) {
        var textContents = [];
        for (var chld = el.firstChild; chld; chld = chld.nextSibling) {
            if (chld.nodeType == 3) {
                if (vals)
                    textContents.push(chld.nodeValue);
                else
                    textContents.push(chld);
            }
        }
        return textContents;
    }
    $.fn.textOnly = function (elementSeparator, nodeSeparator) {
        if (arguments.length < 2) { nodeSeparator = ""; }
        if (arguments.length < 1) { elementSeparator = ""; }
        return $.map(this, function (el) {
            return elementText(el,true).join(nodeSeparator);
        }).join(elementSeparator);
    }
    $.fn.textNodes = function () {
        if (arguments.length < 2) { nodeSeparator = ""; }
        if (arguments.length < 1) { elementSeparator = ""; }
        return $.map(this, function (el) {
            return elementText(el,false);
        });
    }

}(jQuery));