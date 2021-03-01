'use strict'

const expat = require('bindings')('node_expat');
const { Writable } = require('stream');

class XmlStream extends Writable {

    static ErrorCode = {
        ERROR_XML_STREAM: 'ERROR_XML_STREAM'
    };

    static Event = {
        START_ELEMENT: 'startElement',
        END_ELEMENT: 'endElement',
        TEXT: 'text',
        PROCESSING_INSTRUCTION: 'processingInstruction',
        COMMENT: 'comment',
        XML_DECLARATION: 'xmlDecl',
        START_CDATA: 'startCdata',
        END_CDATA: 'endCdata',
        ENTITY_DECLARATION: 'entityDecl',
        UNKNOWN_ENCODING: 'unknownEncoding'
    };

    /**
     * @param {Object} [options]
     * @param {Number} [options.highWaterMark = 16384]
     * @param {Boolean} [options.emitClose = true]
     * @param {Boolean} [options.autoDestroy = true]
     * @param {BufferEncoding} [options.defaultEncoding = null]
     */
    constructor(options = {}) {
        const { highWaterMark = 16384, emitClose = true, autoDestroy = true, defaultEncoding = null } = options;

        super({
            highWaterMark,
            decodeStrings: true,
            objectMode: false,
            emitClose,
            autoDestroy
        });

        this._encoding = defaultEncoding;
        this._parser = this._createParser();
    }

    /**
     * @return {expat.Parser}
     * @private
     */
    _createParser() {
        const parser = new expat.Parser(this._encoding);
        parser.emit = this.emit.bind(this);
        return parser;
    }

    /**
     * @param {Buffer|String} chunk
     * @param {BufferEncoding} encoding
     * @param {Function} callback
     * @private
     */
    _write(chunk, encoding, callback) {
        try {
            this._parse(chunk, false);
            callback();
        }
        catch (err) {
            callback(err);
        }
    }

    /**
     * @param {Function} callback
     * @private
     */
    _final(callback) {
        try {
            this._parse('', true);
            callback();
        }
        catch (err) {
            callback(err);
        }
    }

    /**
     * @param {Buffer|String} buf
     * @param {Boolean=} isFinal
     * @return {Boolean}
     * @private
     */
    _parse(buf, isFinal = false) {
        if (this.destroyed === true) {
            return false;
        }

        const result = this._parser.parse(buf, isFinal);

        if (result === true) {
            return result;
        }

        throw this.getError();
    }

    /**
     * @param {BufferEncoding} encoding
     * @return {Boolean}
     */
    setEncoding(encoding) {
        if (this.destroyed === true) {
            return false;
        }
        this._encoding = encoding;
        return this._parser.setEncoding(encoding);
    }

    /**
     * @param {Number[]} map
     * @return {Boolean}
     */
    setUnknownEncoding(map) {
        if (this.destroyed === true) {
            return false;
        }
        return this._parser.setUnknownEncoding(map);
    }

    /**
     * @return {Error|null}
     */
    getError() {
        const message = this.getErrorMessage();

        if (message == null) {
            return null;
        }

        const err = new Error(message);
        err.code = XmlStream.ErrorCode.ERROR_XML_STREAM;
        err.lineNumber = this.getCurrentLineNumber();
        err.columnNumber = this.getCurrentColumnNumber();
        err.byteIndex = this.getCurrentByteIndex();
        return err;
    }

    /**
     * @return {String|null}
     */
    getErrorMessage() {
        return this._parser.getError();
    }

    /**
     * @return {Number}
     */
    getCurrentLineNumber() {
        return this._parser.getCurrentLineNumber();
    }

    /**
     * @return {Number}
     */
    getCurrentColumnNumber() {
        return this._parser.getCurrentColumnNumber();
    }

    /**
     * @return {Number}
     */
    getCurrentByteIndex() {
        return this._parser.getCurrentByteIndex();
    }

    /**
     * @return {{lineNumber: Number, columnNumber: Number, byteIndex: Number}}
     */
    getCurrentState() {
        const lineNumber = this.getCurrentLineNumber();
        const columnNumber = this.getCurrentColumnNumber();
        const byteIndex = this.getCurrentByteIndex();

        return {
            lineNumber,
            columnNumber,
            byteIndex
        };
    }
}

module.exports = XmlStream;
