'use strict';

describe('node-expat', () => {

    const chai = require('chai');
    const { expect } = chai;

    const fs = require('fs');
    const path = require('path');
    const XmlParser = require('../lib/node-expat')
    const Iconv = require('iconv').Iconv;
    const Buffer = require('buffer').Buffer;

    describe('1. single element', () => {

        it('1. simple', async () => {
            await _test('<r/>', [['startElement', 'r', {}], ['endElement', 'r']]);
        });

        it('2. single element with attribute', async () => {
            await _test("<r foo='bar'/>", [['startElement', 'r', {foo: 'bar'}], ['endElement', 'r']]);
        });

        it('3. single element with differently quoted attributes', async () => {
            await _test('<r foo=\'bar\' baz="quux" test="tset"/>', [['startElement', 'r', {foo: 'bar', baz: 'quux', test: 'tset'}], ['endElement', 'r']]);
        });

        it('4. single element with namespaces', async () => {
            await _test('<r xmlns=\'http://localhost/\' xmlns:x="http://example.com/"></r>', [['startElement', 'r', {xmlns: 'http://localhost/', 'xmlns:x': 'http://example.com/'}], ['endElement', 'r']])
        });

        it('5. single element with text content', async () => {
            await _test('<r>foo</r>', [['startElement', 'r', {}], ['text', 'foo'], ['endElement', 'r']]);
        });

        it('6. single element with text content and line break', async () => {
            await _test('<r>foo\nbar</r>', [['startElement', 'r', {}], ['text', 'foo\nbar'], ['endElement', 'r']]);
        });

        it('7. single element with CDATA content', async () => {
            await _test('<r><![CDATA[<greeting>Hello, world!</greeting>]]></r>', [['startElement', 'r', {}], ['startCdata'], ['text', '<greeting>Hello, world!</greeting>'], ['endCdata'], ['endElement', 'r']]);
        });

        it('8. single element with entity text', async () => {
            await _test('<r>foo&amp;bar</r>', [['startElement', 'r', {}], ['text', 'foo&bar'], ['endElement', 'r']]);
        });

        it('9. single element with umlaut text', async () => {
            await _test('<r>ß</r>', [['startElement', 'r', {}], ['text', 'ß'], ['endElement', 'r']]);
        });

        it('10. from buffer', async () => {
            await _test(Buffer.from('<foo>bar</foo>'), [['startElement', 'foo', {}], ['text', 'bar'], ['endElement', 'foo']]);
        });
    });

    describe('2. entity declaration', () => {

        it('1. a billion laughs', async () => {
            await _test('<!DOCTYPE b [<!ELEMENT b (#PCDATA)>' +
                '<!ENTITY l0 "ha"><!ENTITY l1 "&l0;&l0;"><!ENTITY l2 "&l1;&l1;">' +
                ']><b>&l2;</b>',
                [['entityDecl', 'l0', false, 'ha', null, null, null, null],
                    ['entityDecl', 'l1', false, '&l0;&l0;', null, null, null, null],
                    ['entityDecl', 'l2', false, '&l1;&l1;', null, null, null, null],
                    ['startElement', 'b', {}], ['text', 'hahahaha'], ['endElement', 'b']]);
        });
    });

    describe('3. processing instruction', () => {

        it('1. with parameters', async () => {
            await _test('<?i like xml?>', [['processingInstruction', 'i', 'like xml']]);
        });

        it('2. simple', async () => {
            await _test('<?dragons?>', [['processingInstruction', 'dragons', '']]);
        });

        it('3. XML declaration with encoding', async () => {
            await _test("<?xml version='1.0' encoding='UTF-8'?>", [['xmlDecl', '1.0', 'UTF-8', true]]);
        });

        it('4. XML declaration', async () => {
            await _test("<?xml version='1.0'?>", [['xmlDecl', '1.0', null, true]]);
        });
    });

    describe('4. comment', () => {

        it('1. simple', async () => {
            await _test('<!-- no comment -->', [['comment', ' no comment ']]);
        });
    });

    describe('5. unknownEncoding with single-byte map', () => {

        it('1. Windows-1252', async () => {
            const deferred = _createDeferred();
            const parser = new XmlParser();
            let encodingName = null;

            parser.addListener('unknownEncoding', function (name) {
                encodingName = name;
                const map = [];
                for (let i = 0; i < 256; i++) {
                    map[i] = i;
                }
                map[165] = 0x00A5; // ¥
                map[128] = 0x20AC; // €
                map[36] = 0x0024;  // $
                parser.setUnknownEncoding(map);
            });

            let text = '';

            parser.addListener('text', function (str) {
                text += str;
            });

            parser.addListener('error', function (err) {
                deferred.forceReject(err);
            });

            parser.addListener('close', function () {
                deferred.forceResolve();
            });

            parser.write("<?xml version='1.0' encoding='Windows-1252'?><r>");
            parser.write(Buffer.from([165, 128, 36]));
            parser.write('</r>');
            parser.end();

            await deferred;

            expect(encodingName).to.equals('Windows-1252');
            expect(text).to.equals( '¥€$');
        });
    });

    describe('6. unknownEncoding with single-byte map using iconv', () => {

        it('1. Windows-1252', async () => {
            const deferred = _createDeferred();
            const parser = new XmlParser();
            let encodingName = null;

            parser.addListener('unknownEncoding', function (name) {
                encodingName = name;
                const iconv = new Iconv(encodingName + '//TRANSLIT//IGNORE', 'UTF-8');
                const map = [];

                for (let i = 0; i < 256; i++) {
                    let d = null;
                    try {
                        d = iconv.convert(Buffer.from([i])).toString();
                    }
                    catch (e) {
                        d = '\b'
                    }
                    map[i] = d.charCodeAt(0);
                }

                parser.setUnknownEncoding(map);
            });

            let text = '';

            parser.addListener('text', function (str) {
                text += str;
            });

            parser.addListener('error', function (err) {
                deferred.forceReject(err);
            });

            parser.addListener('close', function () {
                deferred.forceResolve();
            });

            parser.write("<?xml version='1.0' encoding='Windows-1252'?><r>")
            parser.write(Buffer.from([165, 128, 36]))
            parser.write('</r>')
            parser.end();

            await deferred;

            expect(encodingName).to.equals('Windows-1252');
            expect(text).to.equals( '¥€$');
        });
    });

    describe('7. error', () => {

        it('1. tag name starting with ampersand', async () => {
            await _test('<&', [["error",{"code":"ERROR_XML_STREAM","lineNumber":1,"columnNumber":1,"byteIndex":1,"chunk":"< ----->&<----- "}]]);
        });

        it('2. tag name starting with ampersand', async () => {
            await _test('<root><item>Item 1</item><&item>Item 2</item></root>', [["startElement","root",{}],["startElement","item",{}],["text","Item 1"],["endElement","item"],["error",{"code":"ERROR_XML_STREAM","lineNumber":1,"columnNumber":26,"byteIndex":26,"chunk":" 1</item>< ----->&<----- item>Item 2</item></root>"}]]);
        });
    });

    describe('8. corner cases', () => {

        it('1. parse empty string', async () => {
            const deferred = _createDeferred();
            const parser = new XmlParser({ defaultEncoding: 'UTF-8' });

            parser.addListener('close', function () {
                deferred.forceResolve();
            });

            parser.write('');
            parser.end();

            await deferred;
        });

        it('2. Escaping of ampersands', async () => {
            await _test('<e>foo &amp; bar</e>', [['startElement', 'e', {}], ['text', 'foo & bar'], ['endElement', 'e']], null, null, true);
        });
    });

    describe('9. statistics', () => {

        it('1. line number', async () => {
            const parser = new XmlParser();
            expect(parser.getCurrentLineNumber()).to.equals(1);

            parser.write('\n')
            expect(parser.getCurrentLineNumber()).to.equals(2);

            parser.write('\n')
            expect(parser.getCurrentLineNumber()).to.equals(3);
        });

        it('2. column number', async () => {
            const parser = new XmlParser();
            expect(parser.getCurrentColumnNumber()).to.equals(0)

            parser.write(' ');
            expect(parser.getCurrentColumnNumber()).to.equals( 1);

            parser.write(' ');
            expect(parser.getCurrentColumnNumber()).to.equals( 2);

            parser.write('\n');
            expect(parser.getCurrentColumnNumber()).to.equals( 0);
        });

        it('3. byte index', async () => {
            const parser = new XmlParser();
            expect(parser.getCurrentByteIndex()).to.equals( -1);

            parser.write('');
            expect(parser.getCurrentByteIndex()).to.equals( -1);

            parser.write('\n');
            expect(parser.getCurrentByteIndex()).to.equals( 1);

            parser.write(' ');
            expect(parser.getCurrentByteIndex()).to.equals( 2);
        });
    });

    describe('10. Stream interface', () => {

        it('1. Read file and pipe', async () => {

            const deferred = _createDeferred();

            let startTags = 0;
            let endTags = 0;
            let closed = false;

            const parser = new XmlParser();

            parser.on('startElement', function (name) {
                startTags++
            });

            parser.on('endElement', function (name) {
                endTags++
            });

            parser.on('close', function () {
                closed = true;
                deferred.forceResolve();
            });

            parser.on('error', function (err) {
                deferred.forceReject(err);
            })

            const xml = fs.createReadStream(path.join(__dirname, 'mystic-library.xml'))
            xml.pipe(parser);

            await deferred;

            expect(startTags).to.equals(29890);
            expect(endTags).to.equals(29890);
            expect(closed).to.equals(true);
        });
    });

    function _test(str, eventsExpected, parser, step, autoEnd = true) {
        parser = parser || new XmlParser();
        step = step || str.length;

        const deferred = _createDeferred();
        const eventsReceived = []
        deferred.events = eventsReceived;
        deferred.test = testEvents;

        let ended = false;

        parser.addListener('startElement', function (name, attrs) {
            eventsReceived.push(['startElement', name, attrs]);
        });
        parser.addListener('endElement', function (name) {
            eventsReceived.push(['endElement', name]);
        });
        parser.addListener('text', function (s) {
            eventsReceived.push(['text', s]);
        });
        parser.addListener('processingInstruction', function (target, data) {
            eventsReceived.push(['processingInstruction', target, data]);
        });
        parser.addListener('comment', function (s) {
            eventsReceived.push(['comment', s]);
        });
        parser.addListener('xmlDecl', function (version, encoding, standalone) {
            eventsReceived.push(['xmlDecl', version, encoding, standalone]);
        });
        parser.addListener('startCdata', function () {
            eventsReceived.push(['startCdata']);
        });
        parser.addListener('endCdata', function () {
            eventsReceived.push(['endCdata']);
        });
        parser.addListener('entityDecl', function (entityName, isParameterEntity, value, base, systemId, publicId, notationName) {
            eventsReceived.push(['entityDecl', entityName, isParameterEntity, value, base, systemId, publicId, notationName]);
        });
        parser.addListener('error', function (err) {
            eventsReceived.push(['error', err]);
        });
        parser.addListener('close', function () {
            if (ended === false) {
                testEvents();
            }
        });

        function testEvents() {
            try {
                ended = true;
                const expected = JSON.stringify(eventsExpected);
                const received = JSON.stringify(_collapseTexts(eventsReceived));
                expect(expected).to.equals(received);
                deferred.forceResolve();
            }
            catch(err) {
                deferred.forceReject(err);
            }

            return deferred;
        }

        for (let l = 0; l < str.length; l += step) {
            let end = l + step;
            if (end > str.length) {
                end = str.length;
            }
            const chunk = str.slice(l, end);
            parser.write(chunk);
        }

        if (autoEnd === true) {
            parser.end();
        }

        return deferred;
    }

    /**
     * @return {Promise}
     * @private
     */
    function _createDeferred() {
        let resolve = null;
        let reject  = null;
        var promise = new Promise((_resolve, _reject) => {
            resolve = _resolve;
            reject  = _reject;
        });
        promise.forceResolve = resolve;
        promise.forceReject  = reject;
        return promise;
    }

    /**
     * @param {Number} ms
     * @return {Promise}
     * @private
     */
    function _delay(ms) {
        const deferred = _createDeferred();
        setTimeout(() => { deferred.forceResolve() }, ms);
        return deferred;
    }

    /**
     * @param evs
     * @return {[]}
     * @private
     */
    function _collapseTexts(evs) {
        let r = [];
        let t = '';
        evs.forEach(function (ev) {
            if (ev[0] === 'text') {
                t += ev[1];
            }
            else {
                if (t !== '') {
                    r.push([ 'text', t ]);
                }
                t = '';
                r.push(ev);
            }
        });
        if (t !== '') {
            r.push([ 'text', t ]);
        }
        return r;
    }
});