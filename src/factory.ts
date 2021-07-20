import { IComment, IIdentity, IReply } from './commentformat';
import { PartialJSONValue, UUID } from '@lumino/coreutils';
import { getCommentTimeString } from './utils';

export interface ICommentFactory<T = any> {
  createComment: (options: CommentFactory.ICommentOptions<T>) => IComment;
  createCommentWithPrecomputedTarget: (
    options: Exclude<ICommentOptions<T>, 'target'>,
    target: PartialJSONValue
  ) => IComment;

  readonly type: string;
  readonly targetFactory: (target: T) => PartialJSONValue;
}

/**
 * A class that creates comments of a given type.
 */
export class CommentFactory<T = any> implements ICommentFactory<T> {
  constructor(options: CommentFactory.IOptions<T>) {
    const { type, targetFactory } = options;

    this.type = type;
    this.targetFactory = targetFactory;
  }

  createComment(options: CommentFactory.ICommentOptions<T>): IComment {
    const { target, text, identity, replies, id } = options;

    return {
      text,
      identity,
      type: this.type,
      id: id ?? UUID.uuid4(),
      replies: replies ?? [],
      time: getCommentTimeString(),
      target: this.targetFactory(target)
    };
  }

  createCommentWithPrecomputedTarget(
    options: Exclude<ICommentOptions<T>, 'target'>,
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

  static createReply(options: IReplyOptions): IReply {
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
  readonly targetFactory: (target: T) => PartialJSONValue;
}

export namespace CommentFactory {
  export interface IOptions<T> {
    type: string;
    targetFactory: (target: T) => PartialJSONValue;
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

export type ICommentOptions<T> = CommentFactory.ICommentOptions<T>;
export type IReplyOptions = CommentFactory.IReplyOptions;
