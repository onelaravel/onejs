import { __defineProp, __hasOwnProp } from '../helpers/utils.js';
import OneDOM from './OneDOM.js';
import { TemplateDetectorService } from './services/TemplateDetectorService.js';

export class OneMarkupModel {
    constructor(fullName, openTag, closeTag, attributes = {}, nodes = []) {
        /**
         * @type {Element|Comment}
         */
        this.__openTag = openTag;
        /**
         * @type {Element|Comment}
         */
        this.__closeTag = closeTag;
        this.__attributes = attributes;
        /**
         * @type {Array<Element|Comment>}
         */
        this.__nodes = nodes;
        this.__definedAttributes = [];
        this.__tagName = fullName.split(':')[1];
        this.__fullName = fullName;
        this.__defineAttributes(Object.keys(attributes));
    }
    __update(fullName, openTag, closeTag, attributes = {}, nodes = []) {
        this.__openTag = openTag;
        this.__closeTag = closeTag;
        this.__attributes = attributes;
        this.__nodes = nodes;
        this.__tagName = fullName.split(':')[1];
        this.__fullName = fullName;
        this.__defineAttributes(Object.keys(attributes));
        return this;
    }
    __defineAttributes(attributeKeys = []) {
        for (let i = 0; i < attributeKeys.length; i++) {
            const key = attributeKeys[i];
            this.__defineAttribute(key);
        }
        return this;
    }
    __defineAttribute(name) {
        if (this.__definedAttributes.includes(name)) {
            return this;
        }
        this.__definedAttributes.push(name);
        __defineProp(this, name, {
            set: (value) => {
                this.__attributes[name] = value;
                return value;
            },
            get: () => {
                return this.__attributes[name];
            }
        });
        return this;
    }
    get tagName() {
        return this.__tagName;
    }
    set tagName(name) {
        // this.__tagName = name;
        return this;
    }
    get fullName() {
        return this.__fullName;
    }
    set fullName(name) {
        // this.__fullName = name;
        return this;
    }
    get openTag() {
        return this.__openTag;
    }
    get closeTag() {
        return this.__closeTag;
    }
    get attributes() {
        return this.__attributes;
    }
    /**
     * Get the nodes of the markup element
     * @returns {Array<Element|Comment>} - The nodes of the markup element
     */
    get nodes() {
        return this.__nodes;
    }
    getAttribute(name) {
        return this.__attributes[name];
    }
    setAttribute(name, value) {
        this.__defineAttribute(name);
        this.__attributes[name] = value;
        return this;
    }
    __match(attributes = {}) {
        let keys = Object.keys(attributes);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = attributes[key];
            if (key === 'tagName') {
                if (this.__tagName !== value) {
                    return false;
                }
                continue;
            }
            else if (key === 'openTag') {
                if (this.__openTag !== value) {
                    return false;
                }
                continue;
            }
            else if (key === 'closeTag') {
                if (this.__closeTag !== value) {
                    return false;
                }
                continue;
            }
            else if (key === 'attributes') {
                continue;
            }
            else if (key === 'nodes') {
                continue;
            }
            else if (this.__attributes[key] !== value) {
                return false;
            }
        }
        return true;
    }
    __scan() {
        const nodes = [];
        let currentNode = this.__openTag.nextSibling;
        while (currentNode && currentNode !== this.__closeTag) {
            nodes.push(currentNode);
            currentNode = currentNode.nextSibling;
        }
        this.__nodes.length = 0;
        this.__nodes.push(...nodes);
        return this.__nodes;
    }
    updateNodes(nodes = []) {
        this.__nodes = nodes;
        return this;
    }

    replaceContent(content) {
        if (this.__nodes.length > 0) {
            this.__nodes.forEach(node => {
                node.parentNode.removeChild(node);
            });
            this.__nodes.length = 0;
        }
        OneDOM.before(this.__closeTag, content);
        this.__scan();
        return this;
    }
}

export class OneMarkupCollection {
    constructor(elements = []) {
        this.__models = elements.map(element => (element instanceof OneMarkupModel) ? element : new OneMarkupModel(element.fullName, element.openTag, element.closeTag, element.attributes, element.nodes));
    }
    get models() {
        return this.__models;
    }
    get length() {
        return this.__models.length;
    }

    /**
     * Get the first model in the collection
     * @returns {OneMarkupModel} - The first model in the collection
     */
    get first() {
        return this.__models[0];
    }
    /**
     * Get the last model in the collection
     */
    get last() {
        return this.__models[this.__models.length - 1];
    }
    push(model) {
        if (!(model instanceof OneMarkupModel)) {
            model = new OneMarkupModel(model.fullName, model.openTag, model.closeTag, model.attributes, model.nodes);
        }
        this.__models.push(model);
        return this;
    }
    pop() {
        return this.__models.pop();
    }
    shift() {
        return this.__models.shift();
    }
    unshift(model) {
        if (!(model instanceof OneMarkupModel)) {
            model = new OneMarkupModel(model.fullName, model.openTag, model.closeTag, model.attributes, model.nodes);
        }
        this.__models.unshift(model);
        return this;
    }
    splice(start, deleteCount, ...items) {
        if (!(items instanceof OneMarkupCollection)) {
            items = new OneMarkupCollection(items);
        }
        this.__models.splice(start, deleteCount, ...items.__models);
        return this;
    }
    slice(start, end) {
        return this.__models.slice(start, end);
    }
    concat(models) {
        if (!(models instanceof OneMarkupCollection)) {
            models = new OneMarkupCollection(models);
        }
        return new OneMarkupCollection(this.__models.concat(models.__models));
    }
    reverse() {
        return new OneMarkupCollection(this.__models.reverse());
    }

    /**
     * Get the model at the given index
     * @param {number} index - The index of the model to get
     * @returns {OneMarkupModel} - The model at the given index
     */
    get(index) {
        return this.__models[index];
    }
    /**
     * Set the model at the given index
     * @param {number} index - The index of the model to set
     * @param {OneMarkupModel} model - The model to set at the given index
     * @returns {OneMarkupCollection} - The collection
     */
    set(index, model) {
        this.__models[index] = model;
        return this;
    }

    /**
     * Map the collection to a new array
     * @param {function} callback - The callback function to map the collection
     * @returns {Array} - The new array
     */
    map(callback) {
        return this.__models.map(callback);
    }
    /**
     * Filter the collection to a new array
     * @param {function} callback - The callback function to filter the collection
     * @returns {Array} - The new array
     */
    filter(callback) {
        return this.__models.filter(callback);
    }
    /**
     * Reduce the collection to a single value
     * @param {function} callback - The callback function to reduce the collection
     * @param {any} initialValue - The initial value to reduce the collection
     * @returns {any} - The reduced value
     */
    reduce(callback, initialValue) {
        return this.__models.reduce(callback, initialValue);
    }
    /**
     * For each the collection
     * @param {function} callback - The callback function to for each the collection
     * @returns {OneMarkupCollection} - The collection
     */
    forEach(callback) {
        return this.__models.forEach(callback);
    }
    /**
     * Some the collection
     * @param {function} callback - The callback function to some the collection
     * @returns {boolean} - True if some of the collection matches the callback, false otherwise
     */
    some(callback) {
        return this.__models.some(callback);
    }
    /**
     * Every the collection
     * @param {function} callback - The callback function to every the collection
     * @returns {boolean} - True if every of the collection matches the callback, false otherwise
     */
    every(callback) {
        return this.__models.every(callback);
    }
    /**
     * Query the collection
     * @param {object} attributes - The attributes to query the collection
     * @returns {Array} - The filtered array
     */
    query(attributes = {}) {
        return this.__models.filter(model => model.__match(attributes));
    }
    find(attributes = {}) {
        return this.query(attributes)[0] || null;
    }
}

export class OneMarkupService {
    constructor() {
        /**
         * @type {TemplateDetectorService}
         */
        this.detector = new TemplateDetectorService(document.documentElement);
    }

    /**
     * Find the first element that matches the pattern and attributes
     * @param {string} pattern - The pattern to find
     * @param {object} attributes - The attributes to find
     * @param {object} options - The options to find
     * @param {number} total - The total to find
     * @returns {OneMarkupModel|OneMarkupCollection} - The first element that matches the pattern and attributes
     */
    find(pattern = '*', attributes = {}, options = {}, total = false, isOne = false) {
        if (!__hasOwnProp(this, 'useCache')) {
            options.useCache = false;
        }
        const elements = this.detector.find("one:" + pattern, options);
        const isTotal = total && typeof total === 'number' && total !== 0;
        const isLast = isTotal && total === -1 && isOne;
        const isFirst = total && total === 1 && isOne;
        const isRight = isTotal && total < 0 && !isOne;
        const oneIndex = isOne && isTotal && !isLast && !isFirst ? (total >= 0 ? (elements.length - total > 0 ? total : 0) : 0) : (elements.length + total > 0 ? (elements.length + total - 1): elements.length - 1);
        
        if (elements.length === 0) {
            if (isLast || isFirst) {
                return null;
            }
            return new OneMarkupCollection([]);
        }
        if (typeof attributes !== 'object' || attributes === null || Object.keys(attributes).length === 0) {
            if (!isTotal) {
                return new OneMarkupCollection(elements);
            }
            if (isLast) {
                const lastElement = elements[elements.length - 1];
                return new OneMarkupModel(lastElement.fullName, lastElement.openTag, lastElement.closeTag, lastElement.attributes, lastElement.nodes);
            }
            if (isFirst) {
                return new OneMarkupModel(elements[0].fullName, elements[0].openTag, elements[0].closeTag, elements[0].attributes, elements[0].nodes);
            }
            if (isRight) {
                let rightIndex = elements.length - total;
                if (rightIndex < 0) {
                    rightIndex = 0;
                }
                return new OneMarkupCollection(elements.slice(rightIndex));
            }
            if(isOne){
                const element = elements[oneIndex];
                if(!element){
                    return null;
                }
                return new OneMarkupModel(element.fullName, element.openTag, element.closeTag, element.attributes, element.nodes);
            }
            return new OneMarkupCollection(elements.slice(0, total));


        }
        const keys = Object.keys(attributes);
        const result = [];
        const elementCount = elements.length;
        const lastIndex = elementCount - 1;
        let findIndex = 0;
        for (let i = 0; i < elementCount; i++) {
            if (isLast && findIndex < lastIndex) {
                continue;
            }
            const element = elements[i];
            let isMatch = true;
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                const value = attributes[key];
                if (element.attributes[key] !== value) {
                    isMatch = false;
                    break;
                }
            }
            if (!isMatch) {
                continue;
            }
            if (isFirst) {
                return new OneMarkupModel(element.fullName, element.openTag, element.closeTag, element.attributes, element.nodes);
            }
            else if (isLast) {
                if(findIndex === lastIndex) {
                    return new OneMarkupModel(element.fullName, element.openTag, element.closeTag, element.attributes, element.nodes);
                }
                findIndex++;
                continue;
            }
            else if(isRight) {
                if(findIndex >= rightIndex) {
                    result.push(element);
                }
                findIndex++;
                continue;
            }
            else if(isTotal) {
                result.push(element);
                findIndex++;
                if(result.length >= total) {
                    return new OneMarkupCollection(result);
                }
            }
            else if(isOne && findIndex === oneIndex){
                return new OneMarkupModel(element.fullName, element.openTag, element.closeTag, element.attributes, element.nodes);
            }
            else{
                result.push(element);
                findIndex++;
            }
        }
        if(result.length === 0) {
            if (isLast || isFirst || isOne) {
                return null;
            }
        }
        return new OneMarkupCollection(result);
    }
    findOne(pattern = '*', attributes = {}, options = {}, index = 0) {
        return this.find(pattern, attributes, options, index, true);
    }

    first(pattern = '*', attributes = {}, options = {}) {
        return this.find(pattern, attributes, options, 1, true);
    }
    last(pattern = '*', attributes = {}, options = {}) {
        return this.find(pattern, attributes, options, -1, true);
    }
    right(pattern = '*', attributes = {}, total = 1, options = {}) {
        return this.find(pattern, attributes, options, -total, false);
    }
}

export const OneMarkup = new OneMarkupService();
export default OneMarkup;