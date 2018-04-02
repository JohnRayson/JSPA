class LocalStore {
    private _store;
    constructor(type: string) {
        switch (type) {
            case "session":
                this._store = window.sessionStorage;
                break;
            case "local":
                this._store = window.localStorage;
                break;
            default:
                this.error("ERROR: Unsupported store type passed to LocalStore");
                break;
        }
    }

    private error(msg: string): void {
        if (console.error)
            console.error(msg);
        else
            console.log(msg);
    }
    // set an entry
    setItem(key: string, data: any): void {
        if (!this._store)
            return this.error("ERROR: Data being set to an uninitilized LocalStore");

        // first stringify the data
        let json = JSON.stringify(data);
        this._store.setItem(key, json);
    }
    // get an entry
    getItem(key: string): any {
        if (!this._store)
            return this.error("ERROR: Data being retrieved from an uninitilized LocalStore");
        
        let data = JSON.parse(this._store.getItem(key));
        return data;
    }
    // remove an item
    removeItem(key: string): void {
        if (!this._store)
            return this.error("ERROR: Data being removed from an uninitilized LocalStore");

        this._store.removeItem(key);
    }
}
