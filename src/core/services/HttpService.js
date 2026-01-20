/**
 * HTTP Service Module
 * ES6 Module cho Blade Compiler
 */


class HttpService {

    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
        this.defaultHeaders = {};
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }

    setTimeout(timeout) {
        this.timeout = timeout;
    }

    setDefaultHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    setHeader(name, value) {
        this.defaultHeaders[name] = value;
    }

    async request(method, url, data = null, options = {}) {
        let fullUrl = url.startsWith('http') ? url : this.baseUrl + url;
        
        const config = {
            method: method.toUpperCase(),
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            },
            ...options
        };

        if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
            if (config.headers['Content-Type'] === 'application/json') {
                config.body = JSON.stringify(data);
            } else {
                config.body = data;
            }
        }
        if (data && method.toUpperCase() === 'GET') {
            const urlObj = new URL(fullUrl, window.location.origin);
            Object.keys(data).forEach(key => urlObj.searchParams.append(key, data[key]));
            fullUrl = urlObj.toString();
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(fullUrl, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const responseData = await response.json().catch(() => ({}));
            
            return {
                status: response.ok,
                statusCode: response.status,
                data: responseData,
                headers: response.headers
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    async get(url, params, options = {}) {
        return this.request('GET', url, params, options);
    }

    async post(url, data = null, options = {}) {
        return this.request('POST', url, data, options);
    }

    async put(url, data = null, options = {}) {
        return this.request('PUT', url, data, options);
    }

    async patch(url, data = null, options = {}) {
        return this.request('PATCH', url, data, options);
    }

    async delete(url, options = {}) {
        return this.request('DELETE', url, null, options);
    }
}


// Export cho ES6 modules
export { HttpService };