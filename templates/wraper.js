function wraper() {
    // start wrapper


    // this is the wrapper element
    
    const __WRAPPER_ELEMENT__ = document.createElement('template');
    const __REFS__ = [];
    const self = new View.Engine(__VIEW_PATH__);
    const __STATE__ = self.__.states;



    self.setApp(App);


    const parseRefs = (frag) => {
        for (let i = 0; i < frag.childNodes.length; i++) {
            const node = frag.childNodes[i];
            __REFS__.push(node);
        }
    }
    const createHtml = (template) => {
        try {
            __WRAPPER_ELEMENT__.innerHTML = template;
        } catch (error) {
            console.error(error);
            __WRAPPER_ELEMENT__.innerHTML = '';
        }
        let frag = __WRAPPER_ELEMENT__.content;
        parseRefs(frag);
        return frag;
    }
    
    /**
     * 
     * @param {*} value 
     * @returns {[any, function, string]}
     */
    const useState = (value) => {
        return __STATE__.__useState(value);
    };
    const updateRealState = (state) => {
        __STATE__.__.updateRealState(state);
    };

    const lockUpdateRealState = () => {
        __STATE__.__.lockUpdateRealState();
    };
    const updateStateByKey = (key, state) => {
        __STATE__.__.updateStateByKey(key, state);
    };

    if(typeof $$$DATA$$$.__SSR_VIEW_ID__ !== 'undefined'){
        delete $$$DATA$$$.__SSR_VIEW_ID__;
    }

    // end wrapper

}
const WRAPPER_CONFIG = {
    // start wrapper config

    __props__: ["__WRAPPER_ELEMENT__", "createHtml", "__REFS__", "parseRefs"],
    __WRAPPER_ELEMENT__: __WRAPPER_ELEMENT__,
    refs: __REFS__,
    parseRefs: parseRefs,
    createHtml: createHtml,

    // end wrapper config
};