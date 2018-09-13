class JSPAEvent {
    public $el: JQuery = null;
    public component: Component = null;
    public data: any = null;
    public value: any = null;
    public evt: any = null;

    constructor(obj: { $el: JQuery, component: Component, data: any, value: any, evt: any }) {
        //can't use keyof this to index type JSPAEvent... for some reason...
        let _internal: any = obj;
        for (let m in this) {
            this[m] = _internal[m];
        }
    }
};


class JSPAColour {
    public hex: string = null;
    public rgb: string = null;
    public r: number = null;
    public g: number = null;
    public b: number = null;
}

class JSPAEmit {
    src: string;
    data: any;
    $parent: JQuery;
    error: any;

    constructor(src?: string, data?: any, $parent?: JQuery, error?: any) {
        this.src = src || null;
        this.data = data || null;
        this.$parent = $parent || null;
        this.error = error || null;
    }
}