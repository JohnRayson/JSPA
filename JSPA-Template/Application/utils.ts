
class Utils {

    public createUUID(): string {
        var d = new Date().getTime();
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now(); //use high-precision timer if available
        }
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }

    // catch all case, checks if the input is a number, if its a string it will parse it, if its not a number it will return null
    // it also avoids non numbers() like NaN and Infinity / -Infinity as although they are technically numbers they cause maths issues
    public toNumber(value: any): number {
        
        // oddcases, '' == false == 0
        if (value === '')
            return null;
        // true == 1
        // false == 0
        if (typeof (value) === "boolean")
            return null;

        // parse it
        let num = Number(value);

        // check its not NaN
        if (isNaN(num))
            return null;

        // check its not Ininity || -Infinity
        if (!isFinite(num))
            return null;
        
        return num;
    }
    public round(num: number, places: number) {
        if (places == 0)
            return Math.round(num);

        // else we have decimal places
        let calc = Math.pow(10,places);
        return Math.round(num * calc) / calc;
    }


    //https://stackoverflow.com/a/1527820
    public randomNum(int?: boolean, min?: number, max?: number) {
        if ($.type(min) != "number")
            min = 0;
        if ($.type(max) != "number")
            max = 100;

        let multi = (max - min + 1);
        let num = (Math.random() * multi) + min;

        if(int)
            return Math.floor(num);

        // else anything
        return num;
    }


    // is it an object - apparenty this is what underscore.js does
    // https://stackoverflow.com/a/14706877
    public isObject(thing: any): boolean {
        return thing === Object(thing);
    }
    // the standard stuff - switch the button etc, and actually toggle the fullscreen-ines
    public fullScreenPanelToggle(src: JSPAEvent, url?: string, iconWhenMin?: string): string {
        src.evt.preventDefault();

        // defuelt the iconWhenMin to the maximized
        // this only works if the icons are "far", not "fas"
        if (!iconWhenMin)
            iconWhenMin = 'fa-window-maximize';

        if (src.$el.children('i').hasClass(iconWhenMin)) {
            src.$el.children('i').removeClass(iconWhenMin);
            src.$el.children('i').addClass('fa-window-minimize');
        }
        else if (src.$el.children('i').hasClass('fa-window-minimize')) {
            src.$el.children('i').removeClass('fa-window-minimize');
            src.$el.children('i').addClass(iconWhenMin);
        }
        src.$el.closest('.card').toggleClass('fullscreen-card');

        // what did we do?
        let did = (src.$el.closest('.card').hasClass("fullscreen-card") ? "max" : "min");
        // remove the scrollign from the underlying page
        if (did == "max") {
            let newURL = document.location.href + "^" + (url || "maximised");
            console.log(newURL);
            // add an entry to the histroy, so back does what we expect
            history.pushState({}, "maximised card", newURL);
            $("body").css({ overflowY: "hidden" });
            // change the title of of the button
            src.$el.data("old-title", src.$el.attr("title"));
            src.$el.attr("title", "Minimize");
        }
        else {
            app.routing.updateUrlWithoutNavigating(document.location.href.split("^")[0]);
            $("body").css({ overflowY: "auto" });
            // change the title of of the button
            src.$el.attr("title", src.$el.data("old-title"));
        }

        return did;
    }

    // scale the text to fit the container
    // add some details here - about what to pass in, and there are requirements to do with having a css text-size already specified
    public textFit($container: JQuery): void {
        let $parent = $container.parent();
        //console.log("Utils.textFit(): ", { $container: $container, $containerHeight: $container.height(), $parent: $parent, $parentHeight: $parent.height() });
        while ($container.height() > $parent.height()) {
            var fontsize = parseInt($parent.css('font-size')) - 1;
            $parent.css('font-size', fontsize);
            // some browsers(chrome) the min font return value is 12px
            if (fontsize <= 1 || parseInt($parent.css('font-size')) >= fontsize + 1)
                break;
        }
    }

    // take the data that matches the routing type "queryExp" and parse off an object
    // to parseNumbers / JSON supply a template detailing the parameters / type eg { lat: "number", zoom: "int", thing: "json" } - anything not in the template is a string
    // but what if its encoded? the template just gets more complicated... { thing: "base64-json", lat: "base64-number"}
    public fromQueryParams(input: string, template?: any): any {

        let reply: any = {};

        // parameters
        let params = input.replace("?", "").split("&");
        // to allow base64 encoding the actual values might contain =
        for (let p = 0; p < params.length; p++) {
            let d = params[p].split("=");
            let property = d[0];
            d.splice(0, 1)
            reply[property] = d.join("=");
        }
        // compare to tempate
        if (!this.isObject(template))
            template = {};

        for (let t in template) {
            if (reply[t]) {
                let type: string = template[t];
                if (type.indexOf("base64") == 0) {
                    type = type.split("-")[1]; // if theres no extra, then its "undefined" and thus default in switch
                    reply[t] = atob(reply[t]);
                }
                switch (type) {
                    default: break; // do nothing - string -> string
                    case "number": reply[t] = parseFloat(reply[t]); break;
                    case "int": reply[t] = parseInt(reply[t]); break;
                    case "json": reply[t] = JSON.parse(reply[t]); break;
                }
            }
        }
        
        return reply;
    }

    public randomColour(constraint?: string): JSPAColour {

        // constrian the min / max to avoid dark / light colours - default to full range
        let min = 0;
        let max = 255;
        switch (constraint) {
            default:
                break;
            case "dark":
                max = 200;
                break;
            case "light":
                min = 50;
                break;
        }

        // create 3 random number between min and max
        let str = "rgb(" + this.randomNum(true, min, max) + "," + this.randomNum(true, min, max) + "," + this.randomNum(true, min, max) + ")";
        return this.colourConvert(str);
    }

    public colourConvert(input: string): JSPAColour {
        function componentToHex(c): string {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }

        function rgbToHex(r, g, b): any {
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
        }

        function hexToRgb(hex): any {
            // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
            var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(shorthandRegex, function (m, r, g, b) {
                return r + r + g + g + b + b;
            });
            
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
                rgb: "rgb(" + parseInt(result[1], 16) + "," + parseInt(result[2], 16) + "," + parseInt(result[3], 16) + ")"
            } : null;
        }
        let reply = new JSPAColour();

        if (input.substring(0, 1) == "#") {
            reply.hex = input;
            let rgb = hexToRgb(input);
            for (let m in rgb) {
                reply[m] = rgb[m];
            }
        }
        if (input.substring(0, 3) == "rgb") {
            let data = input.split("(")[1].replace(")", "").split(",");
            reply.hex = rgbToHex(parseInt(data[0]), parseInt(data[1]), parseInt(data[2]));
            let rgb = hexToRgb(reply.hex);
            for (let m in rgb) {
                reply[m] = rgb[m];
            }
        }
        return reply;
    }
    // playing with numbers
    public ordinal(num: number): string {
        let numStr: string = num.toString();
        // whats the last number
        let lastNum = parseInt(numStr.slice(-1));
        switch (lastNum) {
            case 1: return numStr + "st";
            case 2: return numStr + "nd";
            case 3: return numStr + "rd";
            default: return numStr + "th";
        }
    }

    public minutesPastMidnight = {
        toTime: function (mins: number) {
            // modulus of 60
            let minutes = (mins % 60);
            let hours = ((mins - minutes) / 60);
            return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
        },
        toNumber: function (time: string) {
            // time must be HH:mm
            let parts = time.split(":");
            return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
        }
    }
}




// so we can easily clone objects without having to remember this whole line
if (typeof JSON.clone !== "function") {
    JSON.clone = function clone(object, decycle = true) {
        //console.info("JSON.clone(): ", object); // this gets called a lot... I mean a LOT!
        if (decycle)
            return JSON.retrocycle(JSON.parse(JSON.stringify(JSON.decycle(object))));

        return JSON.parse(JSON.stringify(object));
    }
}

if (typeof console.freeze !== "function") {
    console.freeze = function freeze(message: string, object?: any) {
        if (object) {
            console.info("FREEZE: " + message, JSON.clone(object));
        }
        else
            console.info("FREEZE: " + message);
    }
}


