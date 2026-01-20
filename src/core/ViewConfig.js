const basePrefix = 'data-';
const ATTR = {
    PREFIX: {
        BASE: basePrefix,
        YIELD: `${basePrefix}yield-`,
        

        // DOM EVENTS - Mouse Events
        CLICK: `${basePrefix}click-`,
        DBLCLICK: `${basePrefix}dblclick-`,
        MOUSEDOWN: `${basePrefix}mousedown-`,
        MOUSEUP: `${basePrefix}mouseup-`,
        MOUSEOVER: `${basePrefix}mouseover-`,
        MOUSEOUT: `${basePrefix}mouseout-`,
        MOUSEMOVE: `${basePrefix}mousemove-`,
        MOUSEENTER: `${basePrefix}mouseenter-`,
        MOUSELEAVE: `${basePrefix}mouseleave-`,
        WHEEL: `${basePrefix}wheel-`,
        AUXCLICK: `${basePrefix}auxclick-`,

        // Keyboard Events
        KEYDOWN: `${basePrefix}keydown-`,
        KEYUP: `${basePrefix}keyup-`,
        KEYPRESS: `${basePrefix}keypress-`,

        // Form Events
        INPUT: `${basePrefix}input-`,
        CHANGE: `${basePrefix}change-`,
        SUBMIT: `${basePrefix}submit-`,
        RESET: `${basePrefix}reset-`,
        INVALID: `${basePrefix}invalid-`,
        SEARCH: `${basePrefix}search-`,

        // Focus Events
        FOCUS: `${basePrefix}focus-`,
        BLUR: `${basePrefix}blur-`,
        FOCUSIN: `${basePrefix}focusin-`,
        FOCUSOUT: `${basePrefix}focusout-`,

        // Selection Events
        SELECT: `${basePrefix}select-`,
        SELECTSTART: `${basePrefix}selectstart-`,
        SELECTIONCHANGE: `${basePrefix}selectionchange-`,

        // Touch Events
        TOUCHSTART: `${basePrefix}touchstart-`,
        TOUCHMOVE: `${basePrefix}touchmove-`,
        TOUCHEND: `${basePrefix}touchend-`,
        TOUCHCANCEL: `${basePrefix}touchcancel-`,

        // Drag & Drop Events
        DRAGSTART: `${basePrefix}dragstart-`,
        DRAG: `${basePrefix}drag-`,
        DRAGEND: `${basePrefix}dragend-`,
        DRAGENTER: `${basePrefix}dragenter-`,
        DRAGLEAVE: `${basePrefix}dragleave-`,
        DRAGOVER: `${basePrefix}dragover-`,
        DROP: `${basePrefix}drop-`,

        // Media Events
        PLAY: `${basePrefix}play-`,
        PAUSE: `${basePrefix}pause-`,
        ENDED: `${basePrefix}ended-`,
        LOADSTART: `${basePrefix}loadstart-`,
        LOADEDDATA: `${basePrefix}loadeddata-`,
        LOADEDMETADATA: `${basePrefix}loadedmetadata-`,
        CANPLAY: `${basePrefix}canplay-`,
        CANPLAYTHROUGH: `${basePrefix}canplaythrough-`,
        WAITING: `${basePrefix}waiting-`,
        SEEKING: `${basePrefix}seeking-`,
        SEEKED: `${basePrefix}seeked-`,
        RATECHANGE: `${basePrefix}ratechange-`,
        DURATIONCHANGE: `${basePrefix}durationchange-`,
        VOLUMECHANGE: `${basePrefix}volumechange-`,
        SUSPEND: `${basePrefix}suspend-`,
        STALLED: `${basePrefix}stalled-`,
        PROGRESS: `${basePrefix}progress-`,
        EMPTIED: `${basePrefix}emptied-`,
        ENCRYPTED: `${basePrefix}encrypted-`,
        WAKEUP: `${basePrefix}wakeup-`,

        // Window Events
        LOAD: `${basePrefix}load-`,
        UNLOAD: `${basePrefix}unload-`,
        BEFOREUNLOAD: `${basePrefix}beforeunload-`,
        RESIZE: `${basePrefix}resize-`,
        SCROLL: `${basePrefix}scroll-`,
        ORIENTATIONCHANGE: `${basePrefix}orientationchange-`,
        VISIBILITYCHANGE: `${basePrefix}visibilitychange-`,
        PAGEHIDE: `${basePrefix}pagehide-`,
        PAGESHOW: `${basePrefix}pageshow-`,
        POPSTATE: `${basePrefix}popstate-`,
        HASHCHANGE: `${basePrefix}hashchange-`,
        ONLINE: `${basePrefix}online-`,
        OFFLINE: `${basePrefix}offline-`,

        // Document Events
        DOMCONTENTLOADED: `${basePrefix}DOMContentLoaded-`,
        READYSTATECHANGE: `${basePrefix}readystatechange-`,

        // Error Events
        ERROR: `${basePrefix}error-`,
        ABORT: `${basePrefix}abort-`,

        // Context Menu
        CONTEXTMENU: `${basePrefix}contextmenu-`,

        // Animation Events
        ANIMATIONSTART: `${basePrefix}animationstart-`,
        ANIMATIONEND: `${basePrefix}animationend-`,
        ANIMATIONITERATION: `${basePrefix}animationiteration-`,

        // Transition Events
        TRANSITIONSTART: `${basePrefix}transitionstart-`,
        TRANSITIONEND: `${basePrefix}transitionend-`,
        TRANSITIONRUN: `${basePrefix}transitionrun-`,
        TRANSITIONCANCEL: `${basePrefix}transitioncancel-`,

        // Pointer Events (Modern browsers)
        POINTERDOWN: `${basePrefix}pointerdown-`,
        POINTERUP: `${basePrefix}pointerup-`,
        POINTERMOVE: `${basePrefix}pointermove-`,
        POINTEROVER: `${basePrefix}pointerover-`,
        POINTEROUT: `${basePrefix}pointerout-`,
        POINTERENTER: `${basePrefix}pointerenter-`,
        POINTERLEAVE: `${basePrefix}pointerleave-`,
        POINTERCANCEL: `${basePrefix}pointercancel-`,
        GOTPOINTERCAPTURE: `${basePrefix}gotpointercapture-`,
        LOSTPOINTERCAPTURE: `${basePrefix}lostpointercapture-`,

        // Fullscreen Events
        FULLSCREENCHANGE: `${basePrefix}fullscreenchange-`,
        FULLSCREENERROR: `${basePrefix}fullscreenerror-`,

        // Clipboard Events
        COPY: `${basePrefix}copy-`,
        CUT: `${basePrefix}cut-`,
        PASTE: `${basePrefix}paste-`,

        // Gamepad Events
        GAMEPADCONNECTED: `${basePrefix}gamepadconnected-`,
        GAMEPADDISCONNECTED: `${basePrefix}gamepaddisconnected-`,

        // Battery Events
        BATTERYCHARGINGCHANGE: `${basePrefix}batterychargingchange-`,
        BATTERYLEVELCHANGE: `${basePrefix}batterylevelchange-`,

        // Device Orientation Events
        DEVICEORIENTATION: `${basePrefix}deviceorientation-`,
        DEVICEMOTION: `${basePrefix}devicemotion-`,
        DEVICELIGHT: `${basePrefix}devicelight-`,
        DEVICEPROXIMITY: `${basePrefix}deviceproximity-`,

        // WebGL Events
        WEBGLCONTEXTLOST: `${basePrefix}webglcontextlost-`,
        WEBGLCONTEXTRESTORED: `${basePrefix}webglcontextrestored-`,


        // view
        VIEW: `${basePrefix}view-`,
    },
    KEYS: {
        VIEW: `${basePrefix}view`,
        VIEW_ID: `${basePrefix}view-id`,
        VIEW_REF: `${basePrefix}view-ref`,
        VIEW_SECTION_REF: `${basePrefix}view-section-ref`,
        VIEW_RESOURCE: `${basePrefix}view-resource`,
        VIEW_STYLE: `${basePrefix}view-style`,
        VIEW_WRAPPER: `${basePrefix}view-wrapper`,
        // yield
        YIELD_ATTR: `${basePrefix}yield-attr`,
        YIELD_CONTENT: `${basePrefix}yield-content`,
        YIELD_CHILDREN: `${basePrefix}yield-children`,
        YIELD_SUBSCRIBE: `${basePrefix}yield-subscribe`,
        YIELD_SUBSCRIBE_ATTR: `${basePrefix}yield-subscribe-attr`,
        YIELD_SUBSCRIBE_CONTENT: `${basePrefix}yield-subscribe-content`,
        YIELD_SUBSCRIBE_CHILDREN: `${basePrefix}yield-subscribe-children`,
    },
    CLASSNAME: {
        BASE: basePrefix,
        VIEW_ERROR: `${basePrefix}view-error`,
        VIRTUAL_CONTAINER: `${basePrefix}virtual-container`,
        SECTION_ERROR: `${basePrefix}section-error`,
    },
    prefix: (key) => ATTR.PREFIX[key.toUpperCase()] || basePrefix + key,
    key: (key) => ATTR.KEYS[key.toUpperCase()] || basePrefix + key,
    className: (key) => ATTR.CLASSNAME[key.toUpperCase()] || basePrefix + key.toLowerCase().replace(/_/g, '-'),

}

export const FORBIDDEN_KEYS = [
    'init',
    'destroy',
    'beforeInit',
    'afterInit',
    'beforeDestroy',
    'destroyed',
    'loadServerData',
    'render',
    'prerender',
    'insertResources',
    'removeResources',
    'setMaster',
    'setApp',
    'addChild',
    'removeChild',
    'remove',
    'setParent',
    'parent',
    'master',
    'beforeCreate',
    'created',
    'beforeUpdate',
    'updated',
    'beforeMount',
    'mounted',
    'beforeUnmount',
    'unmounted',
    'renderLongSections',
    'renderSections',
    'prerenderSections',
    'data',
    'scope',
    'subscribe',
    'updateVariableItem',
    'updateVariableData',
];

export { ATTR };