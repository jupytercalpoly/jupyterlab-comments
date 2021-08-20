import { Cell } from '@jupyterlab/cells';
import { ICellComment, ICellSelectionComment } from './commentformat';
import { CommentWidget } from './widget';
import { CommentFactory, CommentWidgetFactory } from './factory';
import { CommentFileModel } from './model';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CodeEditor } from '@jupyterlab/codeeditor';
import * as CodeMirror from 'codemirror';
import { PartialJSONValue } from '@lumino/coreutils';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { truncate } from './utils';

export class CellCommentWidget extends CommentWidget<Cell, ICellComment> {
  constructor(options: CommentWidget.IOptions<Cell, ICellComment>) {
    super(options);
  }

  get element(): HTMLElement {
    return this.target.node;
  }
}

export class CellSelectionCommentWidget extends CommentWidget<
  Cell,
  ICellSelectionComment
> {
  constructor(options: CellSelectionCommentWidget.IOptions) {
    super(options);
    console.log('created new cell selection widget', this);
    this._mark = options.mark;
  }

  dispose(): void {
    this._mark.clear();
    super.dispose();
  }

  get element(): HTMLElement {
    return this.target.node;
  }

  toJSON(): PartialJSONValue {
    const json = super.toJSON();

    const mark = this._mark;
    if (mark == null) {
      console.warn(
        'No mark found--serializing based on initial text selection position',
        this
      );
      return json;
    }

    const range = mark.find();
    if (range == null) {
      console.warn(
        'Mark no longer exists in code editor--serializing based on initial text selection position',
        this
      );
      return json;
    }

    const { from, to } = range as CodeMirror.MarkerRange;
    const textSelectionComment = json as ICellSelectionComment;

    textSelectionComment.target.cellID = this.target.model.id;
    textSelectionComment.target.start = Private.toCodeEditorPosition(from);
    textSelectionComment.target.end = Private.toCodeEditorPosition(to);

    return textSelectionComment;
  }

  getPreview(): string | undefined {
    if (this.isMock || this._mark == null) {
      return Private.getMockCommentPreviewText(this._doc, this.comment!);
    }

    const range = this._mark.find();
    if (range == null) {
      return '';
    }

    const { from, to } = range as CodeMirror.MarkerRange;
    const text = this._doc.getRange(from, to);

    return truncate(text, 140);
  }

  private get _doc(): CodeMirror.Doc {
    return Private.docFromCell(this.target);
  }

  private _mark: CodeMirror.TextMarker;
}

export namespace CellSelectionCommentWidget {
  export interface IOptions
    extends CommentWidget.IOptions<Cell, ICellSelectionComment> {
    mark: CodeMirror.TextMarker;
  }
}

export class CellSelectionCommentFactory extends CommentFactory<ICellSelectionComment> {
  createComment(
    options: CommentFactory.ICommentOptions<Cell>
  ): ICellSelectionComment {
    const comment = super.createComment(options);
    const { start, end } = options.source.editor.getSelection();

    comment.target = {
      cellID: options.source.model.id,
      start,
      end
    };

    console.log('created cell selection comment', comment);
    return comment;
  }

  readonly type = 'cell-selection';
}

export class CellSelectionCommentWidgetFactory extends CommentWidgetFactory<
  Cell,
  ICellSelectionComment
> {
  constructor(options: CellCommentFactory.IOptions) {
    super(options);

    this._tracker = options.tracker;
  }

  createWidget(
    comment: ICellSelectionComment,
    model: CommentFileModel,
    target?: Cell
  ): CellSelectionCommentWidget | undefined {
    const cell = target ?? this._cellFromID(comment.target.cellID);
    if (cell == null) {
      console.error('Cell not found for comment', comment);
      return;
    }

    const mark = Private.markCommentSelection(
      Private.docFromCell(cell),
      comment
    );

    return new CellSelectionCommentWidget({
      model,
      comment,
      mark,
      target: cell
    });
  }

  private _cellFromID(id: string): Cell | undefined {
    const notebook = this._tracker.currentWidget;
    if (notebook == null) {
      return;
    }

    return notebook.content.widgets.find(cell => cell.model.id === id);
  }

  readonly widgetType = 'cell-selection';
  readonly commentType = 'cell-selection';

  private _tracker: INotebookTracker;
}

export class CellCommentFactory extends CommentFactory<ICellComment> {
  createComment(options: CommentFactory.ICommentOptions<Cell>): ICellComment {
    const comment = super.createComment(options);
    comment.target = { cellID: options.source.model.id };

    return comment;
  }

  readonly type = 'cell';
}

export class CellCommentWidgetFactory<
  C extends ICellComment = ICellComment
> extends CommentWidgetFactory<Cell, C> {
  constructor(options: CellCommentFactory.IOptions) {
    super(options);

    this._tracker = options.tracker;
  }

  createWidget(
    comment: ICellComment,
    model: CommentFileModel,
    target?: Cell
  ): CellCommentWidget | undefined {
    const cell = target ?? this._cellFromID(comment.target.cellID);
    if (cell == null) {
      console.error('Cell not found for comment', comment);
      return;
    }

    return new CellCommentWidget({
      model,
      comment,
      target: cell
    });
  }

  private _cellFromID(id: string): Cell | undefined {
    const notebook = this._tracker.currentWidget;
    if (notebook == null) {
      return;
    }

    return notebook.content.widgets.find(cell => cell.model.id === id);
  }

  readonly widgetType = 'cell';
  readonly commentType = 'cell';

  private _tracker: INotebookTracker;
}

export namespace CellCommentFactory {
  export interface IOptions extends CommentWidgetFactory.IOptions {
    tracker: INotebookTracker;
  }
}

namespace Private {
  export function docFromCell(cell: Cell): CodeMirror.Doc {
    return (cell.editorWidget.editor as CodeMirrorEditor).doc;
  }

  //function that converts a line-column pairing to an index
  export function lineToIndex(str: string, line: number, col: number): number {
    if (line == 0) {
      return col;
    } else {
      let arr = str.split('\n');
      return arr.slice(0, line).join('\n').length + col + 1;
    }
  }

  export function markCommentSelection(
    doc: CodeMirror.Doc,
    comment: ICellSelectionComment
  ): CodeMirror.TextMarker {
    const color = comment.identity.color;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const { start, end } = comment.target;
    const forward =
      start.line < end.line ||
      (start.line === end.line && start.column <= end.column);
    const anchor = toCodeMirrorPosition(forward ? start : end);
    const head = toCodeMirrorPosition(forward ? end : start);

    return doc.markText(anchor, head, {
      className: 'jc-Highlight',
      title: `${comment.identity.name}: ${truncate(comment.text, 140)}`,
      css: `background-color: rgba( ${r}, ${g}, ${b}, 0.15)`,
      attributes: { id: `CommentMark-${comment.id}` }
    });
  }

  export function toCodeMirrorPosition(
    pos: CodeEditor.IPosition
  ): CodeMirror.Position {
    return {
      line: pos.line,
      ch: pos.column
    };
  }

  export function toCodeEditorPosition(
    pos: CodeMirror.Position
  ): CodeEditor.IPosition {
    return {
      line: pos.line,
      column: pos.ch
    };
  }

  export function getMockCommentPreviewText(
    doc: CodeMirror.Doc,
    comment: ICellSelectionComment
  ): string {
    const { start, end } = comment.target;
    const forward =
      start.line < end.line ||
      (start.line === end.line && start.column <= end.column);
    const from = toCodeMirrorPosition(forward ? start : end);
    const to = toCodeMirrorPosition(forward ? end : start);
    const text = doc.getRange(from, to);

    return truncate(text, 140);
  }
}
