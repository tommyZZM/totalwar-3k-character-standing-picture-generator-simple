"use strict";
module.exports = function (api) {
    api.cache.never();
    return {
        "presets": [
            "@babel/env",
            "@babel/react"
        ],
        "plugins": [
            ["@babel/plugin-proposal-decorators", { "legacy": true }],
            ["@babel/plugin-proposal-class-properties", { "loose": true }],
            "@babel/plugin-proposal-optional-chaining",
            "@babel/plugin-transform-modules-commonjs"
        ],
    };
};
