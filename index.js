// OneJS Framework Core Export
import { App } from './src/app.js';
import { viewLoader } from './src/core/ViewLoader.js';
import { EventService } from './src/core/services/EventService.js';
import initApp from './src/init.js';
import { View } from './src/core/View.js';
import logger from './src/core/services/LoggerService.js';
import { StoreService } from './src/core/services/StoreService.js';
import { HttpService } from './src/core/services/HttpService.js';
import { StorageService } from './src/core/services/StorageService.js';


export { OneMarkup } from './src/core/OneMarkup.js';
    
export const Store = StoreService.getInstance();
export const Storage = StorageService.getInstance('storage');
export const EventBus = EventService.getInstance();
// HttpService Class
// Export Core Components
export const Http = new HttpService();
// StorageService Class
// Export Core Components
export {
    App,
    viewLoader,
    EventService,
    initApp,
    View,
    StoreService,
    HttpService,
    StorageService,
    logger
};

// Default export
export default App;


