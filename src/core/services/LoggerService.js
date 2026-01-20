export class LoggerService {
    constructor(config) {
        this.config = {
            level: 'info',
            enabled: false,
            console: true,
            remote: false
        };
        
        if (config) {
            this.setConfig(config);
        }

        this.logs = [];
    }

    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    getConfig() {
        return this.config;
    }

    consoleLog(method, ...args) {
        this.logs.push(...args)
        if (this.config.console && this.config.enabled) {
            return console[method].apply(console, args);
        }
    }

    log(...args) {
        return this.consoleLog('log', ...args);
    }

    warn(...args) {
        return this.consoleLog('warn', ...args);
    }

    error(...args) {
        return this.consoleLog('error', ...args); 
    }

    info(...args) {
        return this.consoleLog('info', ...args);
    }

    debug(...args) {
        return this.consoleLog('debug', ...args);
    }

}


export const logger = new LoggerService({level: 'info', enabled: true, console: true, remote: false});
export default logger;

