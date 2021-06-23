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

export type IComment = {
  id: string;
  type: CommentType;
  author: string;
  replies: Comment[];
  text: string;
};
