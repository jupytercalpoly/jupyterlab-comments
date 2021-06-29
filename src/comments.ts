import { every } from '@lumino/algorithm';
import { IObservableJSON } from '@jupyterlab/observables';
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

export function getComments(
  metadata: IObservableJSON
): comments.IComment[] | undefined {
  const comments = metadata.get('comments');
  if (comments == null || !verifyComments(comments as any)) {
    return undefined;
  }
  return comments as any as comments.IComment[];
}

export function getCommentByID(
  metadata: IObservableJSON,
  id: string
): comments.IComment | undefined {
  const comments = getComments(metadata);
  if (comments == null) {
    return undefined;
  }

  return comments.find(comment => comment.id === id);
}

export function addComment(
  metadata: IObservableJSON,
  comment: comments.IComment
): void {
  const comments = getComments(metadata);
  if (comments == null) {
    metadata.set('comments', [comment as any]);
  } else {
    metadata.set('comments', [...(comments as any), comment as any]);
  }
}

export function addReply(
  metadata: IObservableJSON,
  reply: comments.IComment,
  id: string
): void {
  const comments = getComments(metadata);
  if (comments == null) {
    return;
  }

  const commentIndex = comments.findIndex(comment => comment.id === id);
  if (commentIndex === -1) {
    return;
  }

  comments[commentIndex].replies.push(reply);
  metadata.set('comments', comments);
}
