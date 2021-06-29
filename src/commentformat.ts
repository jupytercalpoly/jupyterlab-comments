import { Cell } from '@jupyterlab/cells';

export type NullCommmentTarget = {
  type: 'null';
  content: null;
};

export type CellCommentTarget = {
  type: 'cell';
  content: Cell;
};

export type TextSelectionTarget = {
  type: 'text';
  offset: number;
  length: number;
};

export type CommentTarget =
  | CellCommentTarget
  | NullCommmentTarget
  | TextSelectionTarget;

export type CommentType = 'null' | 'cell' | 'text';

export interface IIdentity {
  id: number;
  name: string;
}

export type IComment = {
  id: string;
  type: CommentType;
  identity: IIdentity;
  replies: IComment[];
  text: string;
};
