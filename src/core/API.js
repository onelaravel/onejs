/**
 * API Module
 * ES6 Module for Blade Compiler
 */

// Import App from global init
import { HttpService } from './services/HttpService.js';

export class AppAPI {
    constructor() {
        this.http = new HttpService();
        this.http.setHeader('Content-Type', 'application/json');
        this.http.setHeader('Accept', 'application/json');
        this.http.setHeader('X-Requested-With', 'XMLHttpRequest');
        // Conditional document access for Node.js compatibility
        if (typeof document !== 'undefined') {
            const csrfToken = document.querySelector('meta[name="csrf-token"]');
            if (csrfToken) {
                this.http.setHeader('X-CSRF-TOKEN', csrfToken.getAttribute('content'));
            }
        }
        this.http.setHeader('X-DATA-TYPE', 'json');
        this.endpoints = typeof window !== 'undefined' ? window.APP_CONFIGS?.api?.endpoints || {} : {};
    }
    async getViewData(uri) {
        try {
            const response = await this.http.get(uri).then(response => {
                return response.status ? response.data : {};
            }).catch(error => {
                console.error('❌ AppAPI: Error getting view data:', error);
                return {};
            });

            return response;
        } catch (error) {
            console.error('❌ AppAPI: Error getting view data:', error);
            return {};
        }

    }
    async getSystemConfig() {
        return {};
        return this.http.get('/api/system/config').then(response => {
            return response.status ? response.data : {};
        }).catch(error => {
            console.error('❌ AppAPI: Error getting system config:', error);
            return {};
        });
    }
    async getSystemData() {
        let endpoint = this.endpoints?.system?.data;
        if (!endpoint) {
            return {};
        }
        return this.http.get(endpoint).then(response => {
            return response.status ? response.data : {};
        }).catch(error => {
            console.error('❌ AppAPI: Error getting system data:', error);
            return {};
        });
    }

    async getURIDAta() {
        const uri = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
        return this.getViewData(uri);
    }

}

export const API = new AppAPI();

export default API;