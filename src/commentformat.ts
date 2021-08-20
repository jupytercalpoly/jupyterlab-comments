import { CodeEditor } from '@jupyterlab/codeeditor';
import { PartialJSONObject, PartialJSONValue } from '@lumino/coreutils';

/**
 * A type for the identity of a commenter.
 */
export interface IIdentity extends PartialJSONObject {
  id: number;
  name: string;
  color: string;
  icon: number;
}

/**
 * A type for the properties of a text selection
 */
export interface ISelection extends IComment {
  start: CodeEditor.IPosition;
  end: CodeEditor.IPosition;
}

export interface IBaseComment extends PartialJSONObject {
  id: string;
  type: string;
  identity: IIdentity;
  text: string;
  time: string;
}

export interface IReply extends IBaseComment {
  type: 'reply';
}

export interface ICommentWithReplies extends IBaseComment {
  replies: IReply[];
}

export interface IComment extends ICommentWithReplies {
  target: PartialJSONValue;
}

export interface ICellComment extends IComment {
  type: 'cell';
  target: {
    cellID: string;
  };
}

export interface ICellSelectionComment extends IComment {
  type: 'cell-selection';
  target: {
    cellID: string;
    start: CodeEditor.IPosition;
    end: CodeEditor.IPosition;
  };
}

export interface ITextSelectionComment extends IComment {
  type: 'text-selection';
  target: {
    start: CodeEditor.IPosition;
    end: CodeEditor.IPosition;
  };
}
