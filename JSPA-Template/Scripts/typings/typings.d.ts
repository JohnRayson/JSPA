// put custom ones here
declare var moment;
declare var hljs;
declare var QUnit

interface JSON {
    retrocycle(data: any): any;
    decycle(data: any): any;
    clone(object: any): any;
}
interface Console {
    freeze(message: string, object?: any): void;
}

declare var toastr: {
    error(msg: string, title?: string, optionsOverride?: any): void;
    info(msg: string, title?: string, optionsOverride?: any): void;
    success(msg: string, title?: string, optionsOverride?: any): void;
    warning(msg: string, title?: string, optionsOverride?: any): void;
}


