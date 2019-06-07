import { Store } from 'storeon';

/**
 * Ongoing navigation object.
 */
export interface Navigation {
    /**
     * Requested url.
     */
    readonly url: string;
    /**
     * Unique identifier of navigation.
     */
    readonly id: number;
    /**
     * Additional options for navigation, for browser url navigation it can be
     *      eg. replace - for replacing url in the url bar, ect..
     */
    readonly options?: any;
    /**
     * Force the navigation, for the cases when even for same url as current have to be handled.
     */
    readonly force?: boolean;
    /**
     * Is this navigation processed in async way.
     */
    readonly async?: boolean;
}

/**
 * Persistent state of navigation.
 */
export interface NavigationState extends Navigation {
    /**
     * Url params. For the case when provided route regexp contains some parameters groups.
     * @example
     * for route '/(.*)/(.*), if the matched url will be /a/b, the params object will be
     *      {0: 'a', 1: 'b'}
     *
     * @example
     * in modern browsers which supports regexp group namings you can use also routes like
     * '/(?<entity>.*)/(?<page>.*)' if the matched url will be /a/1, the params object will be
     *      {0: 'a', 1: '1', entity: 'a', page: '1'}
     */
    readonly params?: {[key: string]: string};
    /**
     * Route expression which matched that navigation.
     */
    readonly route: string;
}

/**
 * Routing state.
 */
export interface RoutingState {
    /**
     * Map of registered route handles.
     */
    readonly handles: Array<{id:number, route: string}>;
    /**
     * Current state of navigation.
     */
    readonly current?: NavigationState;
    /**
     * The navigation which is in progress.
     */
    readonly next?: Navigation;
}

/**
 * Callback for route navigation handling.
 */
export type RouteCallback =
    /**
     * @param navigation handled navigation
     * @param abortSignal the signal which can be used for abort navigation
     */
    (navigation: NavigationState, abortSignal: AbortSignal) => (void | Promise<any>);

/**
 * Type for declaration of store which using asyncRoutingModule.
 */
export interface StateWithRouting {
    /**
     * The state of router.
     */
    routing: RoutingState
}

/**
 * Storeon router module. Use it during your store creation.
 * @example
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 */
export declare const asyncRoutingModule: (store: Store) => void;

/**
 * Register the route handler to top of stack of handles.
 *
 * @param store on store
 * @param route the route regexp string, for modern browsers you can use regexp group namings
 * @param callback the callback which will be called when provided route will be matched with requested url
 *
 * @return function for unregistering route handle
 *
 * @example
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 * onNavigate(store, '/abc', (navigation) => console.log(`Hello on url ${navigation.url}`);
*/
export declare function onNavigate(store: Store, route: string, callback: RouteCallback): () => void

/**
 * Navigate to provided route.
 *
 * @param store on store
 * @param url requested url
 * @param force force navigation (even there is ongoing attempt for same route)
 * @param options additional options for navigation, for browser url navigation it can be
 *      eg. replace - for replacing url in the url bar, ect..
 * @return the signal that navigation ends, or navigation failed
 *
 * @example
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 * onNavigate(store, '/abc', (navigation) => console.log(`Hello on url ${navigation.url}`);
 * navigate(store, '/abc');
 */
export declare function navigate(store: Store, url: string, force?: boolean, options?: any): Promise<void>;

/**
 * Cancel current navigation.
 * @param store on store
 */
export declare function cancelNavigation(store: Store): void;
