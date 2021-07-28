import {
  ICellSelectionComment,
  IComment,
  IIdentity,
  IReply
} from './commentformat';
import { PartialJSONValue, UUID } from '@lumino/coreutils';
import { getCommentTimeString } from './utils';
import { Cell, ICellModel } from '@jupyterlab/cells';

export abstract class ACommentFactory<T = any> {
  abstract getPreviewText(comment: IComment, target: T): string;
  constructor(options: ACommentFactory.IOptions) {
    const { type } = options;
    this.type = type;
  }

  abstract targetToJSON(target: T): PartialJSONValue;

  createComment(options: ACommentFactory.ICommentOptions<T>): IComment {
    const { target, text, identity, replies, id } = options;
    return {
      text,
      identity ,
      type: this.type,
      id: id ?? UUID.uuid4(),
      replies: replies ?? [],
      time: getCommentTimeString(),
      target: this.targetToJSON(target)
    };
  }
  createCommentWithPrecomputedTarget(
    options: Exclude<ACommentFactory.ICommentOptions<T>, 'target'>,
    target: PartialJSONValue
  ): IComment {
    const { text, identity, replies, id } = options;

    return {
      text,
      identity,
      type: this.type,
      id: id ?? UUID.uuid4(),
      replies: replies ?? [],
      time: getCommentTimeString(),
      target
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

export class CellCommentFactory extends ACommentFactory {
  constructor() {
    super({
      type: 'cell'
    });
  }
  getPreviewText(comment: IComment, target: any): string {
    return '';
  }
  targetToJSON(cell: Cell): PartialJSONValue {
    return { cellid: cell.model.id };
  }
}

export class CellSelectionCommentFactory extends ACommentFactory {
  constructor() {
    super({
      type: 'cell-selection'
    });
  }

  targetToJSON(cell: Cell): PartialJSONValue {
    const { start, end } = cell.editor.getSelection();
    return {
      cellID: cell.model.id,
      start,
      end
    };
  }
  getPreviewText(comment: IComment, target: any): string {
    let previewText: string;
    let cell = target as ICellModel;
    let mainText = cell.value.text;
    let selectionComment = comment as ICellSelectionComment;
    let { start, end } = selectionComment.target;
    let startIndex = lineToIndex(mainText, start.line, start.column);
    let endIndex = lineToIndex(mainText, end.line, end.column);
    if (start < end) {
      previewText = cell.value.text.slice(startIndex, endIndex);
    } else {
      previewText = cell.value.text.slice(endIndex, startIndex);
    }
    if (previewText.length > 140) {
      previewText = previewText.slice(0, 140) + '...';
    }
    return previewText;
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
