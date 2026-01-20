/**
 * seo-config Module
 * ES6 Module for Blade Compiler
 */

export const ViewState = function (view) {
    const viewRef = view;
    const states = [];
    let stateIndex = 0;
    const stateMap = [];
    
}
export const SEOTagConfig = {
    "meta:title": [
        {
            tag: "title",
            selector: "title",
            attribute: "@content",
            attrs: {}
        },
        {
            tag: "meta",
            selector: "meta[name='title']",
            attribute: "content",
            attrs: {
                "name": "title"
            }

        }
    ],
    "meta:description": [
        {
            tag: "meta",
            selector: "meta[name='description']",
            attribute: "content",
            attrs: {
                "name": "description"
            }
        }
    ],
    "meta:keywords": [
        {
            tag: "meta",
            selector: "meta[name='keywords']",
            attribute: "content",
            attrs: {
                "name": "keywords"
            }
        }
    ],
    "link:meta:canonical": [
        {
            tag: "link",
            selector: "link[rel='canonical']",
            attribute: "href",
            attrs: {
                "rel": "canonical"
            }
        }
    ],
    "meta:robots": [
        {
            tag: "meta",
            selector: "meta[name='robots']",
            attribute: "content",
            attrs: {
                "name": "robots"
            }
        }
    ],
    "meta:author": [
        {
            tag: "meta",
            selector: "meta[name='author']",
            attribute: "content",
            attrs: {
                "name": "author"
            }
        }
    ],
    "meta:image": [
        {
            tag: "meta",
            selector: "meta[name='image']",
            attribute: "content",
            attrs: {
                "name": "image"
            }
        }
    ],
    "meta:og:image": [
        {
            tag: "meta",
            selector: "meta[property='og:image']",
            attribute: "content",
            attrs: {
                "property": "og:image"
            }
        }
    ],
    "meta:og:title": [
        {
            tag: "meta",
            selector: "meta[property='og:title']",
            attribute: "content",
            attrs: {
                "property": "og:title"
            }
        }
    ],
    "meta:og:description": [
        {
            tag: "meta",
            selector: "meta[property='og:description']",
            attribute: "content",
            attrs: {
                "property": "og:description"
            }
        }
    ],
    "meta:og:type": [
        {
            tag: "meta",
            selector: "meta[property='og:type']",
            attribute: "content",
            attrs: {
                "property": "og:type"
            }
        }
    ],
    "meta:og:url": [
        {
            tag: "meta",
            selector: "meta[property='og:url']",
            attribute: "content",
            attrs: {
                "property": "og:url"
            }
        }
    ],
    "meta:og:site_name": [
        {
            tag: "meta",
            selector: "meta[property='og:site_name']",
            attribute: "content",
            attrs: {
                "property": "og:site_name"
            }
        }
    ],
    "meta:og:locale": [
        {
            tag: "meta",
            selector: "meta[property='og:locale']",
            attribute: "content",
            attrs: {
                "property": "og:locale"
            }
        }
    ],
    "meta:article:published_time": [
        {
            tag: "meta",
            selector: "meta[property='article:published_time']",
            attribute: "content",
            attrs: {
                "property": "article:published_time"
            }
        }
    ],
    "meta:article:modified_time": [
        {
            tag: "meta",
            selector: "meta[property='article:modified_time']",
            attribute: "content",
            attrs: {
                "property": "article:modified_time"
            }
        }
    ],
    "meta:article:section": [
        {
            tag: "meta",
            selector: "meta[property='article:section']",
            attribute: "content",
            attrs: {
                "property": "article:section"
            }
        }
    ],
    "meta:article:tag": [
        {
            tag: "meta",
            selector: "meta[property='article:tag']",
            attribute: "content",
            attrs: {
                "property": "article:tag"
            }
        }
    ],
    "meta:article:author": [
        {
            tag: "meta",
            selector: "meta[property='article:author']",
            attribute: "content",
            attrs: {
                "property": "article:author"
            }
        }
    ],
    "meta:article:publisher": [
        {
            tag: "meta",
            selector: "meta[property='article:publisher']",
            attribute: "content",
            attrs: {
                "property": "article:publisher"
            }
        }
    ],
    "meta:article:image": [
        {
            tag: "meta",
            selector: "meta[property='article:image']",
            attribute: "content",
            attrs: {
                "property": "article:image"
            }
        }
    ],
    "meta:og:image:width": [
        {
            tag: "meta",
            selector: "meta[property='og:image:width']",
            attribute: "content",
            attrs: {
                "property": "og:image:width"
            }
        }
    ],
    "meta:og:image:height": [
        {
            tag: "meta",
            selector: "meta[property='og:image:height']",
            attribute: "content",
            attrs: {
                "property": "og:image:height"
            }
        }
    ],
    "meta:twitter:card": [
        {
            tag: "meta",
            selector: "meta[name='twitter:card']",
            attribute: "content",
            attrs: {
                "name": "twitter:card"
            }
        }
    ],
    "meta:twitter:label1": [
        {
            tag: "meta",
            selector: "meta[name='twitter:label1']",
            attribute: "content",
            attrs: {
                "name": "twitter:label1"
            }
        }
    ],
    "meta:twitter:label2": [
        {
            tag: "meta",
            selector: "meta[name='twitter:label2']",
            attribute: "content",
            attrs: {
                "name": "twitter:label2"
            }
        }
    ],
    "twitter:data1": [
        {
            tag: "meta",
            selector: "meta[name='twitter:data1']",
            attribute: "content",
            attrs: {
                "name": "twitter:data1"
            }
        }
    ],
    "twitter:data2": [
        {
            tag: "meta",
            selector: "meta[name='twitter:data2']",
            attribute: "content",
            attrs: {
                "name": "twitter:data2"
            }
        }
    ],
    "link:rel:shortlink": [
        {
            tag: "meta",
            selector: "meta[name='rel:shortlink']",
            attribute: "content",
            attrs: {
                "rel": "shortlink"
            }
        }
    ],
    "link:rel:alternate": [
        {
            tag: "meta",
            selector: "meta[name='rel:alternate']",
            attribute: "content",
            attrs: {
                "rel": "alternate"
            }
        }
    ]
};