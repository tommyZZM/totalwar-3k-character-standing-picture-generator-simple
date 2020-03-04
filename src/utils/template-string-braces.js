"use strict";

export default function(template, view) {
  return template.replace(/{([\#\@])?([\w_$]+)([\#\@])?}/gi, function(_, prefix = "", key, suffix = "") {
    if (view[key]) {
      return `${prefix}${view[key]}${suffix}`;
    }
    return "";
  });
};

export function templateStringDoubleBraces(template, view) {
  return template.replace(/{{([\#\@])?([\w_$]+)([\#\@])?}}/gi, function(_, prefix = "", key, suffix = "") {
    if (view[key]) {
      return `${prefix}${view[key]}${suffix}`;
    }
    return "";
  });
};

export function isTemplateStringBraces(maybeTemplate) {
  return /(([^\{]|^){([\#\@])?([\w_$]+)([\#\@])?}([^\}]|$)|{{([\#\@])?([\w_$]+)([\#\@])?}})/gi.test(maybeTemplate);
}
