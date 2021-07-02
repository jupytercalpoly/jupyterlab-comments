import { every } from '@lumino/algorithm';
import { IObservableJSON } from '@jupyterlab/observables';
import * as comments from './commentformat';
import { getCommentTimeString } from './utils';

export function verifyComments(comments: Record<string, unknown>): boolean {
  return Array.isArray(comments) && every(comments, verifyComment);
}

export function verifyComment(comment: Record<string, unknown>): boolean {
  return (
    'id' in comment &&
    'type' in comment &&
    'identity' in comment &&
    'id' in (comment['identity'] as comments.IIdentity) &&
    'name' in (comment['identity'] as comments.IIdentity) &&
    'color' in (comment['identity'] as comments.IIdentity) &&
    'text' in comment &&
    'replies' in comment &&
    'time' in comment
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

export function edit(
  metadata: IObservableJSON,
  commentid: string,
  editid: string,
  modifiedText: string
): void {
  const comment = getCommentByID(metadata, commentid);
  if (comment == null) {
    return;
  }
  if (editid == commentid) {
    editComment(metadata, commentid, modifiedText);
  } else {
    editReply(metadata, commentid, editid, modifiedText);
  }
}

function editReply(
  metadata: IObservableJSON,
  commentid: string,
  id: string,
  modifiedText: string
): void {
  const comment = getCommentByID(metadata, commentid);
  if (comment == null) {
    console.warn('Comment does not exist!');
    return;
  }
  const replyIndex = comment.replies.findIndex(r => r.id === id);
  if (replyIndex === -1) {
    return;
  }
  comment.replies[replyIndex].text = modifiedText;
  // Maybe we should inclued an edited flag to render?
  comment.time = getCommentTimeString(); 
}

function editComment(
  metadata: IObservableJSON,
  id: string,
  modifiedText: string
): void {
  const comment = getCommentByID(metadata, id);
  if (comment == null) {
    console.warn('Comment does not exist!');
    return;
  }
  comment.text = modifiedText;
  // Maybe we should inclued an edited flag to render?
  comment.time = getCommentTimeString(); 
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
  metadata.set('comments', comments as any);
}

export function deleteReply(
  metadata: IObservableJSON,
  reply_id: string,
  parent_id: string
): void {
  const comments = getComments(metadata);
  if (comments == null) {
    return;
  }
  const commentIndex = comments.findIndex(c => c.id === parent_id);
  const comment = comments[commentIndex];
  const replyIndex = comment.replies.findIndex(r => r.id === reply_id);
  if (replyIndex === -1) {
    return;
  }
  comment.replies.splice(replyIndex, 1);
  comments[commentIndex] = comment;
  metadata.set('comments', comments as any);
}

export function deleteComment(metadata: IObservableJSON, id: string): void {
  const comments = getComments(metadata);
  if (comments == null) {
    return;
  }
  const commentIndex = comments.findIndex(c => c.id === id);
  comments.splice(commentIndex, 1);
  metadata.set('comments', comments as any);
}
