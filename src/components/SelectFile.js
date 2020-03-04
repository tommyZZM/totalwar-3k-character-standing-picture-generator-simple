/* Created by tommyZZM.OSX on 2019/2/11. */
import mime from 'mime-types';
import * as R from 'ramda';
import React from 'react';
import wildcard from 'wildcard';
import RcUpload from 'rc-upload';

// eslint-disable-next-line no-useless-escape
const REGEXP_MIME_PART_SPLIT = /[\/\+\.]/;

function isMimeMatch(target, pattern) {
    const result = wildcard(pattern, target, REGEXP_MIME_PART_SPLIT);
    // ensure that we have a valid mime type (should have two parts)
    return result && result.length >= 2;
}

function _readAsX(method, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader[method](file);
        reader.onerror = function(error) {
            reject(error);
        };
        reader.onload = function() {
            resolve(reader.result);
        };
    });
}

let VirtualFilesIndex = 0;

export class VirtualFile {
    constructor(file) {
        const now = +(new Date());

        Object.defineProperty(this, '_file', {
            enumerable: false,
            configurable: false,
            readonly: true,
            value: file
        });

        Object.defineProperty(this, '_uid', {
            enumerable: false,
            configurable: false,
            readonly: true,
            // eslint-disable-next-line
            value: `${now}-${++VirtualFilesIndex}`
        });

        this._mimeType = mime.lookup(file.name);
    }
    get file() {
        return this._file;
    }
    get path() {
        return this._file.path || this._file.name;
    }
    get type() {
        return this._mimeType;
    }
    readAsText = () => _readAsX('readAsText', this._file);
    readAsArrayBuffer = () => _readAsX('readAsArrayBuffer', this._file);
    readAsBinaryString = () => _readAsX('readAsBinaryString', this._file);
    readAsDataUrl = () => _readAsX('readAsDataURL', this._file);
}

export function virtualFileFromDataUrl(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mimeOfDataUrl = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);

    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    // eslint-disable-next-line
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new VirtualFile(new File([u8arr], filename, { type: mimeOfDataUrl }));
}

export default class SelectFile extends React.Component {
    render() {
        const {
            value = '',
            onSelectFiles = _ => null,
            onSelectFilesWithError = _ => null,
            className = '',
            accept = '*',
            style = {},
            multiple = false,
            disabled = false,
            onChange = _ => null,
            children = null,
            renderTrigger = _ => children,
        } = this.props;

        const withRcUpload = children => <RcUpload
            disabled={disabled}
            accept={accept}
            multiple={multiple}
            showUploadList={false}
            customRequest={_ => null}
            beforeUpload={async (_, files) => {
                const virtualFiles = files.map(f => new VirtualFile(f));

                const acceptMimeTypesArray = accept.split(',');

                const virtualFilesInvalidType = virtualFiles.filter(vfile => {
                    return acceptMimeTypesArray.every(type => !isMimeMatch(vfile.type, type));
                });

                if (R.isEmpty(virtualFilesInvalidType)) {
                    await onSelectFiles({
                        files: virtualFiles.map(({ _file }) => _file),
                        virtualFiles,
                        onChange
                    });
                } else {
                    await onSelectFilesWithError({
                        virtualFilesInvalidType,
                        onChange
                    });
                }
                return false;
            }}>
            { children }
        </RcUpload>;

        return <span
            className={className}
            style={style}>
            {withRcUpload(renderTrigger({ accept, value, multiple, disabled }))}
        </span>
    }
}
