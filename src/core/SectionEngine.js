import { uniqId } from "../helpers/utils";

export const SectionEngine = function (name, content, type = 'string', View) {
    const SECTION_ID = uniqId();
    const placholder = `<section-placeholder id="${SECTION_ID}" data-section-name="${name}"></section-placeholder>`
    const placeholderElement = View.templateToDom(placholder);
    const templator = document.createElement('template');
    templator.innerHTML = content;
    const frag = templator.content;
    /**
     * @type {NodeList}
     */
    const refs = [];

    if (type === 'html') {
        for (let i = 0; i < frag.childNodes.length; i++) {
            const node = frag.childNodes[i];
            refs.push(node);
        }
    }
    this.name = name;
    this.content = frag;
    this.refs = refs;
    this.placeholder = placholder;
    this.sectionId = SECTION_ID;
    this.isInserted = false;
    this.viewEngine = null;
    this.textContent = type === 'html' ? placholder : content;
    this.updateRefs = function () {
        const fragment = templator.content;
        refs.length = 0;
        for (let i = 0; i < fragment.childNodes.length; i++) {
            const node = fragment.childNodes[i];
            refs.push(node);
        }
    }
    this.replace = function () {
        const placeholder = document.querySelector(`#${this.sectionId}`);
        if (placeholder && placeholder.parentNode) {
            for (let i = refs.length - 1; i >= 0; i--) {
                const node = refs[i];
                placeholder.parentNode.insertBefore(node, placeholder);
            }
            placeholder.remove();
            this.isInserted = true;
        }
    }
    this.rerender = function (template) {
        if (refs.length > 0) {
            refs[0].parentNode.insertBefore(placeholderElement, refs[0]);
        }
        this.removeRefNodes();
        templator.innerHTML = template;
        this.updateRefs();
        this.replace();

    }

    this.removeRefNodes = function () {

        for (let i = 0; i < refs.length; i++) {
            const node = refs[i];
            node.remove();
        }
        refs.length = 0;
    }
    this.setViewEngine = function (viewEngine) {
        this.viewEngine = viewEngine;
        return this;
    }

};
SectionEngine.prototype.toString = function () {
    return this.textContent;
}