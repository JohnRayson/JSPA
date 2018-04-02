
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
    // the standard stuff - switch the button etc, and actually toggle the fullscreen-ines
    public fullScreenPanelToggle(src: JSPAEvent): void {
        src.evt.preventDefault();

        if (src.$el.children('i').hasClass('fa-window-maximize')) {
            src.$el.children('i').removeClass('fa-window-maximize');
            src.$el.children('i').addClass('fa-window-minimize');
        }
        else if (src.$el.children('i').hasClass('fa-window-minimize')) {
            src.$el.children('i').removeClass('fa-window-minimize');
            src.$el.children('i').addClass('fa-window-maximize');
        }
        src.$el.closest('.card').toggleClass('fullscreen-card');
    }

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
}

// so we can easily clone objects without having to remember this whole line
if (typeof JSON.clone !== "function") {
    JSON.clone = function clone(object) {
        return JSON.retrocycle(JSON.parse(JSON.stringify(JSON.decycle(object))));
    }
}

if (typeof console.freeze !== "function") {
    console.freeze = function freeze(message: string, object?: any) {
        if (object)
            console.info(message, JSON.clone(object));
        else
            console.info(message);
    }
}


