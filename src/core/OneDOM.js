export class OneDOM {
    static validateElement(element) {
        if (!(element instanceof Element || element instanceof Comment)) {
            throw new Error('Provided value is not a valid DOM Element');
        }
        return true;
    }
    /**
     * Convert various input types to a safe DocumentFragment
     * Supports: string, Element, NodeList, Array<Element|string>
     */
    static toFragment(content) {
        const fragment = document.createDocumentFragment();

        const appendItem = (item) => {
            if (!item) return;
            if (typeof item === 'string') {
                const template = document.createElement('template');
                template.innerHTML = item.trim();
                fragment.appendChild(template.content);
            } else if (item instanceof Element || item instanceof DocumentFragment) {
                fragment.appendChild(item);
            } else if (Array.isArray(item) || item instanceof NodeList) {
                item.forEach(appendItem);
            }
            else if (item instanceof Comment) {
                fragment.appendChild(item);
            }
            else if (item instanceof Text) {
                fragment.appendChild(item);
            }
            else {
                console.warn('Unsupported content type:', item);
            }
        };

        appendItem(content);
        return fragment;
    }

    /**
     * Chèn nội dung trước đối tượng tham chiếu trong DOM
     * @param {Element|Comment} target đối tường dùng để tham chiếu
     * @param {*} content nội dung thêm vào
     */
    static before(target, content) {
        if (!(target instanceof Element || target instanceof Comment)) throw new Error('Target must be a DOM element');
        target.parentNode.insertBefore(
            this.toFragment(content),
            target
        );
    }

    /**
     * Chèn nội dung sau đối tượng tham chiếu trong DOM
     * @param {Element|Comment} target đối tường dùng để tham chiếu
     * @param {*} content nội dung thêm vào
     */
    static after(target, content) {
        if (!(target instanceof Element || target instanceof Comment)) throw new Error('Target must be a DOM element');
        const frag = this.toFragment(content);
        if (target.nextSibling) target.parentNode.insertBefore(frag, target.nextSibling);
        else target.parentNode.appendChild(frag);
    }

    /**
     * Thay thế đối tượng tham chiếu trong DOM bằng nội dung mới
     * @param {Element|Comment} target đối tường dùng để tham chiếu
     * @param {*} content nội dung thay thế
     */
    static replace(target, content) {
        if (!(target instanceof Element || target instanceof Comment)) throw new Error('Target must be a DOM element');
        target.replaceWith(this.toFragment(content));
    }

    /**
     * Thêm nội dung vào cuối phần tử tham chiếu trong DOM
     * @param {Element} target phần tử dùng để tham chiếu
     * @param {*} content nội dung thêm vào
     */
    static append(target, content) {
        if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
        target.appendChild(this.toFragment(content));
    }

    /**
     * Thêm nội dung vào đầu phần tử tham chiếu trong DOM
     * @param {Element} target phần tử dùng để tham chiếu
     * @param {*} content nội dung thêm vào
     */
    static prepend(target, content) {
        if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
        if (!target.firstChild) {
            target.appendChild(this.toFragment(content));
            return;
        }
        target.insertBefore(this.toFragment(content), target.firstChild);
    }
    /**
     * Thiết lập nội dung HTML cho phần tử tham chiếu trong DOM
     * @param {Element} target phần tử dùng để tham chiếu
     * @param {*} content nội dung thiết lập
     */
    static setHTML(target, content) {
        if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
        target.innerHTML = '';
        target.appendChild(this.toFragment(content));
    }

    /**
     * Thay thế toàn bộ nội dung của phần tử tham chiếu trong DOM
     * @param {Element} target phần tử dùng để tham chiếu
     * @param {*} content nội dung thay thế
     */
    static replaceContent(target, content) {
        if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
        target.innerHTML = '';
        target.appendChild(this.toFragment(content));
    }

    static content(target, content) {
        if (content === undefined) {
            // Lấy nội dung
            if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
            return target.innerHTML;
        } else {
            // Thiết lập nội dung
            this.setHTML(target, content);
        }
    }

    static children(target, children = null) {
        if (!(target instanceof Element)) throw new Error('Target must be a DOM element');
        if (children === null || children === undefined) {
            return Array.from(target.children);
        } else {
            target.innerHTML = '';
            target.appendChild(this.toFragment(children));
        }
    }

    static getInputValue(el) {
        if (!el || !(el instanceof Element)) return null;

        const tag = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();

        // Input
        if (tag === 'input') {
            switch (type) {
                case 'checkbox':
                    return el.checked;
                case 'radio':
                    return el.checked ? (el.value ? el.value : false) : null;
                case 'file':
                    return el.multiple ? [...el.files] : el.files[0] || null;
                case 'number':
                case 'range':
                    return el.value === '' ? null : Number(el.value);
                default:
                    return el.value;
            }
        }

        // Select
        if (tag === 'select') {
            if (el.multiple) {
                return [...el.selectedOptions].map(o => o.value);
            }
            return el.value;
        }

        // Textarea
        if (tag === 'textarea') {
            return el.value;
        }

        // Contenteditable
        if (el.isContentEditable) {
            return el.innerText;
        }

        return null;
    }

    static setInputValue(el, value) {
        if (!el || !(el instanceof Element)) return;

        const tag = el.tagName.toLowerCase();
        const type = (el.type || '').toLowerCase();

        // Input
        if (tag === 'input') {
            switch (type) {
                case 'checkbox':
                    el.checked = Boolean(value);
                    return;

                case 'radio':
                    el.checked = el.value === value;
                    return;

                case 'file':
                    // Không thể set file programmatically (security)
                    return;

                case 'number':
                case 'range':
                    el.value = value ?? '';
                    return;

                default:
                    el.value = value ?? '';
                    return;
            }
        }

        // Select
        if (tag === 'select') {
            if (el.multiple && Array.isArray(value)) {
                [...el.options].forEach(opt => {
                    opt.selected = value.includes(opt.value);
                });
            } else {
                el.value = value ?? '';
            }
            return;
        }

        // Textarea
        if (tag === 'textarea') {
            el.value = value ?? '';
            return;
        }

        // Contenteditable
        if (el.isContentEditable) {
            el.innerText = value ?? '';
            return;
        }
    }


}

export default OneDOM;