/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * License https://xdsoft.net/jodit/license.html
 * Copyright 2013-2018 Valeriy Chupurnov https://xdsoft.net
 */

/**
 * Module for working with tables . Delete, insert , merger, division of cells , rows and columns. When creating elements such as <table> for each of them
 * creates a new instance Jodit.modules.tableProcessor and it can be accessed via $('table').data('table-processor')
 *
 * @module Table
 * @param {Object} parent Jodit main object
 * @param {HTMLTableElement} table Table for which to create a module
 */

import {$$, each, trim} from './Helpers'
import * as consts from '../constants';
import {Dom} from "./Dom";

export class Table {
    static addSelected(td: HTMLTableCellElement) {
        td.setAttribute(consts.JODIT_SELECTED_CELL_MARKER, '1');
    }
    static restoreSelection(td: HTMLTableCellElement) {
        td.removeAttribute(consts.JODIT_SELECTED_CELL_MARKER);
    }

    /**
     *
     * @param {HTMLTableElement} table
     * @return {HTMLTableCellElement[]}
     */
    static getAllSelectedCells(table: HTMLElement | HTMLTableElement): HTMLTableCellElement[] {
        return table ? <HTMLTableCellElement[]>$$(`td[${consts.JODIT_SELECTED_CELL_MARKER}],th[${consts.JODIT_SELECTED_CELL_MARKER}]`, table) : [];
    }

    /**
     * @param {HTMLTableElement} table
     * @return {number}
     */
    static getRowsCount(table: HTMLTableElement) {
        return table.rows.length;
    }

    /**
     * @param {HTMLTableElement} table
     * @return {number}
     */
    static getColumnsCount(table: HTMLTableElement) {
        const matrix = Table.formalMatrix(table);
        return matrix.reduce((max_count, cells) => {
            return Math.max(max_count, cells.length);
        }, 0);
    }



    /**
     *
     * @param {HTMLTableElement} table
     * @param {function(HTMLTableCellElement, int, int, int, int):boolean} [callback] if return false cycle break
     * @return {Array}
     */
    static formalMatrix(table: HTMLTableElement, callback ?: (cell: HTMLTableCellElement, row: number, col: number, colSpan: number, rowSpan: number) => false|void): HTMLTableCellElement[][] {
        const matrix: HTMLTableCellElement[][] = [[],];
        const rows  = Array.prototype.slice.call(table.rows);

        const setCell = (cell: HTMLTableCellElement, i: number): false | HTMLTableCellElement[][] | void => {
            if (matrix[i] === undefined) {
                matrix[i] = [];
            }

            let colSpan: number = cell.colSpan,
                column: number,
                rowSpan = cell.rowSpan,
                row: number,
                currentColumn: number = 0;

            while (matrix[i][currentColumn]) {
                currentColumn += 1;
            }

            for (row = 0; row < rowSpan; row += 1) {
                for (column = 0; column < colSpan; column += 1) {
                    if (matrix[i + row] === undefined) {
                        matrix[i + row] = [];
                    }
                    if (callback && callback(cell, i + row, currentColumn + column, colSpan, rowSpan) === false) {
                        return false;
                    }
                    matrix[i + row][currentColumn + column] = cell;
                }
            }
        };

        for (let i = 0, j; i < rows.length; i += 1) {
            let cells = Array.prototype.slice.call(rows[i].cells);
            for (j = 0; j < cells.length; j += 1) {
                if (setCell(cells[j], i) === false) {
                    return matrix;
                }
            }
        }

        return matrix;
    }

    /**
     * Get cell coordinate in formal table (without colspan and rowspan)
     */
    static formalCoordinate (table: HTMLTableElement, cell: HTMLTableCellElement, max = false): number[] {
        let i: number = 0,
            j: number = 0,
            width: number = 1,
            height: number = 1;

        Table.formalMatrix(table, (td: HTMLTableCellElement, ii: number, jj: number, colSpan: number | void, rowSpan: number| void): false | void => {
            if (cell === td) {
                i = ii;
                j = jj;
                width = colSpan || 1;
                height = rowSpan || 1;
                if (max) {
                    j += (colSpan || 1) - 1;
                    i += (rowSpan || 1) - 1;
                }
                return false;
            }
        });

        return [i, j, width, height];
    }

    /**
     * Inserts a new line after row what contains the selected cell
     *
     * @param {HTMLTableElement} table
     * @param {Boolean|HTMLTableRowElement} [line=false] Insert a new line after/before this line contains the selected cell
     * @param {Boolean} [after=true] Insert a new line after line contains the selected cell
     */
    static appendRow(table: HTMLTableElement, line:false|HTMLTableRowElement = false, after = true) {
        let columnsCount: number = Table.getColumnsCount(table),
            row: HTMLTableRowElement = table.ownerDocument.createElement('tr'),
            j: number;

        for (j = 0; j < columnsCount; j += 1) {
            row.appendChild(table.ownerDocument.createElement('td'))
        }

        if (after && line && line.nextSibling) {
            line.parentNode && line.parentNode.insertBefore(row, line.nextSibling)
        }else if (!after && line) {
            line.parentNode && line.parentNode.insertBefore(row, line)
        } else {
            ($$(':scope>tbody', table)[0]  || table).appendChild(row);
        }
    }

    /**
     * Remove row
     *
     * @param {HTMLTableElement} table
     * @param {int} rowIndex
     */
    static removeRow(table: HTMLTableElement, rowIndex: number) {
        const box = Table.formalMatrix(table);
        let dec: boolean;
        const row = table.rows[rowIndex];

        each(box[rowIndex], (j: number, cell: HTMLTableCellElement) => {
            dec = false;
            if (rowIndex - 1 >= 0 && box[rowIndex - 1][j] === cell) {
                dec = true;
            } else if (box[rowIndex + 1] && box[rowIndex + 1][j] === cell) {
                if (cell.parentNode === row && cell.parentNode.nextSibling) {
                    dec = true;
                    let nextCell = j + 1;
                    while (box[rowIndex + 1][nextCell] === cell) {
                        nextCell += 1;
                    }

                    const nextRow:HTMLTableRowElement  = <HTMLTableRowElement>Dom.next(cell.parentNode, (elm: Node | null) => elm && elm.nodeType === Node.ELEMENT_NODE && elm.nodeName === 'TR', table);

                    if (box[rowIndex + 1][nextCell]) {
                        nextRow.insertBefore(cell, box[rowIndex + 1][nextCell]);
                    } else {
                        nextRow.appendChild(cell);
                    }
                }
            } else {
                cell.parentNode && cell.parentNode.removeChild(cell);
            }
            if (dec && (cell.parentNode === row || cell !== box[rowIndex][j - 1])) {
                let rowSpan: number = cell.rowSpan;
                if (rowSpan - 1 > 1) {
                    cell.setAttribute('rowspan', (rowSpan - 1).toString());
                } else {
                    cell.removeAttribute('rowspan');
                }
            }
        });

        if (row && row.parentNode) {
            row.parentNode.removeChild(row);
        }
    }

    /**
     * Insert column before / after all the columns containing the selected cells
     *
     */
    static appendColumn(table: HTMLTableElement, j: number, after = true) {
        const box: HTMLTableCellElement[][] = Table.formalMatrix(table);
        let i: number;

        if (j === undefined) {
            j = Table.getColumnsCount(table) - 1;
        }

        for (i = 0; i < box.length; i += 1) {
            const cell: HTMLTableCellElement = table.ownerDocument.createElement('td');
            const td: HTMLTableCellElement = box[i][j];
            let added: boolean = false;
            if (after) {
                if (box[i] && td && j + 1 >= box[i].length || td !== box[i][j + 1]) {
                    if (td.nextSibling) {
                        td.parentNode && td.parentNode.insertBefore(cell, td.nextSibling);
                    } else {
                        td.parentNode && td.parentNode.appendChild(cell)
                    }
                    added = true;
                }
            } else {
                if (j - 1 < 0 || box[i][j] !== box[i][j - 1] && box[i][j].parentNode) {
                    td.parentNode && td.parentNode.insertBefore(cell, box[i][j]);
                    added = true;
                }
            }
            if (!added) {
                box[i][j].setAttribute('colspan', (parseInt(box[i][j].getAttribute('colspan') || '1', 10) + 1).toString());
            }
        }
    }

    /**
     * Remove column by index
     *
     * @param {HTMLTableElement} table
     * @param {int} [j]
     */
    static removeColumn(table: HTMLTableElement, j: number) {
        const box: HTMLTableCellElement[][] = Table.formalMatrix(table);

        let dec: boolean;
        each(box, (i: number, cells: HTMLTableCellElement[]) => {
            const td: HTMLTableCellElement = cells[j];
            dec = false;
            if (j - 1 >= 0 && box[i][j - 1] === td) {
                dec = true;
            } else if (j + 1 < cells.length && box[i][j + 1] === td) {
                dec = true;
            } else {
                td.parentNode && td.parentNode.removeChild(td);
            }
            if (dec && (i - 1 < 0 || td !== box[i - 1][j])) {
                const colSpan:number = td.colSpan;
                if (colSpan - 1 > 1) {
                    td.setAttribute('colspan', (colSpan - 1).toString());
                } else {
                    td.removeAttribute('colspan');
                }
            }
        });
    }

    /**
     * Define bound for selected cells
     *
     * @param {HTMLTableElement} table
     * @param {Array.<HTMLTableCellElement>} selectedCells
     * @return {number[][]}
     */
    static getSelectedBound (table: HTMLTableElement, selectedCells: HTMLTableCellElement[]): number[][] {
        const bound = [[Infinity, Infinity], [0, 0]];
        const box = Table.formalMatrix(table);
        let i: number, j: number, k: number;

        for (i = 0; i < box.length; i += 1) {
            for (j = 0; j < box[i].length; j += 1) {
                if (selectedCells.indexOf(box[i][j]) !== -1) {
                    bound[0][0] = Math.min(i, bound[0][0]);
                    bound[0][1] = Math.min(j, bound[0][1]);
                    bound[1][0] = Math.max(i, bound[1][0]);
                    bound[1][1] = Math.max(j, bound[1][1]);
                }
            }
        }
        for (i = bound[0][0]; i <= bound[1][0]; i += 1) {
            for (k = 1, j = bound[0][1]; j <= bound[1][1]; j += 1) {
                while (box[i][j - k] && box[i][j] === box[i][j - k]) {
                    bound[0][1] = Math.min(j - k, bound[0][1]);
                    bound[1][1] = Math.max(j - k, bound[1][1]);
                    k += 1;
                }
                k = 1;
                while (box[i][j + k] && box[i][j] === box[i][j + k]) {
                    bound[0][1] = Math.min(j + k, bound[0][1]);
                    bound[1][1] = Math.max(j + k, bound[1][1]);
                    k += 1;
                }
                k = 1;
                while (box[i - k] && box[i][j] === box[i - k][j]) {
                    bound[0][0] = Math.min(i - k, bound[0][0]);
                    bound[1][0] = Math.max(i - k, bound[1][0]);
                    k += 1;
                }
                k = 1;
                while (box[i + k] && box[i][j] === box[i + k][j]) {
                    bound[0][0] = Math.min(i + k, bound[0][0]);
                    bound[1][0] = Math.max(i + k, bound[1][0]);
                    k += 1;
                }
            }
        }

        return bound;
    }

    /**
     *
     * @param {HTMLTableElement} table
     */
    static normalizeTable (table: HTMLTableElement) {
        let i: number,
            j: number,
            min: number,
            not: boolean;

        const __marked: HTMLTableCellElement[] = [],
              box: HTMLTableCellElement[][] = Table.formalMatrix(table);

        // remove extra colspans
        for (j = 0; j < box[0].length; j += 1) {
            min = 1000000;
            not = false;
            for (i = 0; i < box.length; i += 1) {
                if (box[i][j] === undefined) {
                    continue; // broken table
                }
                if (box[i][j].colSpan < 2) {
                    not = true;
                    break;
                }
                min = Math.min(min, box[i][j].colSpan);
            }
            if (!not) {
                for (i = 0; i < box.length; i += 1) {
                    if (box[i][j] === undefined) {
                        continue; // broken table
                    }
                    Table.__mark(box[i][j], 'colspan', box[i][j].colSpan - min + 1, __marked);
                }
            }
        }


        // remove extra rowspans
        for (i = 0; i < box.length; i += 1) {
            min = 1000000;
            not = false;
            for (j = 0; j < box[i].length; j += 1) {
                if (box[i][j] === undefined) {
                    continue; // broken table
                }
                if (box[i][j].rowSpan < 2) {
                    not = true;
                    break;
                }
                min = Math.min(min, box[i][j].rowSpan);
            }
            if (!not) {
                for (j = 0; j < box[i].length; j += 1) {
                    if (box[i][j] === undefined) {
                        continue; // broken table
                    }
                    Table.__mark(box[i][j], 'rowspan', box[i][j].rowSpan - min + 1, __marked);
                }
            }
        }

        // remove rowspans and colspans equal 1 and empty class
        for (i = 0; i < box.length; i += 1) {
            for (j = 0; j < box[i].length; j += 1) {
                if (box[i][j] === undefined) {
                    continue; // broken table
                }
                if (box[i][j].hasAttribute('rowspan') && box[i][j].rowSpan === 1) {
                    box[i][j].removeAttribute('rowspan');
                }
                if (box[i][j].hasAttribute('colspan') && box[i][j].colSpan === 1) {
                    box[i][j].removeAttribute('colspan');
                }
                if (box[i][j].hasAttribute('class') && !box[i][j].getAttribute('class')) {
                    box[i][j].removeAttribute('class');
                }
            }
        }

        Table.__unmark(__marked);
    }

    /**
     * It combines all of the selected cells into one. The contents of the cells will also be combined
     *
     * @param {HTMLTableElement} table
     *
     */
    static mergeSelected(table: HTMLTableElement) {
        let bound: number[][] = Table.getSelectedBound(table, Table.getAllSelectedCells(table)),
            w: number = 0,
            first: HTMLTableCellElement|null = null,
            first_j: number = 0,
            td: HTMLTableCellElement,
            html: string[] = [],
            cols: number = 0,
            rows: number = 0;

        const __marked: HTMLTableCellElement[] = [];

        if (bound && (bound[0][0] - bound[1][0] || bound[0][1] - bound[1][1])) {
            Table.formalMatrix(table, (cell: HTMLTableCellElement, i: number, j: number, cs: number, rs: number) => {
                if (i >= bound[0][0] && i <= bound[1][0]) {
                    if (j >= bound[0][1] && j <= bound[1][1]) {
                        td = cell;

                        if ((<any>td)['__i_am_already_was']) {
                            return;
                        }

                        (<any>td)['__i_am_already_was'] = true;

                        if (i === bound[0][0] && td.style.width) {
                            w += td.offsetWidth;
                        }

                        if (trim(cell.innerHTML.replace(/<br(\/)?>/g, '')) !== '') {
                            html.push(cell.innerHTML);
                        }

                        if (cs > 1) {
                            cols += cs - 1;
                        }
                        if (rs > 1) {
                            rows += rs - 1;
                        }

                        if (!first) {
                            first = <HTMLTableCellElement>cell;
                            first_j = j;
                        } else {
                            Table.__mark(td, 'remove', 1, __marked);
                        }
                    }
                }
            });

            cols = bound[1][1] - bound[0][1] + 1;
            rows = bound[1][0] - bound[0][0] + 1;

            if (first) {
                if (cols > 1) {
                    Table.__mark(first, 'colspan', cols, __marked);
                }
                if (rows > 1) {
                    Table.__mark(first, 'rowspan', rows, __marked);
                }


                if (w) {
                    Table.__mark(first, 'width', ((w / table.offsetWidth) * 100).toFixed(consts.ACCURACY) + '%', __marked);
                    if (first_j) {
                        Table.setColumnWidthByDelta(table, first_j, 0, true, __marked);
                    }
                }


                (<HTMLTableCellElement>first).innerHTML = html.join('<br/>');


                delete (<any>first)['__i_am_already_was'];

                Table.__unmark(__marked);

                Table.normalizeTable(table);

                each([].slice.call(table.rows), (index, tr) => {
                    if (!tr.cells.length) {
                        tr.parentNode.removeChild(tr);
                    }
                })
            }
        }
    }


    /**
     * Divides all selected by `jodit_focused_cell` class table cell in 2 parts vertical. Those division into 2 columns
     */
    static splitHorizontal(table: HTMLTableElement) {
        let coord: number[],
            td: HTMLTableCellElement,
            tr: HTMLTableRowElement,
            parent: HTMLTableRowElement,
            after: HTMLTableCellElement;

        const __marked: HTMLTableCellElement[] = [];

        Table.getAllSelectedCells(table).forEach((cell: HTMLTableCellElement) => {
            td = table.ownerDocument.createElement('td');
            td.appendChild(table.ownerDocument.createElement('br'));
            tr = table.ownerDocument.createElement('tr');

            coord = Table.formalCoordinate(table, cell);

            if (cell.rowSpan < 2) {
                Table.formalMatrix(table, (td, i, j) => {
                    if (coord[0] === i && coord[1] !== j && td !== cell) {
                        Table.__mark(td, 'rowspan', td.rowSpan + 1, __marked);
                    }
                });
                Dom.after(<HTMLTableRowElement>Dom.closest(cell, 'tr', table), tr);
                tr.appendChild(td);
            } else {
                Table.__mark(cell, 'rowspan', cell.rowSpan - 1, __marked);
                Table.formalMatrix(table, (td: HTMLTableCellElement, i: number, j: number) => {
                    if (i > coord[0] && i < coord[0] + cell.rowSpan && coord[1] >  j && (<HTMLTableRowElement>td.parentNode).rowIndex === i) {
                        after = td;
                    }
                    if (coord[0] < i && td === cell) {
                        parent = table.rows[i];
                    }
                });
                if (after) {
                    Dom.after(after, td);
                } else {
                    parent.insertBefore(td, parent.firstChild);
                }
            }

            if (cell.colSpan > 1) {
                Table.__mark(td, 'colspan', cell.colSpan, __marked);
            }

            Table.__unmark(__marked);
            Table.restoreSelection(cell);
        });
        this.normalizeTable(table);
    }

    /**
     * It splits all the selected cells into 2 parts horizontally. Those. are added new row
     *
     * @param {HTMLTableElement} table
     */
    static splitVertical(table: HTMLTableElement) {
        let coord: number[],
            td: HTMLTableCellElement,
            percentage: number;

        const __marked: HTMLTableCellElement[] = [];

        Table.getAllSelectedCells(table).forEach((cell: HTMLTableCellElement) => {
            coord = Table.formalCoordinate(table, cell);
            if (cell.colSpan < 2) {
                Table.formalMatrix(table, (td, i, j) => {
                    if (coord[1] === j && coord[0] !== i && td !== cell) {
                        Table.__mark(td, 'colspan', td.colSpan + 1, __marked);
                    }
                });
            } else {
                Table.__mark(cell, 'colspan', cell.colSpan - 1, __marked);
            }

            td = table.ownerDocument.createElement('td');
            td.appendChild(table.ownerDocument.createElement('br'));

            if (cell.rowSpan > 1) {
                Table.__mark(td, 'rowspan', cell.rowSpan, __marked);
            }

            const oldWidth = cell.offsetWidth; // get old width

            Dom.after(cell, td);

            percentage = (oldWidth / table.offsetWidth) / 2;

            Table.__mark(cell, 'width', (percentage * 100).toFixed(consts.ACCURACY) + '%', __marked);
            Table.__mark(td, 'width', (percentage * 100).toFixed(consts.ACCURACY) + '%', __marked);
            Table.__unmark(__marked);

            Table.restoreSelection(cell);
        });
        Table.normalizeTable(table);
    }

    /**
     *
     * @param {HTMLTableCellElement} cell
     * @param {string} key
     * @param {string} value
     * @param {HTMLTableCellElement[]} __marked
     * @private
     */
    private static __mark (cell: HTMLTableCellElement, key: string, value: string|number, __marked: HTMLTableCellElement[]) {
        __marked.push(cell);
        if (!(<any>cell)['__marked_value']) {
            (<any>cell)['__marked_value'] = {};
        }
        (<any>cell)['__marked_value'][key] = value === undefined ? 1 : value;
    }

    private static __unmark (__marked: HTMLTableCellElement[]) {
        __marked.forEach((cell) => {
            if ((<any>cell)['__marked_value']) {
                each((<any>cell)['__marked_value'], (key, value) => {
                    switch (key) {
                        case 'remove':
                            cell.parentNode && cell.parentNode.removeChild(cell);
                            break;
                        case 'rowspan':
                            if (value > 1) {
                                cell.setAttribute('rowspan', value);
                            } else {
                                cell.removeAttribute('rowspan');
                            }
                            break;
                        case 'colspan':
                            if (value > 1) {
                                cell.setAttribute('colspan', value);
                            } else {
                                cell.removeAttribute('colspan');
                            }
                            break;
                        case 'width':
                            cell.style.width = value;
                            break;
                    }
                    delete (<any>cell)['__marked_value'][key];
                });
                delete (<any>cell).__marked_value;
            }
        });
    }

    /**
     * Set column width used delta value
     *
     * @param {HTMLTableElement} table
     * @param {int} j column
     * @param {int} delta
     * @param {boolean} noUnmark
     * @param {HTMLTableCellElement[]} __marked
     */
    static setColumnWidthByDelta (table: HTMLTableElement, j: number, delta: number, noUnmark: boolean, __marked: HTMLTableCellElement[]) {
        let i: number,
            box = Table.formalMatrix(table),
            w: number,
            percent: number;

        for (i = 0; i < box.length; i += 1) {
            w = box[i][j].offsetWidth;
            percent = ((w + delta) / table.offsetWidth) * 100;
            Table.__mark(box[i][j], 'width', percent.toFixed(consts.ACCURACY) + '%', __marked);
        }

        if (!noUnmark) {
            Table.__unmark(__marked);
        }
    }
}