/**
 * @typedef {Object} Navigation represents ongoing navigation
 * @property {string} url Requested url.
 * @property {number} id Unique identifier of navigation.
 * @property {boolean} [force] Force the navigation, for the cases when even for same url as current
 *      have to be handled.
 * @property {*} [options] Additional options for navigation, for browser url navigation it can be
 *      eg. replace - for replacing url in the url bar, ect..
 * @property {boolean} [async] Is this navigation processed in async way.
 */

/**
 * @typedef {Object} NavigationState represents state of navigation
 * @property {string} url Requested url.
 * @property {number} id Unique identifier of navigation.
 * @property {boolean} [force] Force the navigation, for the cases when even for same url as current
 *      have to be handled.
 * @property {*} [options] Additional options for navigation, for browser url navigation it can be
 *      eg. replace - for replacing url in the url bar, ect..
 * @property {boolean} [async] Is this navigation processed in async way.
 * @property {Object<string, string>} [params] Url params. For the case when provided route regexp
 *      contains some parameters groups.
 * @property {string} route Route expression which matched that navigation.
 */

/**
 * @typedef {Object} RoutingState Routing state.
 * @property {Array<{id:number, route: string}>} handles Map of registered route handles.
 * @property {NavigationState | undefined} [current] Current state of navigation.
 * @property {Navigation | undefined} [next] The navigation which is in progress.
 */

/**
 * @typedef {function(Navigation, AbortSignal): (void | Promise<void>)} RouteCallback
 *      callback for route navigation
 */

/**
 * @typedef {Object} StateWithRouting Type for declaration of store which using asyncRoutingModule.
 * @property {RoutingState} routing The state of router.
 */

/**
 * Registered routes cache.
 * @type {Object<number, {id: number, route: string, regexp: RegExp, callback: RouteCallback}>}
 */
const routes = {};

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

export const EVENTS = {
    /**
     * Action which you should dispatch when you want to start new navigation.
     */
    NAVIGATE: Symbol('NAVIGATE'),
    BEFORE: Symbol('BEFORE_NAVIGATION'),
    POSTPONE: Symbol('POSTPONE_NAVIGATION'),
    REGISTER: Symbol('REGISTER_ROUTE'),
    UNREGISTER: Symbol('UNREGISTER_ROUTE'),
    ENDED: Symbol('NAVIGATION_ENDED'),
    FAILED: Symbol('NAVIGATION_FAILED'),
    IGNORED: Symbol('NAVIGATION_IGNORED'),
    CANCELLED: Symbol('NAVIGATION_CANCELLED'),
};

/**
 * Storeon router module. Use it during your store creation.
 *
 * @param {import('storeon').Store<StateWithRouting>} store store instace
 *
 * @example
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 */
const asyncRoutingModule = (store) => {
    /**
     * Set default state on initialization.
     */
    store.on('@init', () => ({
        routing: {
            handles: [],
        },
    }));

    /**
     * Handling navigate action.
     */
    store.on(
        EVENTS.NAVIGATE,
        /**
         * @param {StateWithRouting} state
         * @param {RoutingState} state.routing
         * @param {Navigation} n
         * @return {StateWithRouting | null}
         */
        ({ routing }, n) => {
            // if is navigation in progress
            if (routing.next) {
                // if is for same url and not forced
                if (routing.next.url === n.url && !n.force) {
                    // we will ignore this navigation request
                    store.dispatch(EVENTS.IGNORED, n);
                    return null;
                }
                // dispatch cancellation
                store.dispatch(EVENTS.CANCELLED, routing.next);
            }

            // if the navigation is to same url as current
            if (
                routing.current
                && routing.current.url === n.url
                && !n.force
            ) {
                // we will ignore this navigation request
                store.dispatch(EVENTS.IGNORED, n);
                return null;
            }

            // After state update
            Promise.resolve().then(() => {
                // dispatch before navigation event
                if (store.get().routing.next === n) {
                    store.dispatch(EVENTS.BEFORE, n);
                }
            });

            // update state
            return {
                routing: {
                    ...routing,
                    next: n,
                },
            };
        },
    );

    store.on(
        EVENTS.CANCELLED,
        /**
         * @param {StateWithRouting} state
         * @param {RoutingState} state.routing
         */
        ({ routing }) => ({ routing: { ...routing, next: undefined } }),
    );

    store.on(
        EVENTS.ENDED,
        /**
         * @param {StateWithRouting} state
         * @param {RoutingState} state.routing
         * @param {NavigationState} n
         */
        ({ routing }, n) => ({
            routing: { ...routing, next: undefined, current: n },
        }),
    );
    store.on(EVENTS.FAILED,
        /**
         * @param {StateWithRouting} state
         * @param {RoutingState} state.routing
         */
        ({ routing }) => ({ routing: { ...routing, next: undefined } }));

    store.on(
        EVENTS.POSTPONE,
        /**
         * @param {StateWithRouting} s
         * @return {StateWithRouting}
         */
        s => /** @type {*} */({
            routing: {
                ...s.routing,
                next: {
                    ...s.routing.next,
                    async: true,
                },
            },
        }),
    );

    store.on(
        EVENTS.BEFORE,
        /**
         * @param {StateWithRouting} s
         * @param {RoutingState} s.routing
         * @param {NavigationState} n
         */
        async (s, n) => {
            /**
             * @type {RegExpMatchArray | null}
             */
            let match = null;
            /**
             * @type {string}
             */
            let route = '';
            // loohing for handle which related route matched requested url
            const handle = s.routing.handles.find(({ id }) => {
                match = n.url.match(routes[id].regexp);
                ({ route } = routes[id]);
                return !!match;
            });
            if (handle) {
                // prepare navigation state
                /**
                 * @type {NavigationState}
                 */
                const navigation = {
                    ...n,
                    route,
                    params: {
                        .../** @type {*} */(match).groups,
                        .../** @type {*} */(match).splice(1),
                    },
                };
                // taking callback for matched route
                const { callback } = routes[handle.id];
                // allows to cancellation
                const ac = new AbortController();
                const disconnect = store.on(
                    EVENTS.CANCELLED,
                    /**
                     * @param {StateWithRouting} ls
                     * @param {Navigation} ln
                     * @return {null}
                     */
                    (ls, ln) => {
                        if (ln.id === navigation.id) {
                            ac.abort();
                        }
                        return null;
                    },
                );
                try {
                    // call callback
                    const res = callback(navigation, ac.signal);
                    // taking new next (can be modified by callback)
                    const { next } = store.get().routing;
                    // check the navigation was no cancel already
                    if (next && next.id === navigation.id) {
                        if (res && typeof res.then === 'function') {
                            // if handle is async, notify store that we have to postpone navigation
                            store.dispatch(EVENTS.POSTPONE, navigation);
                            // await for end of callback
                            await res;
                            if (!ac.signal.aborted) {
                                // if was not cancelled, confirm end of navigation
                                store.dispatch(EVENTS.ENDED, navigation);
                            }
                        } else {
                            // for synchronous, confirm end of navigation
                            store.dispatch(EVENTS.ENDED, navigation);
                        }
                    }
                } catch (error) {
                    // on any error
                    store.dispatch(EVENTS.FAILED, { navigation, error });
                }
                // at the end disconnect cancellation
                disconnect();
            } else {
                // if there is no matched route
                store.dispatch(EVENTS.FAILED,
                    { navigation: n, error: new Error(`No route handle for url: ${n.url}`) });
            }
        },
    );

    store.on(
        EVENTS.REGISTER,
        /**
         * @param {StateWithRouting} s
         * @param {{id:number, route: string}} h
         * @return {StateWithRouting}
         */
        (s, h) => ({
            routing: {
                ...s.routing,
                handles: [h, ...s.routing.handles],
            },
        }),
    );

    store.on(
        EVENTS.UNREGISTER,
        /**
         * @param {StateWithRouting} s
         * @param {{id:number, route: string}} h
         * @return {StateWithRouting}
         */
        (s, h) => ({
            routing: {
                ...s.routing,
                handles: s.routing.handles.filter(i => i.id !== h.id),
            },
        }),
    );
    store.on(EVENTS.IGNORED, async () => {});
};

/**
 * Register the route handler to top of stack of handles.
 *
 * @param {import('storeon').Store<StateWithRouting>} store on store
 * @param {string} route the route regexp string
 * @param {RouteCallback} callback the callback which will be called on provided route
 *
 * @return {function(): void} unregistering rute handle
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
function onNavigate(store, route, callback) {
    const id = handleId;
    handleId += 1;
    routes[id] = {
        id, callback, route, regexp: new RegExp(route),
    };
    const r = { id, route };
    store.dispatch(EVENTS.REGISTER, r);
    return () => {
        delete routes[id];
        store.dispatch(EVENTS.UNREGISTER, r);
    };
}

/**
 * Navigate to provided route.
 *
 * @param {import('storeon').Store<StateWithRouting>} store on store
 * @param {string} url to url
 * @param {*} [options] additional options for navigation, for browser url navigation it can be
 *      eg. replace - for replacing url in the url bar, ect..
 * @param {boolean} [force] force navigation (even there is ongoing attempt for same route)
 * @return {Promise<void>} the signal that navigation ends, or navigation failed
 */
function navigate(store, url, force, options) {
    const id = navId;
    navId += 1;
    return new Promise((res, rej) => {
        /**
         * @param {StateWithRouting} s
         * @param {Navigation} n
         * @return {null}
         */
        const resolver = (s, n) => {
            if (n.id === id) {
                unregister(); // eslint-disable-line no-use-before-define
                res();
            }
            return null;
        };
        /**
         * @param {StateWithRouting} s
         * @param {object} data
         * @param {Error} data.error
         * @param {Navigation} data.navigation
         * @return {null}
         */
        const rejector = (s, { error, navigation }) => {
            if (navigation.id === id) {
                unregister(); // eslint-disable-line no-use-before-define
                rej(error);
            }
            return null;
        };
        const u = [
            store.on(EVENTS.ENDED, resolver),
            store.on(EVENTS.CANCELLED, resolver),
            store.on(EVENTS.IGNORED, resolver),
            store.on(EVENTS.FAILED, rejector)];
        const unregister = () => u.map(e => e());
        store.dispatch(EVENTS.NAVIGATE, {
            url, options, force, id,
        });
    });
}

/**
 * Cancel current navigation.
 * @param {import('storeon').Store.<StateWithRouting>} store
 */
function cancelNavigation(store) {
    store.dispatch(EVENTS.CANCELLED, store.get().routing.next);
}

export {
    cancelNavigation,
    onNavigate,
    navigate,
    asyncRoutingModule,
};
