import * as Immutable from "immutable";
import {attachReducer, Selector} from "./store";

export interface Command {
    name: string
}

export type CommandInfo = {
    name: string,
    invoke: (arg: any) => void
};

export interface ViewState<T = any> {
    instanceId: string,
    name: string,
    model: T,
    regions: Map<string, string[]>,
    commands: { [commandName: string]: Command },
    links: string[]
}

export class ViewContext<T = any> {
    instanceId: string = '';
    name: string = '';
    model: T;
    private readonly commands: { [commandName: string]: Command } = { };
    private readonly invokeCommand: (command: string, arg: any) => void;

    constructor(viewState: ViewState<T>, invokeCommand: (command: string, arg: any) => void) {
        this.model = viewState.model;
        this.instanceId = viewState.instanceId;
        this.name = viewState.name;
        this.commands = viewState.commands;
        this.invokeCommand = invokeCommand;
    }
    
    getCommand(command: string) {
        if (this.commands && this.commands[command]) {
            const cmd = this.commands[command];
            const result: CommandInfo = {
                name: cmd.name,
                invoke: (arg: any = null) => {
                    this.invokeCommand(cmd.name, arg);
                }
            };
            return result;
        }
    };
}

export class AppState {
    static empty = () => new AppState();
    template: string = '';
    instances: Immutable.Map<string, ViewState<any>> = Immutable.Map<string, ViewState<any>>();
    hierarchy: Immutable.Map<string, string[]> = Immutable.Map<string, string[]>();
}

export class AppContext {
    static empty = () => new AppContext();
    state: AppState = AppState.empty();
    engine: ForestEngine = noopEngine;
}

export type ForestEngine = {
    currentContext: () => AppContext,
    invokeCommand: (instanceID: string, name: string, arg: any | undefined) => void,
    navigate: (template : string) => Promise<AppContext | undefined>,
    render(state: AppState) : void
}

export interface IForestClient {
    navigate: (template: string) => Promise<AppState | undefined>
    invokeCommand: (instanceId: string, command: string, arg: any) => Promise<AppState | undefined>
}

const noopEngine : ForestEngine = {
    currentContext: AppContext.empty,
    invokeCommand: () => { },
    navigate: () => Promise.reject(),
    render: (state: AppState) => { }
};


const CONTEXT_REPLACE = "[CONTEXT_REPLACE] FFB1F805-1AA6-4FED-A9A1-7007A8E696C9";
type UpdateContextPayload = { 
    context: AppContext 
};
const UPDATE_STATE = "[UPDATE_STATE] B37B7498-CFE0-4509-95FD-E6DBD782D42D";
type StatePayload = { 
    state: AppState 
};
type ReducerAction<T = UpdateContextPayload | StatePayload> = {
    type: string,
    payload: T
}

/** CreateEngine Begin *******************************************/
export const CreateEngine : ((client: IForestClient, store: any) => Selector<AppContext>) = ((client: IForestClient, reduxStore: any) => {
    const initialAppContext = AppContext.empty();

    const reducer = (appContext: AppContext | undefined = initialAppContext, action : ReducerAction<any>) => {
        const {type, payload} = action;
        switch (type) {
            case CONTEXT_REPLACE:
                const updateContextPayload: UpdateContextPayload = payload;
                return updateContextPayload.context;
            case UPDATE_STATE:
                const mergeContextPayload: StatePayload = payload;
                return {
                    ...appContext,
                    ...{
                        state: {
                            ...appContext.state,
                            ...mergeContextPayload.state,
                            ...{template: mergeContextPayload.state.template || appContext.state.template}
                        }
                    }
                };
        }
        return appContext;
    };

    const selector = attachReducer(reduxStore, '$forest', reducer);

    const updateState = (state : AppState) => {
        reduxStore.dispatch({ type: UPDATE_STATE, payload : { state } });
        return;
    };

    const replace = (context : AppContext) => {
        reduxStore.dispatch({ type : CONTEXT_REPLACE, payload : { context } });
        return;
    };

    const engine : ForestEngine = {
        currentContext: () => reduxStore.getState(),
        invokeCommand: (instanceId: string, name: string, arg: any | undefined) => {
            client.invokeCommand(instanceId, name, arg).then(state => {
                if (!state) {
                    return;
                }
                updateState(state);
            })
        },
        navigate: (template: string) => {
            let ctx = selector(reduxStore.getState());
            return client.navigate(template).then(state => {
                if (!state) {
                    return;
                }
                const newContext: AppContext = {
                    ...ctx,
                    state: { ...ctx.state, ...state }
                };
                replace(newContext);
                return newContext;
            });
        },
        render: (state: AppState) => {
            updateState(state);
        }
    };
    replace({ ...initialAppContext, engine });
    return selector;
});
/** CreateEngine End *******************************************/
