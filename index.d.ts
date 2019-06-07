/**
 * @typedef {{
 *      id?: number,
 *      url: string,
 *      replace?: boolean,
 *      force?:boolean,
 *      async?: boolean
 * }} Navigation represents ongoing navigation
 *
 * @typedef {Navigation & {
 *      params?: Object.<PropertyKey, string>,
 *      route: string
 * }} NavigationState represents state of navigation
 *
 * @typedef {{
 *      handles: Array.<{id:number, route: string}>,
 *      handleId: number,
 *      navId: number,
 *      current?: NavigationState
 *      next?: Navigation
 * }} RoutingState routing state
 *
 * @typedef {function(Navigation, AbortSignal): (void | Promise.<void>)} RouteCallback
 *      callback for route navigation
 *
 * @typedef {{routing: RoutingState}} StateWithRouting
 *      app state with routing module installed
 */
import { Store } from 'storeon';

export interface Navigation {
    readonly url: string;
    readonly id?: number;
    readonly replace?: boolean;
    readonly force?: boolean;
    readonly async?: boolean;
}

export interface NavigationState extends Navigation {
    readonly params?: {[key: string]: string};
    readonly route: string;
}

/**
 * Routing state.
 */
export interface RoutingState {
    readonly handles: Array<{id:number, route: string}>;
    readonly handleId: number;
    readonly navId: number;
    readonly current?: NavigationState;
    readonly next?: Navigation;
}

/**
 * Callback for route navigation handling.
 */
export type RouteCallback = (navigation: NavigationState, abortSignal: AbortSignal) => (void | Promise<any>);

/**
 * Type for declaration of store which using asyncRoutingModule.
 */
export interface StateWithRouting {
    routing: RoutingState
}

export declare const asyncRoutingModule: (store: Store) => void;

/**
* Register the route handler to top of stack of handles.
*
* @param store on store
* @param route the route regexp string
* @param callback the callback which will be called on provided route
*
* @return function for unregistering route handle
*/
export declare function onNavigate(store: Store, route: string, callback: RouteCallback): () => void

/**
 * Navigate to provided route.
 *
 * @param store on store
 * @param url to url
 * @param replace replace url
 * @param force force navigation (even there is ongoing attempt for same route)
 */
export declare function navigate(store: Store, url: string, replace?: boolean, force?: boolean): Promise<void>;

/**
 * Cancel current navigation.
 * @param store on store
 */
export declare function cancelNavigation(store: Store): void;
