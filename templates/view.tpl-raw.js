export const initTemplates = function (__SYSTEM_DATA__ = {}) {
    let { App, View, tplData = {} } = __SYSTEM_DATA__ || {};
    const evaluate = (fn) => {
        try {
            return fn();
        } catch (error) {
            console.error(error);
            return '';
        }
    }

    //allScobe
};