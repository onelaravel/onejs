export const uniqId = (prefix = '') => {
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return prefix + id;
}

export const emptyFn = () => { };

export const noop = () => { };

export const __hasOwnProp = (obj, key) => {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export const __defineProps = (obj, props, configs = {}) => {
    Object.entries(props).forEach(([key, value]) => {
        Object.defineProperty(obj, key, {
            value: value,
            writable: configs[key]?.writable ?? false,
            configurable: configs[key]?.configurable ?? false,
            enumerable: configs[key]?.enumerable ?? false,
        });
    });
};

export const __defineProp = (obj, key, PropertyDescriptor = {}) => {
    if (!__hasOwnProp(PropertyDescriptor, 'value') && !(__hasOwnProp(PropertyDescriptor, 'get') && typeof PropertyDescriptor.get === 'function')) {
        throw new Error(`Property ${key} must have a value or get method`);
    }
    if (__hasOwnProp(PropertyDescriptor, 'value')) {
        if (__hasOwnProp(PropertyDescriptor, 'get')) {
            delete PropertyDescriptor.get;
        }
        if (__hasOwnProp(PropertyDescriptor, 'set')) {
            delete PropertyDescriptor.set;
        }
    }
    if (!__hasOwnProp(PropertyDescriptor, 'writable')) {
        if (!__hasOwnProp(PropertyDescriptor, 'get')) {
            PropertyDescriptor.writable = false;
        }
    }
    if (!__hasOwnProp(PropertyDescriptor, 'configurable')) {
        PropertyDescriptor.configurable = false;
    }
    if (!__hasOwnProp(PropertyDescriptor, 'enumerable')) {
        PropertyDescriptor.enumerable = false;
    }

    return Object.defineProperty(obj, key, PropertyDescriptor);
}

export const __defineProperties = (obj, properties) => {
    Object.entries(properties).forEach(([key, value]) => {
        __defineProp(obj, key, value);
    });
}

export const __defineMethods = (obj, methods) => {
    Object.entries(methods).forEach(([key, value]) => {
        if (typeof value !== 'function') {
            return;
        }
        Object.defineProperty(obj, key, {
            value: value,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    });
}

export const __defineGetters = (obj, getters) => {
    Object.entries(getters).forEach(([key, value]) => {
        Object.defineProperty(obj, key, {
            get: value,
            configurable: false,
            enumerable: false,
        });
    });
}
export const deleteProp = (obj, prop) => {
    try {
        delete obj[prop];
        return true;
    } catch (error) {
        console.error('App.deleteProp error:', error);
        return false;
    }
}
export const deleteProps = (obj, props) => {
    try {
        props.forEach(prop => {
            delete obj[prop];
        });
        return true;
    } catch (error) {
        console.error('App.deleteProps error:', error);
        return false;
    }
}

/**
 * Kiểm tra đối tượng có dữ liệu hay không
 * @param {object} obj biến đối tượng
 * @returns {boolean} true nếu có dữ liệu, false nếu rỗng
 */
export const hasData = obj => {
    if (!obj || typeof obj !== 'object') return false;
    for (const _ in obj) return true; // fast path
    return false;
}

export const isEmptyObject = obj => hasData(obj) === false;




/**
 * Kiểm tra xem chuỗi đầu vào có phải là một thẻ HTML hợp lệ hoặc danh sách các thẻ HTML hợp lệ không.
 * @param {string} input - Chuỗi cần kiểm tra
 * @returns {boolean} true nếu hợp lệ, false nếu không hợp lệ
 */
export function isHtmlString(input) {
    if (typeof input !== 'string') return false;
    // Loại bỏ khoảng trắng đầu cuối
    const str = input.trim();
    if (!str) return false;

    // Regex kiểm tra một thẻ HTML đơn
    const singleTagRegex = /^<([a-zA-Z][\w:-]*)(\s+[^<>]*)?>.*<\/\1>$|^<([a-zA-Z][\w:-]*)(\s+[^<>]*)?\/>$/s;

    // Regex kiểm tra danh sách các thẻ HTML (có thể có nhiều thẻ liền nhau)
    // Sử dụng DOMParser để kiểm tra chắc chắn hơn
    try {
        const parser = new DOMParser();
        // Bọc trong một thẻ cha để DOMParser không tự động thêm <html><body>
        const doc = parser.parseFromString(`<div>${str}</div>`, 'text/html');
        const wrapper = doc.body.firstElementChild;
        if (!wrapper) return false;
        // Nếu tất cả các node con đều là element node (thẻ html)
        for (let node of wrapper.childNodes) {
            if (node.nodeType !== 1) { // 1: ELEMENT_NODE
                // Cho phép text node chỉ nếu nó là khoảng trắng
                if (node.nodeType === 3 && !node.textContent.trim()) continue;
                return false;
            }
        }
        // Nếu có ít nhất một thẻ hợp lệ
        return wrapper.children.length > 0;
    } catch (e) {
        // Nếu DOMParser không hỗ trợ hoặc lỗi, fallback về regex đơn
        return singleTagRegex.test(str);
    }
}
/**
 * Escape string for HTML output
 * @param {*} value - Value to escape
 * @returns {string} Escaped string
 */
export function escapeString(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const str = String(value);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
        ;
}

/**
 * Thay thế tất cả các chuỗi con "find" trong "input" bằng chuỗi "replace".
 * Có 3 trường hợp:
 * 1. find là string, replace là string: thay thế tất cả find thành replace.
 * 2. find là object: key là chuỗi cần tìm, value là chuỗi thay thế.
 * 3. find là object, replace là string (prefix), postfix là string:
 *    tìm tất cả prefix+key+postfix, thay thế bằng value.
 * @param {string} input - Chuỗi gốc cần thay thế
 * @param {string|Object} find - Chuỗi hoặc object cần tìm để thay thế
 * @param {string|undefined} replace - Chuỗi thay thế hoặc prefix
 * @param {string|undefined} postfix - Chuỗi hậu tố (chỉ dùng cho dạng 3)
 * @returns {string} Chuỗi sau khi đã thay thế
 */
export function replaceAll(input, find, replace, postfix) {
    if (typeof input !== 'string' || !find) return input;

    // Trường hợp 1: find là string, replace là string
    if (typeof find === 'string') {
        if (find === '') return input;
        return input.split(find).join(replace);
    }

    // Trường hợp 2 & 3: find là object
    if (typeof find === 'object' && find !== null) {
        let result = input;
        // Dạng 3: có prefix (replace) và postfix

        if (typeof replace === 'string' && typeof postfix === 'string') {
            for (const [key, value] of Object.entries(find)) {
                if (key === '') continue;
                // Escape ký tự đặc biệt trong prefix, key, postfix
                const pattern = (replace + key + postfix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(pattern, 'g'), value);
            }
        }
        // Dạng 3: chỉ có prefix (replace), không có postfix
        else if (typeof replace === 'string' && typeof postfix === 'undefined') {
            for (const [key, value] of Object.entries(find)) {
                if (key === '') continue;
                const pattern = (replace + key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(pattern, 'g'), value);
            }
        }
        // Dạng 2: không có prefix, không có postfix
        else {
            for (const [key, value] of Object.entries(find)) {
                if (key === '') continue;
                const pattern = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(pattern, 'g'), value);
            }
        }
        return result;
    }

    // Nếu không khớp trường hợp nào, trả về input gốc
    return input;
}



export function withScope(context = {}, callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('withContext expects a function as the second argument.');
    }

    // Kiểm tra context phải là object
    if (typeof context !== 'object' || context === null) {
        throw new TypeError('Context must be a non-null object.');
    }

    // Tạo danh sách key và value
    const keys = Object.keys(context);
    const values = Object.values(context);

    // Tạo hàm mới có các biến cục bộ tương ứng
    const func = new Function(
        ...keys,
        `"use strict"; return (${callback.toString()})();`
    );

    // Gọi hàm mới trong phạm vi với context
    return func(...values);
}

function withContext(context, fn, self) {
    const keys = Object.keys(context);
    const values = Object.values(context);
    return function (...args) {
        return new Function(...keys, `"use strict"; return (${fn.toString()})(...arguments)`)
            .apply(self ?? this, values.concat(args));
    };
}

/**
* Execute function and return result
* @param {Function} fn - Function to execute
* @returns {string} Result as string
*/
export function exe(fn, defaultValue = '') {
    try {
        const result = typeof fn === 'function' ? fn() : fn;
        return result !== undefined ? result : defaultValue;
    } catch (error) {
        console.error('App.execute error:', error);
        return defaultValue;
    }
}

