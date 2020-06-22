import { StoreonStore } from 'storeon';

/**
 * Navigation represents ongoing navigation.
 */
export interface Navigation {
    /**
     * Unique identifier of navigation
     */
    id: number;
    /**
     * Requested url.
     */
    url: string;
    /**
     * Force the navigation, for the cases when even for same url as current have to be handled.
     */
    force?: boolean;
    /**
     * Additional options for navigation, for browser url navigation it can be
     *      eg. replace - for replacing url in the url bar, ect..
     */
    options?: any;
}

export interface NavigationState extends Navigation {

    /**
     * Url params. For the case when provided route regexp
     *      contains some parameters groups.
     */
    params?: {[key: string]: string};
    /**
     * Route expression which matched that navigation.
     */
    route: string;
}

export interface StateWithRouting {
    /**
     * Routing state.
     */
    readonly routing: {
        /**
         * Registered handlers ids.
         */
        readonly handles: Array<{id: number; route: string}>;
        /**
         * Current state of navigation.
         */
        readonly current?: NavigationState;
        /**
         * The navigation which is in progress.
         */
        readonly next?: Navigation;
        /**
         * The navigation which is in progress.
         */
        readonly candidate?: Navigation;
    };
}

/**
 * Callback for route navigation
 */
export type RouteCallback =
    (navigation: Navigation, signal: AbortSignal) => (void | Promise<void>);

/**
 * Registered routes cache.
 */
const routes: {[key: number]: {id: number; route: string; regexp: RegExp; callback: RouteCallback}} = {};

/**
 * Next handle id.
 * @type {number}
 */
let handleId = 0;

/**
 * Next navigation id.
 * @type {number}
 */
let navId = 0;


/**
 * Event dispatched when handler is registered to route.
 */
export const REGISTER_EVENT = Symbol('REGISTER_ROUTE');
/**
 * Event dispatched when handler is unregistered.
 */
export const UNREGISTER_EVENT = Symbol('UNREGISTER_ROUTE');
/**
 * Event dispatched before navigation.
 */
export const PRE_NAVIGATE_EVENT = Symbol('PRE_NAVIGATE_EVENT');
/**
 * Event dispatched to start navigation.
 */
export const NAVIGATE_EVENT = Symbol('NAVIGATE');
/**
 * Event dispatched after end of navigation.
 */
export const POST_NAVIGATE_EVENT = Symbol('POST_NAVIGATE_EVENT');
/**
 * Event dispatched when navigation is ended successfully.
 */
export const NAVIGATION_ENDED_EVENT = Symbol('NAVIGATION_ENDED');
/**
 * Event dispatched when navigation is failed.
 */
export const NAVIGATION_FAILED_EVENT = Symbol('NAVIGATION_FAILED');
/**
 * Event dispatched when navigation is cancelled.
 */
export const NAVIGATION_CANCELLED_EVENT = Symbol('NAVIGATE_CANCELLED');
/**
 * Event dispatched when navigation is ignored.
 */
export const NAVIGATION_IGNORED_EVENT = Symbol('NAVIGATE_IGNORED');
/**
 * Event dispatched when navigation have to be cancelled.
 */
export const CANCEL_EVENT = Symbol('CANCEL_EVENT');

export interface NavigationEvent {
    navigation: Navigation;
}

export interface RoutingEvents {
    [REGISTER_EVENT]: { id: number; route: string };
    [UNREGISTER_EVENT]: { id: number; route: string };
    [PRE_NAVIGATE_EVENT]: NavigationEvent;
    [NAVIGATE_EVENT]: NavigationEvent;
    [NAVIGATION_ENDED_EVENT]: {navigation: NavigationState};
    [NAVIGATION_FAILED_EVENT]: {navigation: Navigation; error: any };
    [NAVIGATION_CANCELLED_EVENT]: undefined;
    [NAVIGATION_IGNORED_EVENT]: NavigationEvent;
    [POST_NAVIGATE_EVENT]: {navigation: Navigation; error?: any };
    [CANCEL_EVENT]: undefined;
}

const ignoreNavigation = (navigation: Navigation, {current, next}: StateWithRouting['routing']) =>
    // if it is not forced and
    // if is for same url and not forced or
    // if the navigation is to same url as current
    !navigation.force && (next?.url === navigation.url || current?.url === navigation.url);

/**
 * Storeon router module. Use it during your store creation.
 *
 * @example
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 */
export const routingModule = (store: StoreonStore<StateWithRouting, RoutingEvents>) => {

    const dispatch = store.dispatch.bind(store);
    const on = store.on.bind(store);

    /**
     * Set default state on initialization.
     */
    on('@init', () => ({ routing: { handles: [] } }));

    // if the navigation have not to be ignored, set is as candidate
    on(PRE_NAVIGATE_EVENT, ({ routing }, { navigation }) => {
        if (ignoreNavigation(navigation, routing)) {
            // we will ignore this navigation request
            dispatch(NAVIGATION_IGNORED_EVENT, {navigation});
            return;
        }

        return {
            routing: {
                ...routing,
                candidate: navigation,
            },
        };
    });

    // waits for sync navigation requests
    // ignore all outdated candidates
    // go forward just by valid one
    on(PRE_NAVIGATE_EVENT, (_, { navigation }) => {
        setTimeout(() => {
            if (store.get().routing.candidate?.id === navigation.id) {
                dispatch(NAVIGATE_EVENT, { navigation })
            } else {
                dispatch(NAVIGATION_IGNORED_EVENT, {navigation});
            }
        })
    });

    // if we have something ongoing
    // we have to cancel them
    on(NAVIGATE_EVENT, ({ routing }) => {
        if (routing.next) {
            dispatch(NAVIGATION_CANCELLED_EVENT)
        }
    });

    // set new ongoing next navigation
    on(NAVIGATE_EVENT, ({ routing }) => ({
       routing: {
           ...routing,
           next: routing.candidate,
           candidate: null
       }
    }));

    // proceed ongoing navigation
    on(
        NAVIGATE_EVENT, async ({routing}, {navigation: n}) => {

            let match: RegExpMatchArray = undefined;
            let route = '';

            // looking for handle which match navigation
            const handle = routing.handles.find(({ id }) => {
                match = n.url.match(routes[id].regexp);
                ({ route } = routes[id]);
                return !!match;
            });

            // if there is no matched route, that is something wrong
            if (!handle || !match) {
                const error = new Error(`No route handle for url: ${n.url}`);
                dispatch(NAVIGATION_FAILED_EVENT,{ navigation: n, error });
                return;
            }

            // prepare navigation state
            const navigation: NavigationState = {
                ...n,
                route,
                params: {
                    ...(match.groups),
                    ...(match).splice(1).reduce(
                        (r, g, i) => ({...r, [i.toString(10)]: g}), {}),
                },
            };
            // taking callback for matched route
            const { callback } = routes[handle.id];
            // allows to cancellation
            const ac = new AbortController();
            const disconnect = on(NAVIGATION_CANCELLED_EVENT, () => ac.abort());
            try {
                // call callback
                const res = callback(navigation, ac.signal);
                // waits for the result
                await res;
                if (!ac.signal.aborted) {
                    // if was not cancelled, confirm end of navigation
                    dispatch(NAVIGATION_ENDED_EVENT, {navigation});
                }
                dispatch(POST_NAVIGATE_EVENT, {navigation});
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // on any error
                    dispatch(NAVIGATION_FAILED_EVENT, {navigation, error});
                }
            } finally {
                // at the end disconnect cancellation
                disconnect();
            }
        },
    );

    // state updates
    on(NAVIGATION_CANCELLED_EVENT, ({ routing }) => ({routing : { ...routing, candidate: undefined, next: undefined }}));
    on(NAVIGATION_FAILED_EVENT, ({ routing }) => ({routing : { ...routing, candidate: undefined, next: undefined }}));
    on(NAVIGATION_ENDED_EVENT, ({ routing }, {navigation}) =>
        ({routing : { ...routing, candidate: undefined, next: undefined, current: navigation }}));

    // binding events to close promise
    on(NAVIGATION_IGNORED_EVENT, (s, e) => dispatch(POST_NAVIGATE_EVENT, e));
    on(NAVIGATION_FAILED_EVENT, (s, e) => dispatch(POST_NAVIGATE_EVENT, e));

    // registration
    on(REGISTER_EVENT, ({routing}, h) =>
        ({ routing: { ...routing, handles: [h, ...routing.handles] }}));
    on(UNREGISTER_EVENT, ({routing}, {id}) =>
        ({ routing: { ...routing, handles: routing.handles.filter(i => i.id !== id) }}));

    // public
    on(CANCEL_EVENT, ({routing}) => {
        /* istanbul ignore else */
        if (routing.next || routing.candidate) {
            dispatch(NAVIGATION_CANCELLED_EVENT)
        }
    });
};

/**
 * Register the route handler to top of stack of handles.
 *
 * @example simple
 * onNavigate(store, '/home', () => console.log('going home'));
 *
 * @example redirection
 * onNavigate(store, '', () => navigate(store, '/404'));
 *
 * @example lazy loading
 * // admin page - lazy loading of modul'/admin', async (navigation, abortSignal) => {
 *      // preload module
 *      const adminModule = await import('/modules/adminModule.js');
 *      // if not aborted
 *      if (!abortSignal.aborted) {
 *          // unregister app level route handle
 *          unRegister();
 *          // init module, which will register own handle for same route
 *          adminModule.adminModule(store);
 *          // navigate once again (with force flag)
 *          navigate(store, navigation.url, false, true);
 *      }
 * });
 */
export const onNavigate = (
    store: StoreonStore<any, RoutingEvents>,
    route: string,
    callback: RouteCallback): () => void => {
    const id = handleId++;
    routes[id] = {
        id, callback, route, regexp: new RegExp(route),
    };
    const r = { id, route };
    store.dispatch(REGISTER_EVENT, r);
    return () => {
        delete routes[id];
        store.dispatch(UNREGISTER_EVENT, r);
    };
};

/**
 * Navigate to provided route.
 */
export const navigate = (
    store: StoreonStore<any, RoutingEvents>,
    url: string,
    force?: boolean,
    options?: any): Promise<void> => {
    const id = navId++;
    return new Promise((res, rej) => {
        const u = store.on(POST_NAVIGATE_EVENT, (s, { navigation, error }) => {
            if (id === navigation.id) {
                u();
                error ? rej(error) : res();
            }
        });
        store.dispatch(PRE_NAVIGATE_EVENT, { navigation: { id, url,  force, options } });
    });
};

/**
 * Cancel ongoing navigation.
 */
export const cancelNavigation = (store: StoreonStore<StateWithRouting, RoutingEvents>) => {
    store.dispatch(CANCEL_EVENT);
};

