import { Cell } from '@jupyterlab/cells';
import { every, find } from '@lumino/algorithm';
import * as comments from './commentformat';

export function verifyComments(comments: Record<string, unknown>): boolean {
  return Array.isArray(comments) && every(comments, verifyComment);
}

export function verifyComment(comment: Record<string, unknown>): boolean {
  return (
    'id' in comment &&
    'type' in comment &&
    'author' in comment &&
    'text' in comment &&
    'replies' in comment
  );
}

export function getCellComments(cell: Cell): comments.IComment[] | undefined {
  const comments = cell.model.metadata.get('comments');
  if (comments == null || !verifyComments(comments as any)) {
    return undefined;
  }
  return comments as any as comments.IComment[];
}

export function getCommentByID(
  comments: comments.IComment[],
  id: string
): comments.IComment | undefined {
  return find(comments, comment => comment.id === id);
}

export function addCellComment(cell: Cell, comment: comments.IComment): void {
  const comments = getCellComments(cell);
  if (comments == null) {
    cell.model.metadata.set('comments', [comment as any]);
  } else {
    cell.model.metadata.set('comments', [...(comments as any), comment as any]);
  }
}
