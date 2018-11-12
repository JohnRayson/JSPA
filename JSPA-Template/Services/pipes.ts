
class Pipes {
    public displayDateTime(utc: string): string {

        if (!utc)
            return "";

        // only works for full utc format yyyy-mm-ddThh:mm:ssZ
        let parts = utc.split("T");
        if (parts[0] === "0001-01-01") // c# deafult date - probably NULL on DB
            return "";

        if (parts.length != 2)
            return utc;

        // split and rearrange the date
        let dateBits = parts[0].split("-");
        if (dateBits.length != 3)
            return utc;

        return dateBits[2] + "/" + dateBits[1] + "/" + dateBits[0] + " " + parts[1].replace("Z", "").split(".")[0];
    }

    public addGMT(date: string): string {
        if (date.length > 0)
            return date + " (GMT)";
        else
            return date;
    }

    public removeNull(value: string): string {
        if (value == null || value.toLowerCase() == "null")
            return "";
        return value
    }

    public toValidDomId(value: string): string {
        let ex = new RegExp("[\\s,]", "gi");
        let id: string = value.replace(ex, "-");
        return id;
    }
}
