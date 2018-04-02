class LocalDB {
    public store(name: string, data: any): Promise<any> {

        // what was actually written
        let written = [];

        // create a hash of the data so we can see if its changed
        let _localDB = this;
        function extend(item: any) {

            let internal = {
                signature: _localDB.createDataHash(item),
                writtenAt: moment().utc().format("YYYY-MM-DDTHH:mm:ss")
            };
            return $.extend({}, internal, item);
        }

        let writeArray: any[] = [];
        // it its already an array, just swap them out - else add the single item
        if ($.isArray(data))
            writeArray = data;
        else
            writeArray.push(data);

        let checkingForChanges = [];
        // extend each item with the hash
        for (let i = 0; i < writeArray.length; i++) {
            writeArray[i] = extend(writeArray[i]);
            checkingForChanges.push(this.checkForChanges(name, writeArray[i]));
        }
        let changed:boolean = false;
        // check if any have changed from the stored version
        return Promise.all(checkingForChanges).then((reply) => {
            for (let w = 0; w < reply.length; w++) {
                if (reply[w].changed) {
                    changed = true;
                }
            }

            let dbPromise = idb.open(config.database.name);
            dbPromise.then((db) => {
                let tx = db.transaction(name, "readwrite"); // we only open one object store - name, could be an array but need to check docs?
                let store = tx.objectStore(name);
                for (let w = 0; w < reply.length; w++) {
                    if (reply[w].changed) {
                        store.put(reply[w].data);
                    }
                }
                return tx.complete;
            });
            return { changed: changed, data: data };
        })
    }

    private checkForChanges(name: string, data: any): Promise<any> {
        
        // find the keypath for this DB - build it into an object
        // NB, this is so we can read it back and verify if the new data is differnt
        let keypath;
        for (let db in config.database.stores) {
            if (db === name) {
                keypath = config.database.stores[db].key.keyPath;
                if (!$.isArray(keypath))
                    keypath = [keypath];
                break;
            }
        }
        return this.retrieve(name, (item) => {
            let matched = true;
            for (let k in keypath) {
                // has to be falsey as componund keys must all match!
                if (item.value[keypath[k]] !== data[keypath[k]])
                    matched = false;
            }
            if (matched)
                return item.value;
        }).then((records) => {
            // should be only 1 (or none) as we used the full key
            if (!records[0] || records[0].signature != data.signature) {
                console.log("LocalDB.checkForChanges() : ", { stored: records, new: data })
                return { changed: true, data: data };
            }
            else {
                return { changed: false, data: data };
            }
        });
    };
    
    public retrieve(name: string, search: any): Promise<any[]> {

        return new Promise((resolve) => {
            let reply = [];
            // please note: i'm not 100% clear how this works
            let readCursor = function (cursor) {
                if (!cursor) { return; }
                let find = search(cursor);
                if (find)
                    reply.push(find);

                return cursor.continue().then(readCursor);
            }

            let dbPromise = idb.open(config.database.name);
            dbPromise.then((db) => {
                var tx = db.transaction(name, 'readonly');
                var store = tx.objectStore(name);
                return store.openCursor();
            }).then((cursor) => {
                return readCursor(cursor);
            }).then(() => {
                resolve(reply);
            }).catch(() => {
                resolve(reply);
            })
        });
    }

    public createDataHash(data: any): number {
        let str = JSON.stringify(data);
        let hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

}