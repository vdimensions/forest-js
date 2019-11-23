import * as Immutable from "immutable";
import { IForestClient, ViewState } from "./index";

const HeaderNames = {
    ACCEPT: "Accept",
    CONTENT_TYPE: "Content-Type"
};
const JsonHeaders = function() {
    let headersObj: any = { };
    headersObj[HeaderNames.ACCEPT] = 'application/json';
    headersObj[HeaderNames.CONTENT_TYPE] = 'application/json';
    return headersObj;
}();

const stripBlanks = (obj: any) => {
    let result: any = { };
    let keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (!obj.hasOwnProperty(key) || obj[key] === null || obj[key] === undefined || obj[key] === '') {
            continue;
        }
        result[key] = obj[key];
    }
    return result;
};

const prepareBody = (options: any) => {
    let { body } = options;

    if (options && options.headers && options.headers[HeaderNames.CONTENT_TYPE] === JsonHeaders[HeaderNames.CONTENT_TYPE]) {
        body = options.body && JSON.stringify(stripBlanks(options.body));
    }

    return body;
};

// TODO: extract to separate lib
const HTTP = {

    get: (uri: string, options?: RequestInit): Promise<Response> => {
        const opts = {
            ...options,
            method: 'GET'
        };
        return fetch(uri, opts);
    },

    post: (uri: string, options?: RequestInit): Promise<Response> => {
        const opts = {
            ...options,
            method: 'POST'
        };

        return fetch(uri, {
            ...opts,
            body: prepareBody(opts)
        });
    },

    put: (uri: string, options?: RequestInit): Promise<Response> => {
        const opts = {
            ...options,
            method: 'PUT'
        };

        return fetch(uri, {
            ...opts,
            body: prepareBody(opts)
        });
    },

    patch: (uri: string, options?: RequestInit): Promise<Response> => {
        const opts = {
            ...options,
            method: 'PATCH'
        };

        return fetch(uri, {
            ...opts,
            body: prepareBody(opts)
        });
    },

    delete: (uri: string, options: RequestInit): Promise<Response> => {
        const opts = {
            ...options,
            method: 'DELETE'
        };

        return fetch(uri, opts);
    }
};

const toJson = (resp: Response) => (resp.ok) ? resp.json() : null;

const DefaultOptions : any = {
    // required for session state to work on the server-side
    credentials: "include",
    headers: JsonHeaders
};

type ForestResult = {
    path: string,
    views: ViewState<any>[]
};

const processForestResult = (data: ForestResult) => {
    let instances: Immutable.Map<string, ViewState<any>> = Immutable.Map<string, ViewState<any>>();
    let knownIds = Immutable.Map<string, string>();
    for (let i = 0; i < data.views.length; ++i) {
        let item = data.views[i];
        instances = instances.set(item.instanceId, item);
        knownIds = knownIds.set(item.instanceId, item.instanceId);
    }
    for (let j = 0; j < data.views.length; ++j) {
        Immutable.Map<string, string[]>(data.views[j].regions).valueSeq().forEach(v => v.forEach(id => knownIds = knownIds.delete(id)));
    }
    let hierarchy: Immutable.Map<string, string[]> = Immutable.Map<string, string[]>().set("", knownIds.valueSeq().toArray());
    return {
        template: data.path,
        instances: instances,
        hierarchy: hierarchy
    };
};

class ForestHttpClientImpl implements IForestClient {
    private readonly baseUrl: string;

    public constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async navigate(template: string) {
        const resp = await HTTP.get(`${this.baseUrl}/${template}`, DefaultOptions);
        const response = await toJson(resp);
        if (!resp || !response) {
            return undefined;
        }
        let data: ForestResult = response;
        return processForestResult(data);
    }

    async invokeCommand(instanceId: string, command: string, arg: any) {
        const resp = await HTTP.post(`${this.baseUrl}/${instanceId}/${command}`, { ...DefaultOptions, body: arg });
        const response = await toJson(resp);
        if (!resp || !response) {
            return undefined;
        }
        let data: ForestResult = response;
        return processForestResult(data);
    }
}

const ForestHttpClient = {
    create: (baseUrl: string) => new ForestHttpClientImpl(baseUrl)
};

export default ForestHttpClient;