import { CodeEditor } from '@jupyterlab/codeeditor';
import { PartialJSONValue } from '@lumino/coreutils';
import { Awareness } from 'y-protocols/awareness';

/**
 * A type for the identity of a commentor.
 */
export interface IIdentity {
  id: number;
  name: string;
  color: string;
}

/**
 * A type for the properties of a text selection
 */
export interface ISelection extends IComment {
  start: CodeEditor.IPosition;
  end: CodeEditor.IPosition;
}

export interface IBaseComment {
  id: string;
  type: string;
  identity: IIdentity;
  awareness: Awareness;
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
