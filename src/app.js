/**
 * App Core Module
 * ES6 Module for Blade Compiler
 */

import { HttpService } from "./core/services/HttpService.js";
import { Router } from "./core/Router.js";
import { ViewManager } from "./core/ViewManager.js";
import { API } from "./core/API.js";
import { Helper } from "./core/Helper.js";
import initApp from "./init.js";
import OneMarkup from "./core/OneMarkup.js";
import { StoreService } from "./core/services/StoreService.js";
import { EventService } from "./core/services/EventService.js";

export class Application {
    constructor() {
        this.name = 'OneApp';
        /**
         * @type {StoreService}
         */
        this.StoreService = StoreService;
        /**
         * @type {StoreService}
         */
        this.Store = StoreService.getInstance();
        this.EventService = EventService;
        /**
         * @type {EventService}
         */
        this.Event = EventService.getInstance();
        this.Helper = new Helper(this);
        this.Router = new Router(this);
        this.View = new ViewManager(this);
        this.HttpService = HttpService;
        this.Http = new HttpService();
        this.OneMarkup = OneMarkup;
        this.Api = API;
        this.mode = 'development';
        this.isInitialized = false;
        this.env = {
            mode: 'web',
            debug: false,
            base_url: '/',
            csrf_token: '',
            router_mode: 'history',
        }

    }
    init() {
        if (this.isInitialized) {
            return;
        }
        initApp(this);
        this.isInitialized = true;
    }
}

export const App = new Application();

export default App;
