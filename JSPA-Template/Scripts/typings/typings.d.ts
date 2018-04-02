// put custom ones here
declare var moment;
declare var hljs;

interface JSON {
    retrocycle(data: any): any;
    decycle(data: any): any;
    clone(object: any): any;
}
interface Console {
    freeze(message: string, object?: any): void;
}
