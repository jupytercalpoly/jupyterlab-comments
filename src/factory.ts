import {
  ICellSelectionComment,
  IComment,
  IIdentity,
  IReply,
  ISelection
} from './commentformat';
import { PartialJSONValue, UUID } from '@lumino/coreutils';
import { getCommentTimeString } from './utils';
import { Cell } from '@jupyterlab/cells';
import { CommentFileModel } from './model';
import { CommentWidget2 } from './widget';
import { INotebookTracker } from '@jupyterlab/notebook';

export abstract class ACommentFactory<T = any> {
  constructor(options: ACommentFactory.IOptions) {
    const { type } = options;
    this.type = type;
  }

  abstract targetToJSON(target: T): PartialJSONValue;
  abstract targetFromJSON(json: PartialJSONValue): T | undefined;
  abstract getPreviewText(comment: IComment, target: T): string;

  getElement(target: T): HTMLElement | undefined {
    return;
  }

  createWidget(
    comment: IComment,
    model: CommentFileModel,
    target?: T
  ): CommentWidget2<any> {
    return new CommentWidget2({
      model,
      id: comment.id,
      target: target ?? this.targetFromJSON(comment.target),
      factory: this
    });
  }

  createComment(
    options: ACommentFactory.ICommentOptions<T>,
    target?: PartialJSONValue
  ): IComment {
    const { text, identity, replies, id } = options;
    return {
      text,
      identity,
      type: this.type,
      id: id ?? UUID.uuid4(),
      replies: replies ?? [],
      time: getCommentTimeString(),
      target: target ?? this.targetToJSON(options.target)
    };
  }

  static createReply(options: ACommentFactory.IReplyOptions): IReply {
    const { text, identity, id } = options;

    return {
      text,
      identity,
      id: id ?? UUID.uuid4(),
      time: getCommentTimeString(),
      type: 'reply'
    };
  }

  readonly type: string;
}

export class TestCommentFactory extends ACommentFactory<null> {
  constructor() {
    super({ type: 'test' });
  }

  getPreviewText() {
    return '';
  }

  targetToJSON() {
    return null;
  }

  targetFromJSON() {
    return null;
  }
}

export class CellCommentFactory extends ACommentFactory<Cell> {
  constructor(tracker: INotebookTracker) {
    super({ type: 'cell' });

    this._tracker = tracker;
  }

  getPreviewText(comment: IComment, target: any): string {
    return '';
  }

  targetToJSON(cell: Cell): PartialJSONValue {
    return { cellID: cell.model.id };
  }

  targetFromJSON(json: PartialJSONValue): Cell | undefined {
    if (!(json instanceof Object && 'cellID' in json)) {
      return;
    }

    const notebook = this._tracker.currentWidget;
    if (notebook == null) {
      return;
    }

    const cellID = json['cellID'];
    return notebook.content.widgets.find(w => w.model.id === cellID);
  }

  getElement(target: Cell): HTMLElement | undefined {
    return target.node;
  }

  private _tracker: INotebookTracker;
}

export class CellSelectionCommentFactory extends ACommentFactory<Cell> {
  constructor(tracker: INotebookTracker) {
    super({ type: 'cell-selection' });

    this._tracker = tracker;
  }

  createWidget(
    comment: IComment,
    model: CommentFileModel,
    target?: Cell
  ): CommentWidget2<Cell> {
    const cell = target ?? this.targetFromJSON(comment.target);
    if (cell == null) {
      console.warn('no cell found for cell selection comment', comment);
    }

    // Add the selection to the cell's selections map.
    const selections = cell!.model.selections.get(cell!.model.id);
    const { start, end } = comment.target as any as ISelection;
    selections!.push({
      start,
      end,
      style: {
        className: 'jc-Highlight',
        color: 'black',
        displayName: comment.identity.name
      },
      uuid: comment.id
    });

    return super.createWidget(comment, model, cell);
  }

  targetToJSON(cell: Cell): PartialJSONValue {
    const { start, end } = cell.editor.getSelection();
    return {
      cellID: cell.model.id,
      start,
      end
    };
  }

  targetFromJSON(json: PartialJSONValue): Cell | undefined {
    if (!(json instanceof Object && 'cellID' in json)) {
      return;
    }

    const notebook = this._tracker.currentWidget;
    if (notebook == null) {
      return;
    }

    const cellID = json['cellID'];
    return notebook.content.widgets.find(w => w.model.id === cellID);
  }

  getPreviewText(comment: IComment, target?: Cell): string {
    const cell = target ?? this.targetFromJSON(comment.target);
    if (cell == null) {
      console.warn('no cell found for cell selection comment', comment);
      return '';
    }

    const mainText = cell.model.value.text;
    const selectionComment = comment as ICellSelectionComment;
    const { start, end } = selectionComment.target;

    let startIndex = lineToIndex(mainText, start.line, start.column);
    let endIndex = lineToIndex(mainText, end.line, end.column);

    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
    }

    let previewText: string = mainText.slice(startIndex, endIndex);

    if (previewText.length > 140) {
      return previewText.slice(0, 140) + '...';
    }

    return previewText;
  }

  getElement(target: Cell): HTMLElement | undefined {
    return target.node;
  }

  private _tracker: INotebookTracker;
}

export class HTMLElementCommentFactory extends ACommentFactory<HTMLElement> {
  constructor(options: HTMLElementCommentFactory.IOptions) {
    super(options);

    this._root = options.root ?? document.body;
    console.log(this._root);
  }

  getElement(target: HTMLElement): HTMLElement {
    return target;
  }

  targetToJSON(target: HTMLElement): PartialJSONValue {
    return {
      id: target.id
    };
  }

  targetFromJSON(json: PartialJSONValue): HTMLElement | undefined {
    if (!(json instanceof Object && 'id' in json)) {
      return;
    }

    return document.getElementById(json['id'] as string) ?? undefined;
  }

  getPreviewText(): string {
    return '';
  }

  private _root: HTMLElement;
}

export namespace HTMLElementCommentFactory {
  export interface IOptions extends ACommentFactory.IOptions {
    root?: HTMLElement;
  }
}

export namespace ACommentFactory {
  export interface IOptions {
    type: string; // cell or cell-selection
  }

  export interface IReplyOptions {
    text: string;
    identity: IIdentity;
    id?: string;
  }

  export interface ICommentOptions<T> extends IReplyOptions {
    target: T;
    replies?: IReply[];
  }
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
