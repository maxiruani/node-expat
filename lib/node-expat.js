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
            this.parse(chunk, false);
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
            this.parse('', true);
            callback();
        }
        catch (err) {
            callback(err);
        }
    }

    /**
     * @param {Error=} error
     * @param {Function} callback
     * @private
     */
    _destroy(error, callback) {
        this.pause();
        callback(error);
    }

    /**
     * @param {Buffer|String} buf
     * @param {Boolean=} isFinal
     * @return {Boolean}
     */
    parse(buf, isFinal = false) {
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
     * @return {Boolean}
     */
    resume() {
        if (this.destroyed === true) {
            return false;
        }
        return this._parser.resume();
    }

    /**
     * @return {Boolean}
     */
    pause() {
        if (this.destroyed === true) {
            return false;
        }
        return this._parser.stop();
    }

    /**
     * @return {Boolean}
     */
    reset() {
        if (this.destroyed === true) {
            return false;
        }
        return this._parser.reset();
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
        err.state = this.getCurrentState();
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
     * @return {{line: Number, column: Number, byteIndex: Number}}
     */
    getCurrentState() {
        const line = this.getCurrentLineNumber();
        const column = this.getCurrentColumnNumber();
        const byteIndex = this.getCurrentByteIndex();

        return {
            line,
            column,
            byteIndex
        };
    }
}

module.exports = XmlStream;
