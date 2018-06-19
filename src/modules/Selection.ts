/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * License https://xdsoft.net/jodit/license.html
 * Copyright 2013-2018 Valeriy Chupurnov https://xdsoft.net
 */

import * as consts from '../constants';
import { INVISIBLE_SPACE, INVISIBLE_SPACE_REG_EXP_END, INVISIBLE_SPACE_REG_EXP_START } from '../constants';
import { Component } from './Component';
import { $$, dom, each, isHTML, isIE } from './Helpers';
import { Dom } from './Dom';
import { Jodit } from '../Jodit';

export type markerInfo = {
    startId: string,
    endId?: string,
    collapsed: boolean,
    startMarker: string
    endMarker?: string
}

export class Select extends Component {
    /**
     * Remove all selected content
     */
    remove() {
        const sel: Selection        = this.jodit.editorWindow.getSelection(),
              current: false | Node = this.current();

        if (current) {
            for (let i = 0; i < sel.rangeCount; i += 1) {
                sel.getRangeAt(i).deleteContents();
                sel.getRangeAt(i).collapse(true);
            }
        }

    }

    /**
     * Insert the cursor toWYSIWYG any point x, y
     *
     * @method insertAtPoint
     * @param {int} x Coordinate by horizontal
     * @param {int} y Coordinate by vertical
     * @return boolean Something went wrong
     */
    insertCursorAtPoint(x: number, y: number): boolean {
        let caret: any;
        const doc: Document = this.jodit.editorDocument;

        this.removeMarkers();

        try {
            let rng: Range | null = null;

            if ((<any>doc).caretPositionFromPoint) {
                caret = (<any>doc).caretPositionFromPoint(x, y);
                rng   = doc.createRange();
                rng.setStart(caret.offsetNode, caret.offset);
            } else if (doc.caretRangeFromPoint) {
                caret = doc.caretRangeFromPoint(x, y);
                rng   = doc.createRange();
                rng.setStart(caret.startContainer, caret.startOffset);
            }

            if (rng && typeof this.jodit.editorWindow.getSelection != 'undefined') {
                rng.collapse(true);
                const sel: Selection = this.jodit.editorWindow.getSelection();
                sel.removeAllRanges();
                sel.addRange(rng);
            } else if (typeof (<any>doc).body.createTextRange !== 'undefined') {
                const range: any = (<any>doc).body.createTextRange();
                range.moveToPoint(x, y);
                const endRange: any = range.duplicate();
                endRange.moveToPoint(x, y);
                range.setEndPoint('EndToEnd', endRange);
                range.select();
            }

            return true;
        } catch (e) {
        }

        return false;
    }

    isMarker = (elm: Node): boolean => (
      Dom.isNode(elm, this.jodit.editorWindow) && elm.nodeType === Node.ELEMENT_NODE && elm.nodeName === 'SPAN' && (<Element>elm).hasAttribute('data-' + consts.MARKER_CLASS)
    );

    /**
     * Remove all markers
     */
    removeMarkers() {
        $$('span[data-' + consts.MARKER_CLASS + ']', this.jodit.editor).forEach((marker: HTMLElement) => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker)
            }
        })
    }

    marker = (atStart = false, range?: Range): HTMLSpanElement => {
        let newRange: Range | null = null;

        if (range) {
            newRange = range.cloneRange();
            newRange.collapse(atStart);
        }

        const marker: HTMLSpanElement = this.jodit.editorDocument.createElement('span');

        marker.id               = consts.MARKER_CLASS + '_' + (+new Date()) + '_' + ('' + Math.random()).slice(2);
        marker.style.lineHeight = '0';
        marker.style.display    = 'none';
        marker.setAttribute('data-' + consts.MARKER_CLASS, (atStart ? 'start' : 'end'));
        marker.appendChild(this.jodit.editorDocument.createTextNode(consts.INVISIBLE_SPACE));

        if (newRange) {
            if (Dom.isOrContains(this.jodit.editor, atStart ? newRange.startContainer : newRange.endContainer)) {
                newRange.insertNode(marker);
            }
        }

        return marker;
    };

    /**
     * Restores user selections using marker invisible elements in the DOM.
     *
     * @param {markerInfo[]|null} selectionInfo
     */
    restore(selectionInfo: markerInfo[] | null = []) {
        if (Array.isArray(selectionInfo)) {
            const sel: Selection = this.jodit.editorWindow.getSelection();
            sel.removeAllRanges();

            selectionInfo.forEach((selection: markerInfo) => {
                const range: Range       = this.jodit.editorDocument.createRange(),
                      end: HTMLElement   = <HTMLElement>this.jodit.editor.querySelector('#' + selection.endId),
                      start: HTMLElement = <HTMLElement>this.jodit.editor.querySelector('#' + selection.startId);

                if (!start) {
                    return;
                }

                if (selection.collapsed || !end) {
                    const previousNode: Node | null = start.previousSibling;

                    if (previousNode && previousNode.nodeType === Node.TEXT_NODE) {
                        range.setStart(previousNode, previousNode.nodeValue ? previousNode.nodeValue.length : 0);
                    } else {
                        range.setStartBefore(start)
                    }

                    if (start.parentNode) {
                        start.parentNode.removeChild(start);
                    }

                    range.collapse(true);
                } else {
                    range.setStartAfter(start);
                    if (start.parentNode) {
                        start.parentNode.removeChild(start);
                    }
                    range.setEndBefore(end);
                    if (end.parentNode) {
                        end.parentNode.removeChild(end);
                    }
                }

                sel.addRange(range);
            });
        }
    }

    /**
     * Saves selections using marker invisible elements in the DOM.
     *
     * @return markerInfo[]
     */
    save(): markerInfo[] {
        const sel: Selection = this.jodit.editorWindow.getSelection();

        if (!sel.rangeCount) {
            return [];
        }


        let info: markerInfo[] = [],
            length: number     = sel.rangeCount,
            i: number,
            start: HTMLSpanElement,
            end: HTMLSpanElement,
            ranges: Range[]    = [];

        for (i = 0; i < length; i += 1) {
            ranges[i] = sel.getRangeAt(i);
            if (ranges[i].collapsed) {
                start   = this.marker(true, ranges[i]);
                info[i] = {
                    startId: start.id,
                    collapsed: true,
                    startMarker: start.outerHTML,
                };
            } else {
                start   = this.marker(true, ranges[i]);
                end     = this.marker(false, ranges[i]);
                info[i] = {
                    startId: start.id,
                    endId: end.id,
                    collapsed: false,
                    startMarker: start.outerHTML,
                    endMarker: end.outerHTML,
                };
            }
        }

        sel.removeAllRanges();
        for (i = length - 1; i >= 0; --i) {
            let start: HTMLElement | null = this.jodit.editorDocument.getElementById(info[i].startId);

            if (start) {
                if (info[i].collapsed) {
                    ranges[i].setStartAfter(start);
                    ranges[i].collapse(true);
                } else {
                    ranges[i].setStartBefore(start);
                    if (info[i].endId) {
                        let end: HTMLElement | null = this.jodit.editorDocument.getElementById(<string>info[i].endId);
                        if (end) {
                            ranges[i].setEndAfter(end);
                        }
                    }
                }
            }

            try {
                sel.addRange(ranges[i].cloneRange());
            } catch (e) {
                //console.log(e);
            }
        }

        return info;
    }

    /**
     * Set focus in editor
     */
    focus = (): boolean => {
        const jodit: Jodit = this.jodit;

        if (!this.isFocused()) {
            if (jodit.options.iframe && isIE()) {
                let start: number = 0;
                while (start < 100000 && jodit.editorDocument.readyState !== 'complete') {
                    start++;
                }
            }
            if (jodit.iframe) {
                jodit.iframe.focus();
            }

            jodit.editorWindow.focus();
            jodit.editor.focus();

            const sel: Selection = jodit.editorWindow.getSelection(),
                  range: Range   = jodit.editorDocument.createRange();

            if (!sel.rangeCount || !this.current()) {
                // let child: Node|null = jodit.editor.firstChild;
                //
                // if (!child) {
                //     child = jodit.editorDocument.createTextNode(consts.INVISIBLE_SPACE);
                //     jodit.editor.appendChild(child);
                // }

                range.setStart(jodit.editor, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            return true;
        }

        return false;
    };

    /**
     * Checks whether the current selection is something or just set the cursor is
     *
     * @return boolean true Selection does't have content
     */
    isCollapsed(): boolean {
        let sel = this.jodit.editorWindow.getSelection(), r;
        for (r = 0; r < sel.rangeCount; r += 1) {
            if (!sel.getRangeAt(r).collapsed) {
                return false;
            }
        }
        return true;
    }

    /**
     * Checks whether the editor currently in focus
     *
     * @return boolean
     */
    isFocused(): boolean {
        return (this.jodit.editorDocument.hasFocus && this.jodit.editorDocument.hasFocus()) && this.jodit.editor === this.jodit.editorDocument.activeElement;
    }

    /**
     * Returns the current element under the cursor inside editor
     *
     * @return false|Node The element under the cursor or false if undefined or not in editor
     */
    current(checkChild: boolean = true): false | Node {
        if (this.jodit.getRealMode() === consts.MODE_WYSIWYG && this.jodit.editorWindow.getSelection !== undefined) {
            const sel: Selection = this.jodit.editorWindow.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range: Range       = sel.getRangeAt(0);
                let node: Node | null    = range.startContainer,
                      rightMode: boolean = false,
                      child              = (node: Node): Node | null => rightMode ? node.lastChild : node.firstChild;

                if (node.nodeType !== Node.TEXT_NODE) {
                    node = range.startContainer.childNodes[range.startOffset];
                    if (!node) {
                        node      = range.startContainer.childNodes[range.startOffset - 1];
                        rightMode = true;
                    }
                    if (node && sel.isCollapsed && node.nodeType !== Node.TEXT_NODE) {
                        // test Current method - Cursor in the left of some SPAN
                        if (!rightMode && node.previousSibling && node.previousSibling.nodeType === Node.TEXT_NODE) {
                            node = node.previousSibling;
                        } else if (checkChild) {
                            let current: Node | null = child(node);
                            while (current) {
                                if (current && current.nodeType === Node.TEXT_NODE) {
                                    node = current;
                                    break;
                                }
                                current = child(current);
                            }
                        }
                    }
                }

                // check - cursor inside editor
                if (node && Dom.isOrContains(this.jodit.editor, node)) {
                    return node;
                }
            }
        }

        return false;
    }

    /**
     * Insert element in editor
     *
     * @param {Node} node
     * @param {Boolean} [insertCursorAfter=true] After insert, cursor will move after element
     * @param {Boolean} [fireChange=true] After insert, editor fire change event. You can prevent this behavior
     */
    insertNode(node: Node, insertCursorAfter = true, fireChange: boolean = true) {
        if (!(node instanceof (<any>this.jodit.editorWindow).Node)) {
            throw new Error('Parameter node most be instance of Node');
        }

        this.focus();

        if (this.jodit.editorWindow.getSelection) {
            const sel: Selection = this.jodit.editorWindow.getSelection();

            if (!this.isCollapsed()) {
                this.jodit.execCommand('Delete');
            }

            if (sel.rangeCount) {
                const range: Range = sel.getRangeAt(0);
                if (Dom.isOrContains(this.jodit.editor, range.commonAncestorContainer)) {
                    range.deleteContents();
                    range.insertNode(node);
                } else {
                    this.jodit.editor.appendChild(node);
                }
            } else {
                this.jodit.editor.appendChild(node)
            }

            if (insertCursorAfter) {
                this.setCursorAfter(node);
            }
        } else {
            throw new Error('Jodit does\'n support this browser')
        }

        if (fireChange && this.jodit.events) {
            this.jodit.events.fire('synchro');
        }

        if (this.jodit.events) {
            this.jodit.events.fire('afterInsertNode', node);
        }
    }

    replaceAll(str: string, find: string, replace: string) {
        return str.replace(new RegExp(find, 'g'), replace);
    }


    /**
     * Inserts in the current cursor position some HTML snippet
     *
     * @param  {string} html HTML The text toWYSIWYG be inserted into the document
     * @example
     * ```javascript
     * parent.selection.insertHTML('<img src="image.png"/>');
     * ```
     */
    insertHTML(html: number | string | Node) {
        if (html === '') {
            return;
        }

        if (typeof html === 'string' && !isHTML(html)) {
            html = this.replaceAll(html, '\n', '<br>');
        }

        const node: HTMLDivElement       = this.jodit.editorDocument.createElement('div'),
              fragment: DocumentFragment = this.jodit.editorDocument.createDocumentFragment();

        let
          lastChild: Node | null,
          lastEditorElement: Node | null;


        if (!this.isFocused() && this.jodit.isEditorMode()) {
            this.focus();
        }

        if (!(html instanceof (<any>this.jodit.editorWindow).Node)) {
            node.innerHTML = html.toString();
        } else if (Dom.isNode(html, this.jodit.editorWindow)) {
            node.appendChild(<Node>html);
        }

        if (!this.jodit.isEditorMode() && this.jodit.events.fire('insertHTML', node.innerHTML) === false) {
            return;
        }

        lastChild = node.lastChild;

        while (node.firstChild) {
            lastChild = node.firstChild;
            fragment.appendChild(node.firstChild);
        }

        this.insertNode(fragment, false);

        if (lastChild) {
            this.setCursorAfter(lastChild);
        } else {
            this.setCursorIn(fragment);
        }

        lastEditorElement = this.jodit.editor.lastChild;
        while (lastEditorElement && lastEditorElement.nodeType === Node.TEXT_NODE && lastEditorElement.previousSibling && lastEditorElement.nodeValue && (/^\s*$/).test(lastEditorElement.nodeValue)) {
            lastEditorElement = lastEditorElement.previousSibling;
        }

        if (lastChild) {
            if (lastEditorElement && lastChild === lastEditorElement && lastChild.nodeType === Node.ELEMENT_NODE) {
                this.jodit.editor.appendChild(this.jodit.editorDocument.createElement('br'));
            }
            this.setCursorAfter(lastChild);
        }
    }

    /**
     * Insert image in editor
     *
     * @param  {string|HTMLImageElement} url URL for image, or HTMLImageElement
     * @param  {string} [styles] If specified, it will be applied <code>$(image).css(styles)</code>
     *
     * @fired afterInsertImage
     */
    insertImage(url: string | HTMLImageElement, styles: { [key: string]: string } = {}) {

        const image: HTMLImageElement = typeof url === 'string' ? <HTMLImageElement>dom('<img src=""/>', this.jodit.editorDocument) : <HTMLImageElement>dom(url, this.jodit.editorDocument);

        if (typeof url === 'string') {
            image.setAttribute('src', url);
        }

        let dw: string = this.jodit.options.imageDefaultWidth.toString();
        if (dw && 'auto' !== dw && (String(dw)).indexOf('px') < 0 && (String(dw)).indexOf('%') < 0) {
            dw += 'px';
        }

        styles.width = dw;

        if (styles && typeof styles === 'object') {
            each(styles, (value: string, key: string) => {
                (<any>image.style)[key] = value;
            });
        }


        const onload = () => {
            if (image.naturalHeight < image.offsetHeight || image.naturalWidth < image.offsetWidth) {
                image.style.width  = '';
                image.style.height = '';
            }
            image.removeEventListener('load', onload)
        };

        image.addEventListener('load', onload);

        if (image.complete) {
            onload();
        }

        this.insertNode(image);

        /**
         * Triggered after image was inserted {@link Selection~insertImage|insertImage}. This method can executed from {@link FileBrowser|FileBrowser} or {@link Uploader|Uploader}
         * @event afterInsertImage
         * @param {HTMLImageElement} image
         * @example
         * ```javascript
         * var editor = new Jodit("#redactor");
         * editor.events.on('afterInsertImage', function (image) {
         *     image.className = 'bloghead4';
         * });
         * ```
         */
        this.jodit.events.fire('afterInsertImage', image);
    }

    eachSelection = (callback: (current: Node) => void) => {
        const sel: Selection = this.jodit.editorWindow.getSelection();
        if (sel.rangeCount) {
            const range: Range  = sel.getRangeAt(0);
            const nodes: Node[] = [],
                  start: Node   = range.startContainer === this.jodit.editor ? this.jodit.editor.childNodes[range.startOffset] : range.startContainer,
                  end: Node     = range.endContainer === this.jodit.editor ? this.jodit.editor.childNodes[range.endOffset - 1] : range.endContainer;

            Dom.find(start, (node: Node | null) => {
                if (node && node !== this.jodit.editor && !Dom.isEmptyTextNode(node) && !this.isMarker(<HTMLElement>node)) {
                    nodes.push(node);
                }

                return node === end;
            }, this.jodit.editor, true, 'nextSibling', false);

            let forEvery = (current: Node) => {
                if (current.nodeName.match(/^(UL|OL)$/)) {
                    return [].slice.call(current.childNodes).forEach(forEvery);
                }

                if (current.nodeName === 'LI') {
                    if (current.firstChild) {
                        current = current.firstChild;
                    } else {
                        let currentB: Node = this.jodit.editorDocument.createTextNode(INVISIBLE_SPACE);
                        current.appendChild(currentB);
                        current = currentB;
                    }
                }

                callback(current);
            };

            if (nodes.length === 0 && Dom.isEmptyTextNode(start)) {
                nodes.push(start);
            }

            nodes.forEach(forEvery)
        }
    };

    /**
     * Set cursor after the node
     *
     * @param {Node} node
     * @return {Node} fake invisible textnode. After insert it can be removed
     */
    setCursorAfter(node: Node | HTMLElement | HTMLTableElement | HTMLTableCellElement): Text | false {
        if (!(node instanceof (<any>this.jodit.editorWindow).Node)) {
            throw new Error('Parameter node most be instance of Node');
        }

        if (!Dom.up(node, (elm: Node | null) => (elm === this.jodit.editor || (elm && elm.parentNode === this.jodit.editor)), this.jodit.editor)) {
            throw new Error('Node element must be in editor');
        }

        const range: Range         = this.jodit.editorDocument.createRange();
        let fakeNode: Text | false = false;


        if (node.nodeType !== Node.TEXT_NODE) {
            fakeNode = this.jodit.editorDocument.createTextNode(consts.INVISIBLE_SPACE);
            range.setStartAfter(node);
            range.insertNode(fakeNode);
            range.selectNode(fakeNode);
        } else {
            range.setEnd(node, node.nodeValue !== null ? node.nodeValue.length : 0);
        }

        range.collapse(false);

        this.selectRange(range);

        return fakeNode;
    }

    /**
     * Checks if the cursor is at the end(start) block
     *
     * @param  {boolean} start=false true - check whether the cursor is at the start block
     * @param {HTMLElement} parentBlock - Find in this
     *
     * @return {boolean | null} true - the cursor is at the end(start) block, null - cursor somewhere outside
     */
    cursorInTheEdge(start: boolean, parentBlock: HTMLElement): boolean | null {
        const sel: Selection    = this.jodit.editorWindow.getSelection();
        let range: Range | null = sel.rangeCount ? sel.getRangeAt(0) : null;

        if (!range) {
            return null;
        }

        const container     = start ? range.startContainer : range.endContainer,
              sibling       = (node: Node): Node | false => {
                  return start ? Dom.prev(node, elm => !!elm, parentBlock) : Dom.next(node, elm => !!elm, parentBlock);
              },
              checkSiblings = (next: Node | false): false | void => {
                  while (next) {
                      next = sibling(next);
                      if (next && !Dom.isEmptyTextNode(next) && next.nodeName !== 'BR') {
                          return false;
                      }
                  }
              };

        if (container.nodeType === Node.TEXT_NODE) {
            const value: string = container.nodeValue || '';
            if (start && range.startOffset > value.length - value.replace(INVISIBLE_SPACE_REG_EXP_START, '').length) {
                return false;
            }
            if (!start && range.startOffset < value.replace(INVISIBLE_SPACE_REG_EXP_END, '').length) {
                return false;
            }

            if (checkSiblings(container) === false) {
                return false;
            }
        }

        const current: Node | false = this.current(false);
        if (!current || !Dom.isOrContains(parentBlock, current, true)) {
            return null;
        }

        if (!start && range.startContainer.childNodes[range.startOffset]) {
            if (current && !Dom.isEmptyTextNode(current)) {
                return false;
            }
        }

        return checkSiblings(current) !== false;
    }

    /**
     * Set cursor before the node
     *
     * @param {Node} node
     * @return {Text} fake invisible textnode. After insert it can be removed
     */
    setCursorBefore(node: Node | HTMLElement | HTMLTableElement | HTMLTableCellElement): Text | false {
        if (!(node instanceof (<any>this.jodit.editorWindow).Node)) {
            throw new Error('Parameter node most be instance of Node');
        }

        if (!Dom.up(node, (elm: Node | null) => (elm === this.jodit.editor || (elm && elm.parentNode === this.jodit.editor)), this.jodit.editor)) {
            throw new Error('Node element must be in editor');
        }

        const range: Range         = this.jodit.editorDocument.createRange();
        let fakeNode: Text | false = false;

        if (node.nodeType !== Node.TEXT_NODE) {
            fakeNode = this.jodit.editorDocument.createTextNode(consts.INVISIBLE_SPACE);
            range.setStartBefore(node);
            range.collapse(true);
            range.insertNode(fakeNode);
            range.selectNode(fakeNode);
        } else {
            range.setStart(node, node.nodeValue !== null ? node.nodeValue.length : 0);
        }

        range.collapse(true);
        this.selectRange(range);

        return fakeNode;
    }

    /**
     * Set cursor in the node
     *
     * @param {Node} node
     * @param {boolean} [inStart=false] set cursor in start of element
     */
    setCursorIn(node: Node, inStart: boolean = false) {
        if (!(node instanceof (<any>this.jodit.editorWindow).Node)) {
            throw new Error('Parameter node most be instance of Node');
        }
        if (!Dom.up(node, (elm: Node | null) => (elm === this.jodit.editor || (elm && elm.parentNode === this.jodit.editor)), this.jodit.editor)) {
            throw new Error('Node element must be in editor');
        }

        const range: Range = this.jodit.editorDocument.createRange();

        let start: Node | null = node,
            last: Node         = node;

        do {
            if (start.nodeType === Node.TEXT_NODE) {
                break;
            }
            last  = start;
            start = inStart ? start.firstChild : start.lastChild
        } while (start);

        if (!start) {
            const fakeNode: Text = this.jodit.editorDocument.createTextNode(consts.INVISIBLE_SPACE);
            if (!/^(img|br|input)$/i.test(last.nodeName)) {
                last.appendChild(fakeNode);
                last = fakeNode;
            } else {
                start = last;
            }
        }

        range.selectNodeContents(start || last);
        range.collapse(inStart);

        this.selectRange(range);

        return last;
    }

    /**
     * Set range selection
     *
     * @param range
     * @fires changeSelection
     */
    selectRange(range: Range) {
        const sel: Selection = this.jodit.editorWindow.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        /**
         * Fired after change selection
         *
         * @event changeSelection
         */
        this.jodit.events.fire('changeSelection');
    }

    /**
     * Select node
     *
     * @param {Node} node
     * @param {boolean} [inward=false] select all inside
     */
    select(node: Node | HTMLElement | HTMLTableElement | HTMLTableCellElement, inward = false) {
        if (!(node instanceof (<any>this.jodit.editorWindow).Node)) {
            throw new Error('Parameter node most be instance of Node');
        }
        if (!Dom.up(node, (elm: Node | null) => (elm === this.jodit.editor || (elm && elm.parentNode === this.jodit.editor)), this.jodit.editor)) {
            throw new Error('Node element must be in editor');
        }

        const range: Range = this.jodit.editorDocument.createRange();

        range[inward ? 'selectNodeContents' : 'selectNode'](node);

        this.selectRange(range);
    }

    getHTML(): string {
        const selection: Selection = this.jodit.editorWindow.getSelection();

        if (selection.rangeCount > 0) {
            const range: Range                      = selection.getRangeAt(0);
            const clonedSelection: DocumentFragment = range.cloneContents();
            const div: HTMLElement                  = this.jodit.editorDocument.createElement('div');
            div.appendChild(clonedSelection);
            return div.innerHTML;
        }

        return '';
    }

    /**
     * Apply some css rules for all selections. It method wraps selections in nodeName tag.
     *
     * @param {object} cssRules
     * @param nodeName
     * @param options
     */
    applyCSS = (cssRules?: any, nodeName: string = 'span', options?: any) => {
        console.log(cssRules);
        if (cssRules['font-weight'] === 'bold') {
            document.execCommand('bold', false, '');
            return;
        }
        if (cssRules['text-decoration'] === 'line-through') {
            document.execCommand('strikeThrough', false, '');
            return;
        }
        if (cssRules['text-decoration'] === 'underline') {
            document.execCommand('underline', false, '');
            return;
        }
        if (cssRules['font-style'] === 'italic') {
            document.execCommand('italic', false, '');
            return;
        }
        if (cssRules['color']) {
            document.execCommand('foreColor', false, cssRules['color']);
        }
        if (cssRules['backgroundColor']) {
            document.execCommand('BackColor', false, cssRules['backgroundColor']);
        }
        this.save();
        if (cssRules['fontSize']) {
            setSize(cssRules['fontSize']);
        }
        this.removeMarkers();
    };
}

function setSize(size: string) {
    let selectionNode = getSelectionNode();

    selectionNode.forEach(element => {
        element.style.fontSize = size;
    });
}

function convert(elementsByTagName: NodeListOf<Element>): HTMLElement[] {
    const allSelected = [];
    for (let i = 0; elementsByTagName.length > i; i++) {
        let element = elementsByTagName[i];
        allSelected.push(element as HTMLElement)
    }
    return allSelected;
}

function getAllWithinRangeParent(): HTMLElement[] {
    const selection = window.getSelection();
    const range     = selection.getRangeAt(0);
    /*this.jodit.selection.save();*/

    const wysiwyg = document.querySelector('.jodit_wysiwyg');
    const selectElement: HTMLElement[] = [];
    if(wysiwyg){
        let children  = convert(wysiwyg.children);
        let isStart;
        children.forEach((element: HTMLElement) => {
            let elementsByTagName = convert(element.getElementsByTagName('*'));
            isStart               = elementsByTagName.some(el => isMarker(el, true));
            if(isStart){
                selectElement.push(element);
            }
            isStart = elementsByTagName.some(el => isMarker(el, false));
        })
    }
    console.log('Result = ',selectElement);
    return selectElement;
}

function isMarker(element: HTMLElement, isStart: boolean): boolean {
    const markerName = isStart ? 'star' : 'end';
    let joditSelectionMarker = element.dataset.jodit_selection_marker;
    if(joditSelectionMarker){
        return joditSelectionMarker === markerName
    }
    return false;
}

export function getSelectionNode(): HTMLElement[] {
    return getAllWithinRangeParent();
}

(window as any).getAllWithinRangeParent = getAllWithinRangeParent;