import {combineReducers, Reducer, Action, AnyAction} from 'redux';

const rootReducer = (attachedReducers = {}) => {
    let reducers = {
        ...attachedReducers
    };
    return combineReducers(reducers);
};

type Selector<S> = (s: any) => S;

export const attachReducer = <S = any, A extends Action = AnyAction>(store: Partial<any>, name: string, reducer: Reducer<S, A>) : Selector<S> => {
    const selector: Selector<S> = (s: any) => {
        return s && s[name];
    };
    if (!store.attachedReducers) {
        store.attachedReducers = {};
    }
    if (!selector(store.attachedReducers)) {
        store.attachedReducers[name] = reducer;
        store.replaceReducer(rootReducer(store.attachedReducers));
    }
    return selector;
}