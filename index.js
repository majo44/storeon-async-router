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

const NAVIGATE_EVENT = Symbol('NAVIGATE');
const BEFORE_EVENT = Symbol('BEFORE_NAVIGATION');
const POSTPONE_EVENT = Symbol('POSTPONE_NAVIGATION');
const REGISTER_EVENT = Symbol('REGISTER_ROUTE');
const UNREGISTER_EVENT = Symbol('UNREGISTER_ROUTE');
const ENDED_EVENT = Symbol('NAVIGATION_ENDED');
const FAILED_EVENT = Symbol('NAVIGATION_FAILED');
const IGNORED_EVENT = Symbol('NAVIGATION_IGNORED');
const CANCELLED_EVENT = Symbol('NAVIGATION_CANCELLED');

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
     * @param {object} state
     * @param {RoutingState} state.routing
     */
    const ignoreNext = ({ routing }) => ({ routing: { ...routing, next: undefined } });

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
        NAVIGATE_EVENT,
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
                    store.dispatch(IGNORED_EVENT, n);
                    return null;
                }
                // dispatch cancellation
                store.dispatch(CANCELLED_EVENT, routing.next);
            }

            // if the navigation is to same url as current
            if (
                routing.current
                && routing.current.url === n.url
                && !n.force
            ) {
                // we will ignore this navigation request
                store.dispatch(IGNORED_EVENT, n);
                return null;
            }

            // After state update
            Promise.resolve().then(() => {
                // dispatch before navigation event
                if (store.get().routing.next === n) {
                    store.dispatch(BEFORE_EVENT, n);
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
        ENDED_EVENT,
        /**
         * @param {StateWithRouting} state
         * @param {RoutingState} state.routing
         * @param {NavigationState} n
         */
        ({ routing }, n) => ({
            routing: { ...routing, next: undefined, current: n },
        }),
    );

    store.on(
        POSTPONE_EVENT,
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
        BEFORE_EVENT,
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
                    CANCELLED_EVENT,
                    /**
                     * @param {StateWithRouting} ls
                     * @param {Navigation} ln
                     * @return {null}
                     */
                    (ls, ln) => {
                        /* istanbul ignore else */
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
                            store.dispatch(POSTPONE_EVENT, navigation);
                            // await for end of callback
                            await res;
                            if (!ac.signal.aborted) {
                                // if was not cancelled, confirm end of navigation
                                store.dispatch(ENDED_EVENT, navigation);
                            }
                        } else {
                            // for synchronous, confirm end of navigation
                            store.dispatch(ENDED_EVENT, navigation);
                        }
                    }
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        // on any error
                        store.dispatch(FAILED_EVENT, { navigation, error });
                    }
                }
                // at the end disconnect cancellation
                disconnect();
            } else {
                // if there is no matched route
                store.dispatch(FAILED_EVENT,
                    { navigation: n, error: new Error(`No route handle for url: ${n.url}`) });
            }
        },
    );

    store.on(
        REGISTER_EVENT,
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
        UNREGISTER_EVENT,
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
    store.on(IGNORED_EVENT, async () => {});
    store.on(CANCELLED_EVENT, ignoreNext);
    store.on(FAILED_EVENT, ignoreNext);
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
    store.dispatch(REGISTER_EVENT, r);
    return () => {
        delete routes[id];
        store.dispatch(UNREGISTER_EVENT, r);
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
            /* istanbul ignore else */
            if (navigation.id === id) {
                unregister(); // eslint-disable-line no-use-before-define
                rej(error);
            }
            return null;
        };
        const u = [
            store.on(ENDED_EVENT, resolver),
            store.on(CANCELLED_EVENT, resolver),
            store.on(IGNORED_EVENT, resolver),
            store.on(FAILED_EVENT, rejector)];
        const unregister = () => u.map(e => e());
        store.dispatch(NAVIGATE_EVENT, {
            url, options, force, id,
        });
    });
}

/**
 * Cancel current navigation.
 * @param {import('storeon').Store.<StateWithRouting>} store
 */
function cancelNavigation(store) {
    store.dispatch(CANCELLED_EVENT, store.get().routing.next);
}

export {
    cancelNavigation,
    onNavigate,
    navigate,
    asyncRoutingModule,
    NAVIGATE_EVENT,
    BEFORE_EVENT,
    POSTPONE_EVENT,
    REGISTER_EVENT,
    UNREGISTER_EVENT,
    ENDED_EVENT,
    FAILED_EVENT,
    IGNORED_EVENT,
    CANCELLED_EVENT,
};
