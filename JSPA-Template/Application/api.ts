//var Promise: any;
class Api {
    private localDb: LocalDB = new LocalDB();
    // path to the API
    private baseHref: string = "";
    // replace this with what ever aut token you are expecting
    private token: string = null;
    // do you need to call a specific version
    private apiVersion: number = 0;
    // set your headers, by default it uses a home grown auth token on the X-Authentication header
    private headers: any = {
        "Content-Type": "application/json",
        "X-Authentication": "",
        "Accept": "application/json, text/plain, */*;" + (this.apiVersion > 0 ? "version=" + this.apiVersion + ";" : "")
    }

    constructor(baseHref?: string) {
        
        // store the baseHref - if there is one
        if (baseHref)
            this.baseHref = baseHref;
        
        // see if we have a token already,
        this.isAuthenticated();
    }

    public auth(model: AuthModel): Promise<any> {
        
        return new Promise((resolve, reject) => {
            // change this to the endpoint in your API that responds with the token
            resolve(this.post("auth/authenticate", model))
        }).then((reply: any) => {
            this.storeSessionData(reply.token);
            return reply.user;
        });
    }
    public storeSessionData(token: string): boolean {
        console.log("API.storeSessionData(): ", token);
        this.token = token;
        window.sessionStorage.setItem("token", token);
        this.headers["X-Authentication"] = token;

        return true;
    }

    // test to see if the current user is authenticated
    public isAuthenticated(): boolean {
        if (window.sessionStorage.getItem("token")) {
            this.token = window.sessionStorage.getItem("token");
            this.headers["X-Authentication"] = this.token;

            return true;
        }
        return false;
    }

    public logout() {
        let api = this;
        return new Promise((resolve) => {
            resolve(this.get("auth/logout"))
        }).then((reply: any) => {
            api.token = null;
            window.sessionStorage.removeItem("token");
            api.headers["X-Authentication"] = "";
        });
    }

    private send(request: ApiRequest): Promise<any> {
        return new Promise((resolve, reject) => {
            $.ajax(request).always((data, textStatus, jqXHR) => {
                //console.log(request.method + " " + request.url + " -> " + textStatus);
                // failed responses have the 1st and last variables reversed... for some reason https://api.jquery.com/jQuery.ajax/
                if (!jqXHR.status) {
                    let tmp = data;
                    data = jqXHR;
                    jqXHR = tmp;
                }

                // success
                if (jqXHR.status == 200) {
                    return resolve(data);
                }
                // I'm a little teapot - we are saying that this means use the Nonce supplied and resubmit
                if (jqXHR.status == 418) {
                    // pull off the Nonce from the reply
                    let nonce = JSON.parse(jqXHR.responseText).nonce;
                    // only try twice.
                    if (nonce && request.nonceRetryAttempts < 2) {
                        console.log("Heres my nonce: ", nonce);
                        // shove it into the headers of the original request
                        request.headers["X-Nonce"] = nonce;
                        // update the re-try count
                        request.nonceRetryAttempts++;
                        // resubmit
                        return resolve(this.send(request));
                    }
                }
                
                // no response
                if (jqXHR.status == 0) {
                    // we are offline - so just let the app handle it.
                    app.online = false;
                }
                
                // unautherized == 401
                if (jqXHR.status == 401) {
                    config.routes[0].component.draw({ code: jqXHR.status, text: textStatus }).then(($content) => {
                        $("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
                    });
                }

                // bad request  == 400
                // forbidden    == 403, “I’m sorry. I know who you are–I believe who you say you are–but you just don’t have permission to access this resource. Maybe if you ask the system administrator nicely, you’ll get permission. But please don’t bother me again until your predicament changes.”
                if (jqXHR.status == 400 || jqXHR.status == 403) {
                    console.log("Api.send(): ", jqXHR.status);
                }

                // if we havn't already returned return a reject()
                return reject(jqXHR);
            });
        });
    }

    public createRequest(url: string, method: string = null, data: any = null): ApiRequest {
        let request = new ApiRequest();

        request.method = method || "GET";
        request.url = url;
        request.headers = $.extend({}, {},this.headers); // clone them so we can change them for a specific request
        request.data = (data != null ? JSON.stringify(data) : null);

        return request;
    }

    private subsriptions: Subscription[] = []
    public subscribe(path: string, options: ApiRequestOptions, success: any, fail: any): string {
        let sub: Subscription = null;
        // find it
        for (let i = 0; i < this.subsriptions.length; i++) {
            if (path === this.subsriptions[i].url){
                sub = this.subsriptions[i];
                break;
            }
        }
        if (!sub) {
            sub = new Subscription(path, this, options);
            this.subsriptions.push(sub);
        }
        // add this listener
        let ref = new Utils().createUUID();
        sub.callbacks.push({ id: ref, func: success });

        // first anything from the local store?
        this.localDb.retrieve(options.datastore, function (item) {
            let matched = true;
            for (let member in options.retrieve) {
                if (item.value[member] !== options.retrieve[member])
                    matched = false;
            }
            if (matched) {
                //console.log("API.subscribe() from localDB: ", item.value);
                success(item.value);
            }
        });

        // then over the wire for an update
        // call get - this gets all the data regardless of changes
        sub.api.get(sub.url, sub.options)
            .then((reply: any) => {
                success(reply);
            })
            .catch((rej: any) => {
                fail(rej);
            });

        // if its not already running - start it
        if (sub.state() == "stopped") {
            sub.start();
        }

        return ref;
    }
    public unsubscribe(id: string): void
    {
        if (config.verboseMessages)
            console.log("VERBOSE:: API.unsubscribe(): ", { lookingfor: id, in: this.subsriptions });

        // for each subscription
        for (let i = 0; i < this.subsriptions.length; i++) {
            // for each callback
            for (let j = 0; j < this.subsriptions[i].callbacks.length; j++)
            {
                // does this specific callback, match the one we want to remove
                if (id === this.subsriptions[i].callbacks[j].id)
                {
                    // remove it from the array
                    let removed = this.subsriptions[i].callbacks.splice(j, 1);
                    // if there are none left, stop the subscription
                    if (this.subsriptions[i].callbacks.length == 0) {
                        this.subsriptions[i].stop();
                        // remove the reference
                        this.subsriptions.splice(i, 1);
                    }
                    // end
                    break;
                }
            }
        }
    }
    public pauseSubscriptions(): void {
        // stops all the setIntervals, and sets the state to "paused"
        for (let i = 0; i < this.subsriptions.length; i++) {
            if (this.subsriptions[i].state() == "running")
                this.subsriptions[i].pause();
        }
    }
    public resumeSubscriptions(): void {
        // restarts all subscriptions where the state is "paused"
        for (let i = 0; i < this.subsriptions.length; i++) {
            if (this.subsriptions[i].state() == "paused")
                this.subsriptions[i].start();
        }
    }


    public get(path: string, options?: ApiRequestOptions): Promise<any> {
        return new Promise((resolve, reject) => {

            let request = this.createRequest(this.baseHref + path);
            let getReply = null;

            // get back any stored data
            if (options && options.datastore) {
                this.localDb.retrieve(options.datastore, function (item) {
                    let matched = true;
                    for (let member in options.retrieve) {
                        if (item.value[member] !== options.retrieve[member])
                            matched = false;
                    }
                    if (matched)
                        return item.value;
                }).then((reply) => {
                    getReply = reply;
                    this.send(request)
                        .then((reply) => {
                            // check the Options, do we want to store this data
                            if (options && options.datastore) {
                                this.localDb.store(options.datastore, reply).then((changes) => {
                                    if (!options.onlyChanges)
                                        resolve(reply); // return the raw data
                                    else if (changes.changed)
                                        resolve(changes.data);
                                    else
                                        resolve(null);
                                });
                            }
                            else
                                resolve(reply);
                        }).catch((ex) => {
                            if (!options.onlyChanges) // return the local Version
                                resolve(getReply)
                            else
                                reject(ex); // there can be no chnages as we got no new data
                        });
                });
            }
            else {
                this.send(request)
                    .then(reply => {
                        return resolve(reply);
                    })
                    .catch((ex) => { return reject(ex); });
            }
        });
    }
    
    public post(path: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            let request = this.createRequest(this.baseHref + path, "POST", data);
            this.send(request)
                .then(reply => {
                    return resolve(reply);
                })
                .catch((ex) => {
                    return reject(ex)
                });
        });
    }

    public delete(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let request = this.createRequest(this.baseHref + path, "DELETE");
            this.send(request)
                .then(reply => {
                    return resolve(reply);
                })
                .catch((ex) => {
                    return reject(ex)
                });
        });
    }

    public form(path: string, $form: JQuery): Promise<any> {
        // https://abandon.ie/notebook/simple-file-uploads-using-jquery-ajax
        // https://stackoverflow.com/questions/11442367/how-to-set-boundary-while-using-xmlhttprequest-and-formdata
        return new Promise((resolve, reject) => { 

            let data = new FormData(<HTMLFormElement>$form[0]);
            
            let request = this.createRequest(this.baseHref + path, "POST");
            request.data = data;
            request["cache"] = false;
            request["dataType"] = "json";
            request["processData"] = false; // Don't process the files
            request["contentType"] = false; // Set content type to false as jQuery will tell the server its a query string request

            // switch out the headers, the browser auto calculates this and set the form boundary parameter
            delete request.headers["Content-Type"];

            this.send(request)
                .then(reply => {
                    console.log("Api.form(): REPLY: ", reply);
                    return resolve(reply);
                })
                .catch(ex => {
                    reject(ex);
                });
        });
    }
}
// this is the authentication data, make this match what you need to send through to your auth endpoint
class AuthModel {
    EmailAddress: string;
    PhoneNumber: number;
    Password: string;
}
// names match the required names used by $.ajax()
class ApiRequest {
    method: string;
    url: string;
    headers: any;
    data: any;
    nonceRetryAttempts: number = 0;
}

class ApiRequestOptions {
    datastore: string;
    retrieve: any; // key fields
    onlyChanges?: boolean = false; // true = only return if differnt from localDB, false = all regardless of changes
}

class Subscription {
    private status: string = "stopped";
    private interval: number;
    private frequency = 5; // seconds
    // anything other than 200 is bad?
    private statusNot200: boolean = false;

    public callbacks: any[] = [];
    public url: string;
    public api: Api;
    public options: ApiRequestOptions;

    constructor(path: string, api: Api, options: ApiRequestOptions) {
        this.url = path;
        this.api = api;
        this.options = options;
    }

    public state(): string {
        return this.status;
    }

    public start(freq?: number): void {

        if (freq)
            this.frequency = freq;

        this.status = "running";
        
        // ensure that only changes are returned
        let subOptions = $.extend({}, this.options, { onlyChanges: true });

        console.log("Subscription.start()");

        // and then every 5 seconds
        this.interval = window.setInterval(() => {
            this.api.get(this.url, subOptions).then((reply: any) => {
                // a reply of null means no changes
                if (reply != null) {
                    for (let s = 0; s < this.callbacks.length; s++) {
                        this.callbacks[s].func(reply);
                    }
                }
            }).catch((ex) => {
                this.statusNot200 = true;
                this.stop();
                });
        }, (this.frequency*1000));
        
    }

    public stop(): void {
        console.log("Subscription.stop()");
        this.status = "stopped";
        window.clearInterval(this.interval);
    }

    public pause(): void {
        console.log("Subscription.pause()");
        this.status = "paused";
        window.clearInterval(this.interval);
    }

}
