"use strict";
module.exports = function (api) {
    api.cache.never();
    return {
        "presets": [
            "@babel/env",
            "@babel/react"
        ],
        "plugins": [
            ["@babel/plugin-proposal-decorators", { "decoratorsBeforeExport": false }],
            ["@babel/plugin-proposal-class-properties", { "loose": false }],
            "@babel/plugin-proposal-optional-chaining",
            "@babel/plugin-transform-modules-commonjs"
        ],
    };
};
