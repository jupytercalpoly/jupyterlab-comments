import { every } from '@lumino/algorithm';
import { PartialJSONObject } from '@lumino/coreutils';
import * as comments from './commentformat';
import { getCommentTimeString } from './utils';
import { ISharedText } from '@jupyterlab/shared-models';

export interface IMetadated {
  getMetadata: () => PartialJSONObject;
  setMetadata: (metadata: PartialJSONObject) => void;
}

export interface ISharedMetadatedText extends ISharedText, IMetadated {}

export function updateMetadata(model: IMetadated, value: any): void {
  model.setMetadata(Object.assign({}, model.getMetadata(), value));
}

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

export function _getComments(
  metadata: PartialJSONObject,
  verify?: boolean
): comments.IComment[] | undefined {
  const comments = metadata['comments'];
  if (comments == null || (verify && !verifyComments(comments as any))) {
    return undefined;
  }
  return comments as any as comments.IComment[];
}

export function getComments(
  model: IMetadated,
  verify?: boolean
): comments.IComment[] | undefined {
  const metadata = model.getMetadata();
  return _getComments(metadata, verify);
}

export function getCommentByID(
  model: IMetadated,
  id: string
): comments.IComment | undefined {
  const comments = getComments(model);
  if (comments == null) {
    return undefined;
  }

  return comments.find(comment => comment.id === id);
}

export function addComment(
  model: IMetadated,
  comment: comments.IComment
): void {
  if (comment.text == '') {
    console.warn('Empty string cannot be a comment');
    return;
  }

  const comments = getComments(model) || [];
  comments.push(comment);
  updateMetadata(model, { comments });
}

export function edit(
  model: IMetadated,
  commentid: string,
  editid: string,
  modifiedText: string
): void {
  if (editid == commentid) {
    editComment(model, commentid, modifiedText);
  } else {
    editReply(model, commentid, editid, modifiedText);
  }
}

function editReply(
  model: IMetadated,
  commentid: string,
  id: string,
  modifiedText: string
): void {
  if (modifiedText === '') {
    console.warn('Empty string cannot be a comment');
    return;
  }

  const comments = getComments(model);
  if (comments == null) {
    return;
  }

  const comment = comments.find(c => c.id === commentid);
  if (comment == null) {
    return;
  }

  const reply = comment.replies.find(r => r.id === id);
  if (reply == null) {
    return;
  }

  reply.text = modifiedText;
  reply.time = getCommentTimeString();

  updateMetadata(model, { comments });
}

function editComment(
  model: IMetadated,
  id: string,
  modifiedText: string
): void {
  if (modifiedText === '') {
    console.warn('Empty string cannot be a comment');
    return;
  }

  const comments = getComments(model);
  if (comments == null) {
    return;
  }

  const comment = comments.find(c => c.id === id);
  if (comment == null) {
    return;
  }

  comment.text = modifiedText;
  comment.time = getCommentTimeString();

  updateMetadata(model, { comments });
}

export function addReply(
  model: IMetadated,
  reply: comments.IComment,
  id: string
): void {
  if (reply.text === '') {
    console.warn('Empty string cannot be a reply');
    return;
  }

  const comments = getComments(model);
  if (comments == null) {
    return;
  }

  const comment = comments.find(c => c.id === id);
  if (comment == null) {
    return;
  }

  comment.replies.push(reply);

  updateMetadata(model, { comments });
}

export function deleteReply(
  model: IMetadated,
  replyID: string,
  parentID: string
): void {
  const comments = getComments(model);
  if (comments == null) {
    return;
  }

  const comment = comments.find(c => c.id === parentID);
  if (comment == null) {
    return;
  }

  const replyIndex = comment.replies.findIndex(r => r.id === replyID);
  if (replyIndex === -1) {
    return;
  }

  comment.replies.splice(replyIndex, 1);

  updateMetadata(model, { comments });
}

export function deleteComment(model: IMetadated, id: string): void {
  const comments = getComments(model);
  if (comments == null) {
    return;
  }

  const commentIndex = comments.findIndex(c => c.id === id);
  if (commentIndex === -1) {
    return;
  }

  comments.splice(commentIndex, 1);

  updateMetadata(model, { comments });
}
