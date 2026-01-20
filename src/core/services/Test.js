/**
 * Test service để demo alias @app
 */
export class TestService {
    constructor() {
        this.name = 'TestService';
    }
    
    getMessage() {
        return `Hello from ${this.name}!`;
    }
    
    static create() {
        return new TestService();
    }
}

export default TestService;
