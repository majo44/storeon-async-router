# storeon-async-router

[![npm version](https://badge.fury.io/js/storeon-async-router.svg)](https://badge.fury.io/js/storeon-async-router)
[![Build Status](https://travis-ci.org/majo44/storeon-async-router.svg?branch=master)](https://travis-ci.org/majo44/storeon-async-router)
[![Coverage Status](https://coveralls.io/repos/github/majo44/storeon-async-router/badge.svg?branch=master)](https://coveralls.io/github/majo44/storeon-async-router?branch=master)

<img src="https://storeon.github.io/storeon/logo.svg" align="right"
     alt="Storeon logo by Anton Lovchikov" width="160" height="142">
     
Asynchronous router for [Storeon](https://github.com/storeon/storeon).    

It size is ~1kB (minified and gzipped) and uses [Size Limit](https://github.com/ai/size-limit) to control size.

### Overview
The key features are:
* allows **async** route handlers for prefetch the data or lazy loading of modules
* support for **abort** the routing if there was some navigation cancel eg. by fast clicking
* allows **update** routing definition in fly (eg, when you are loading some self module lazy which should add 
self controlled routes).
* **ignores** same routes navigation

This router is implementation of idea of **state first routing**, which at first place reflects the 
navigation within the state, and reflection within the UI stay on application side. 
Also this library is decoupled from browser history. 
Examples of integration with browser history or UI code you can find in recipes.

### Install
> npm i storeon-async-router --save

### Requirements
* this library internally use [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), 
so for legacy browsers and for node.js you will need to use 
[abortcontroller-polyfill](https://www.npmjs.com/package/abortcontroller-polyfill). Please 
refer to [abortcontroller-polyfill](https://www.npmjs.com/package/abortcontroller-polyfill) documentation, as it is requires 
also polyfilles for promise (on IE) and fetch (Node and IE). 

### Usage
 
```javascript
import { createStoreon } from "storeon";
import { routingModule, onNavigate, navigate } from "storeon-async-router";

// create store with adding route module
const store = createStoreon([routingModule]);

// handle data flow events
store.on("dataLoaded", (state, data) => ({ data }));

// repaint state
store.on("@changed", state => {
  document.querySelector(".out").innerHTML = state.routing.next
    ? `Loading ${state.routing.next.url}`
    : JSON.stringify(state.data);
});

// register some route handle
onNavigate(store, "/home/(?<page>.*)", async (navigation, signal) => {
  // preload data
  const homePageData = await fetch(`${navigation.params.page}.json`, {
    signal
  }).then(response => response.json());
  // dispatch data to store
  store.dispatch("dataLoaded", homePageData);
});

// map anchors href to navigation event
document.querySelectorAll("a").forEach((anchor, no) =>
  anchor.addEventListener("click", e => {
    e.preventDefault();
    navigate(store, anchor.getAttribute("href"));
  })
);
```
[![Edit storeon-async-router-simple-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-routersample1-r1ey6?fontsize=14)

Or visit working [demo](https://r1ey6.codesandbox.io/) and try to run with Redux development tools, and  
try to fast click with http throttling, to see the navigation cancellation.


### Api
- `routingModule` - is storeon module which contains the whole logic of routing
   - this module contains reducer for the `routing` state property which contains:
      - `current` current applied `Navigation`
      - `next` ongoing `Navigation` (if there is any)
- `onNavigate(store, route, callback)` - function which registers route callback, on provided store 
for provided route (path regexp string). Callback is a function which will be called if route will be matched, 
Important think is that last registered handle have a higher 
priority, so if at the end you will register multiple handle for same route, 
only the last registered one will be used. `onNavigate` is returns function which can be used for 
unregister the handle. Params:
   - `store` instance of store
   - `route` the route path regexp string, please notice that only path is matched and can contains the rote params,
   If you want to read search params you have to do that in callback by parsing `url` string delivered there in 
   `navigation` object. On modern browsers you can use regexp group namings for path params.
   - `callback` the callback which will be called when provided route will be matched with requested url. 
   `callback` can returns undefined or promise. In case of promise, route will be not applied (navigation will be not 
   ended) until the promise will be not resolve. Callback is called with two parameters:
      - `navigation` ongoing `Navigation` object
      - `signal` which is [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), 
      to be notified that current processed navigation was cancelled. That parameter can be used directly on 
      calls of [fetch](https://developers.google.com/web/updates/2017/09/abortable-fetch) api.   
- `navigate(store, url, [force], [options])` - function which triggers navigation to particular url. Params:
   - `store` instance of store
   - `url` requested url string 
   - `force` optional force navigation, if there is a registered route which will match the requested url, even for same url 
   as current the route callback will be called 
   - `options` optional additional navigation options which will be delivered to route callback
   for browser url navigation it can be eg. replace - for replacing url in the url bar, ect.
- `cancelNavigation(store)` - function which cancel current navigation (if there is any in progress). Params:
   - `store` instance of store
- `Navigation` object contains
    - `url` requested url string
    - `id` unique identifier of navigation
    - `options` additional options for navigation, for browser url navigation it can be
    eg. replace - for replacing url in the url bar, ect..
    - `force` force the navigation, for the cases when even for same url as current have to be handled
    - `params` map of route parameters values (handled by matched route regexp grops)
    - `route` the route which handled that navigation 

### Recipes 

#### Redirection
Redirection of navigation from one route handler to another route.  
```javascript
// example of redirection from page to page
// the last registered route handle have a bigger priority then previous one
onNavigate(store, "/home/1", () => navigate(store, '/home/2'));
``` 
[![Edit storeon-async-router-redirection-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-router-simple-sample-mp91n?fontsize=14)


#### "Otherwise" Redirection

The very special case is "otherwise" route, such route is covers all uncovered routes and handler of such route 
should simply redirect navigation to well known route. 
Please remember also that "otherwise" route should be registered as a very first, as in [storeon-async-router] the 
highest priority has last registered routes.

```javascript
// example of "otherwise" redirection
// so for any unhandled route, we will redirect to '/404' route
onNavigate(store, "", () => navigate(store, '/404'));
``` 
  
#### Async route handle
##### Preloading the data
For case when before of navigation we want to preload some data, we can use async route handle and postpone the navigation.
We can use abort signal for aborting the ongoing fetch.     
```javascript
// register async route handle 
onNavigate(store, "/home/(?<page>.*)", async (navigation, signal) => {
  // retrieve the data from server, 
  // we are able to use our abort signal for fetch cancellation
  // please notice that on cancel, fetch will throw AbortError
  // which will stop the flow but this error will be handled on router level  
  const homePageData = await fetch(`${navigation.params.page}.json`, {
    signal
  }).then(response => response.json());
  // dispatch data to store
  store.dispatch("dataLoaded", homePageData);
});
``` 
[![Edit storeon-async-router-simple-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-routersample1-r1ey6?fontsize=14)

Please notice that used in example [RegExp named capture groups](http://2ality.com/2017/05/regexp-named-capture-groups.html) 
(like `/home/(?<page>.*)`) are part of ES2018 standard, and this syntax is not supported yet on 
[all browsers](https://kangax.github.io/compat-table/es2016plus/#test-RegExp_named_capture_groups). As a alternative you
can refer the parameters by the order no, so instead of `navigation.params.page` you can use `navigation.params[0]`.    

##### Lazy loading of submodule
For application code splitting we can simple use es6 `import()` function. In case when you will want to spilt your by the 
routes, you can simple do that with async router. What you need to do is just await for `import()` your lazy module within the 
route handle. You can additionally extend your routing within the loaded module.

```javascript    
// ./app.js
// example of lazy loading
// register the navigation to admin page, but keeps reference to unregister function
const unRegister = onNavigate(
  store,
  "/admin",
  async (navigation, abortSignal) => {
    // preload some lazy module
    const adminModule = await import("./adminModule.js");
    // check that navigation was not cancelled
    // as dynamic import is not support cancelation itself like fetch api
    if (!abortSignal.aborted) {
      // unregister app level route handle for that route
      // the lazy module will take by self control over the internal routing
      unRegister();
      // init module, here we will register event handlers on storeon in 
      // lazy loaded module
      adminModule.adminModule(store);
      // navigate once again (with force flag) to trigger the route handle from 
      // lazy loaded module
      navigate(store, navigation.url, true);
    }
  }
);
```

```javascript    
// ./adminModule.js
/**
 * Function which is responsible for initialize the lazy loaded module
 */
export function adminModule(store) {
  // registering own routing handler for the route of my module
  onNavigate(store, "/admin", async (navigation, signal) => {
    // preload data
    const adminPageData = await fetch(`admin.json`, {
      signal
    }).then(response => response.json());
    // const homePageData = await homePageDataResponse.json();
    // dispatch data to store
    store.dispatch("dataLoaded", adminPageData);
  });
}

```
[![Edit storeon-async-router-lazy-load-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-router-redirection-sample-h3p66?fontsize=14)

#### Integration with browser history
In order to synchronize the routing state within the store with the browser history (back/forward, location) 
we can simple connect the store with browser history object by fallowing code:

```javascript   
// returns full url
function getLocationFullUrl() {
  // we are building full url here, but if you care in your app only on 
  // path you can simplify that code, and return just window.location.pathname
  return (
    window.location.pathname +
    (window.location.search ? window.location.search : "") +
    (window.location.hash ? window.location.hash : "")
  );
}

// on application start navigate to current url
setTimeout(() => {
  navigate(store, getLocationFullUrl(), false, { replace: true });
});

// connect with back/forwad of browser history
window.addEventListener("popstate", () => {
  navigate(store, getLocationFullUrl());
});

// connecting store changes to browser history
store.on(NAVIGATE_ENDED_EVENT, async (state, navigation) => {
  // ignore url's from popstate
  if (getLocationFullUrl() !== navigation.url) {
    navigation.options && navigation.options.replace
      ? window.history.replaceState({}, "", navigation.url)
      : window.history.pushState({}, "", navigation.url);
  }
});
```
[![Edit storeon-async-router-browser-history-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-router-lazy-load-sample-r9pz0?fontsize=14)

Please remember that with such solution you should probably also set in your html document head `<base href="/"/>`  

#### Handling the anchor click events globally
To handle any html anchor click over the page you cansimple create global click handler like that:
```javascript
// on body level
document.body.addEventListener("click", function(event) {
  // handle anchors click, ignore external, and open in new tab
  if (
    !event.defaultPrevented &&
    event.target.tagName === "A" &&
    event.target.href.indexOf(window.location.origin) === 0 &&
    event.target.target !== "_blank" &&
    event.button === 0 &&
    event.which === 1 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    const path = event.target.href.slice(window.location.origin.length);
    navigate(store, path);
  }
});
```
[![Edit storeon-async-router-global-anchor-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-router-browser-history-sample-sybtj?fontsize=14)

#### Encapsulate routing to shared router object
If you do not want always to deliver store to utility functions you can simple encapsulate all functionality to single 
router object.
```javascript
import createStore from 'storeon';
import { asyncRoutingModule, onNavigate, navigate, cancelNavigation } from 'storeon-async-router';

// create store with adding route module
const store = createStore([asyncRoutingModule]);
// router factory
function routerFactory(store) {
    return {
        get current() {
            return store.get().routing.current;
        },
        navigate: navigate.bind(null, store),
        onNavigate: onNavigate.bind(null, store)
    }
}
// router instance
const router = routerFactory(store);
// adding handle
router.onNavigate('/home', () => {});
// navigate to url
router.navigate('/home'); 
``` 
[![Edit storeon-async-router-router-object-sample](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/storeon-async-router-global-anchor-sample-e7q66?fontsize=14)

### Internal data flow
1. user registers the handles by usage of `onNavigate` (can do this in stereon module, but within the @init callback),

    1.1 for each registered handle we generating unique `id`,
     
    1.2 cache the handle under that `id`, and dispatch `route register` event with provided route and handle `id`     

2. on `route register` we are storing in state provided route and id (at the top of stack)
3. on `navigate` event 

    3.1. we checking exit conditions (same route, or same route navigation in progres),
     
    3.2. if there is any ongoing navigation we are dispatch `navigation cancel` event
    
    3.3. then we are setting the `next` navigation in state,
    
    3.4. asynchronously dispatch `before navigation` event
    
4.  on `before navigation` event 

    4.1 we are looking in state for handle `id` which route matches requested url, by the matched `id` we are taking the
handle from cache,

    4.2. we creates AbortController from which we are taking the AbortSignal, 
    
    4.3. we attach to storeon handle for `navigation canceled` event to call `cancell` on AbortController 
    
    4.4. we call handle with details of navigation and abortSignal, if the result of handle call is Promise, we are waits to 
resolve, 

    4.5 we are dispatch `navigation end` event, and unregister `navigation canceled` handle

5. on `navigation canceled` we are clear the `next` navigation in state
6. on `navigation end` we move `next` to `current` ins state
