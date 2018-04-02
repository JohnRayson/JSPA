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
        
        let api = this;
        return new Promise((resolve, reject) => {
            // change this to the endpoint in your API that responds with the token
            resolve(this.post("auth/authenticate", model))
        }).then((reply: any) => {
            api.token = reply.token;
            window.sessionStorage.setItem("token", api.token);
            api.headers["X-Authentication"] = api.token;
            return reply.user;
        });
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
                // unautherized
                if (jqXHR.status == 401) {
                    config.routes[0].component.draw({ code: jqXHR.status, text: textStatus }).then(($content) => {
                        $("#" + config.contentElementId).replaceWith($("<div id= '" + config.contentElementId + "' />").append($content));
                    });
                }
                
                // if we havn't already returned return a reject()
                console.log("Error: ", jqXHR);
                return reject(jqXHR);
            });
        });
    }

    public createRequest(url: string, method: string = null, data: any = null): ApiRequest {
        let request = new ApiRequest();

        request.method = method || "GET";
        request.url = url;
        request.headers = this.headers;
        request.data = (data != null ? JSON.stringify(data) : null);
        
        return request;
    }

    private subsriptions = []
    public subscribe(path: string, handler: any, options: ApiRequestOptions): string {
        let sub = null;
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
        sub.callbacks.push({ id: ref, func: handler });

        // first anything from the local store?
        this.localDb.retrieve(options.datastore, function (item) {
            let matched = true;
            for (let member in options.retrieve) {
                if (item.value[member] !== options.retrieve[member])
                    matched = false;
            }
            if (matched) {
                //console.log("API.subscribe() from localDB: ", item.value);
                handler(item.value);
            }
        });

        // then over the wire for an update
        // call get - this gets all the data regardless of changes
        sub.api.get(sub.url, sub.options).then((reply: any) => {
            //console.log("API.subscribe() from remote: ", reply);
            handler(reply);
        });

        // if its not already running - start it
        if (!sub.started) {
            sub.start();
        }

        return ref;
    }
    public unsubscribe(id: string): void
    {
        console.log("API.unsubscribe(): ", { lookingfor: id, in: this.subsriptions });
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
    data: string;
    nonceRetryAttempts: number = 0;
}

class ApiRequestOptions {
    datastore: string;
    retrieve: any;
    onlyChanges?: boolean = false; // true = only return if from localDB, false = all regardless of changes
}

class Subscription {
    started: boolean = false;
    url: string;
    callbacks: any[] = [];
    interval: number;
    // anything other than 200 is bad?
    statusNot200: boolean = false;

    private api: Api;
    private options: ApiRequestOptions;

    constructor(path: string, api: Api, options: ApiRequestOptions) {
        this.url = path;
        this.api = api;
        this.options = options;
    }

    start(): void {
        this.started = true;
        
        // ensure that only changes are returned
        let subOptions = $.extend({}, this.options, { onlyChanges: true });

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
        }, 5000);
        
    }

    stop(): void {
        console.log("Subscription.stop()");
        this.started = false;
        window.clearInterval(this.interval);
    }

}
