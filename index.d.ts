import { Store, StoreonEvents } from 'storeon';

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
 * ```
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 * ```
 */
export declare const asyncRoutingModule: <S extends StateWithRouting>(
    store: Store<S, AsyncRoutingEvents<S>>) => void;

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
 * ```
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 * onNavigate(store, '/abc', (navigation) => console.log(`Hello on url ${navigation.url}`);
 * ```
 */
export declare function onNavigate<S extends StateWithRouting, E extends (AsyncRoutingEvents & StoreonEvents<S>)>(
    store: Store<S, E>, route: string, callback: RouteCallback): () => void

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
 * ```
 * import createStore from 'storeon';
 * import { asyncRoutingModule } from 'storeon-async-router;
 * const store = createStore([asyncRoutingModule, your_module1 ...]);
 * onNavigate(store, '/abc', (navigation) => console.log(`Hello on url ${navigation.url}`);
 * navigate(store, '/abc');
 * ```
 */
export declare function navigate<S extends StateWithRouting, E extends (AsyncRoutingEvents & StoreonEvents<S>)>(
    store: Store<S, E>, url: string, force?: boolean, options?: any): Promise<void>;

/**
 * Cancel current navigation.
 * @param store on store
 */
export declare function cancelNavigation<S extends StateWithRouting, E extends (AsyncRoutingEvents & StoreonEvents<S>)>(
    store: Store<S, E>): void;

/**
 * Event dispatched to start navigation.
 */
export const NAVIGATE_EVENT = Symbol('NAVIGATE');

/**
 * Event dispatched immediately when navigation starts.
 */
export const BEFORE_EVENT = Symbol('BEFORE_NAVIGATION');

/**
 * Event dispatched when navigation is postponed what means
 * that there was async handler attached to route.
 */
export const POSTPONE_EVENT = Symbol('POSTPONE_NAVIGATION');

/**
 * Event dispatched when handler is registered to route.
 */
export const REGISTER_EVENT = Symbol('REGISTER_ROUTE');

/**
 * Event dispatched when handler is unregistered.
 */
export const UNREGISTER_EVENT = Symbol('UNREGISTER_ROUTE');

/**
 * Event dispatched when navigation is ended successfully.
 */
export const ENDED_EVENT = Symbol('NAVIGATION_ENDED');

/**
 * Event dispatched when navigation is failed.
 */
export const FAILED_EVENT = Symbol('NAVIGATION_FAILED');

/**
 * Event dispatched when navigation is ignored.
 */
export const IGNORED_EVENT = Symbol('NAVIGATION_IGNORED');

/**
 * Event dispatched when navigation is cancelled.
 */
export const CANCELLED_EVENT = Symbol('NAVIGATION_CANCELLED');

/**
 * Types of events supported by asyncRoutingEvents
 */
export interface AsyncRoutingEvents {
    [NAVIGATE_EVENT]: Navigation;
    [BEFORE_EVENT]: Navigation;
    [POSTPONE_EVENT]: NavigationState;
    [REGISTER_EVENT]: {id:number, route: string};
    [UNREGISTER_EVENT]: {id:number, route: string};
    [ENDED_EVENT]: NavigationState;
    [FAILED_EVENT]: { navigation: Navigation, error: any };
    [IGNORED_EVENT]: Navigation;
    [CANCELLED_EVENT]: Navigation;
}
