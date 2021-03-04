'use strict'

const expat = require('bindings')('node_expat');
const { Writable } = require('stream');

class XmlStream extends Writable {

    static ErrorCode = {
        ERROR_XML_STREAM: 'ERROR_XML_STREAM'
    };

    static EventName = {
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
        this._byteIndex = 0;
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
     * @param {Buffer|String} chunk
     * @param {Boolean=} isFinal
     * @return {Boolean}
     * @private
     */
    _parse(chunk, isFinal = false) {
        if (this.destroyed === true) {
            return false;
        }

        const result = this._parser.parse(chunk, isFinal);

        if (result === true) {
            this._byteIndex += chunk.length;
            return result;
        }

        throw this.getError(chunk);
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
     * @param {Buffer|String} chunk
     * @return {Error|null}
     */
    getError(chunk) {
        const message = this.getErrorMessage();

        if (message == null) {
            return null;
        }

        const err = new Error(message);
        err.code = XmlStream.ErrorCode.ERROR_XML_STREAM;
        err.lineNumber = this.getCurrentLineNumber();
        err.columnNumber = this.getCurrentColumnNumber();
        err.byteIndex = this.getCurrentByteIndex();

        if (err.byteIndex != null) {
            const chunkStr = chunk.toString();
            const chunkIndex = err.byteIndex - this._byteIndex;
            err.chunk = chunkStr.substring(chunkIndex, chunkIndex - 10) + ' --->' + chunkStr.substr(chunkIndex, 1) + '<--- ' + chunkStr.substr(chunkIndex + 1, 100);
        }

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
}

module.exports = XmlStream;
