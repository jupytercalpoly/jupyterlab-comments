import { ReactWidget } from '@jupyterlab/apputils';
import * as React from 'react';
import { closeIcon } from '@jupyterlab/ui-components';
import { CommentType, IComment } from './commentformat';
import { IObservableJSON } from '@jupyterlab/observables';
import { UUID } from '@lumino/coreutils';
import { addReply } from './comments';

/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type CommentProps = {
  comment: IComment;
  className: string;
  onBodyClick: React.MouseEventHandler;
  onDeleteClick: React.MouseEventHandler;
};

type CommentWrapperProps = {
  comment: IComment;
};

function JCComment(props: CommentProps): JSX.Element {
  const { comment, className, onBodyClick, onDeleteClick } = props;

  return (
    <div className={className || ''} id={comment.id}>
      <p className="jc-Nametag">{comment.author}</p>
      <p className="jc-Body" onClick={onBodyClick}>
        {comment.text}
      </p>
      <button
        className="jc-DeleteButton jp-Button bp3-button bp3-minimal"
        onClick={onDeleteClick}
      >
        <closeIcon.react />
      </button>
    </div>
  );
}

export class CommentWidget<T> extends ReactWidget {
  constructor(options: CommentWidget.IOptions<T>) {
    super();

    const { identity, id, target, metadata } = options;
    this._identity = identity;
    this._commentID = id;
    this._target = target;
    this._metadata = metadata;
  }

  render(): ReactRenderElement {
    const metadata = this._metadata;
    const commentID = this.commentID;

    const _CommentWrapper = (props: CommentWrapperProps): JSX.Element => {
      const { comment } = props;

      const [isHidden, setIsHidden] = React.useState(true);
      const onBodyClick = (): void => setIsHidden(!isHidden);
      const onDeleteClick = this._deleteComment.bind(this);

      const onInputKeydown = (e: React.KeyboardEvent): void => {
        if (e.key != 'Enter') {
          return;
        }

        const target = e.target as HTMLTextAreaElement;

        const reply: IComment = {
          id: UUID.uuid4(),
          type: 'cell',
          author: 'Alice',
          replies: [],
          text: target.value
        };

        addReply(metadata, reply, commentID);
        target.value = '';
        setIsHidden(true);
      };

      if (comment == null) {
        return <div className="jc-MissingComment" />;
      }

      return (
        <div className="jc-CommentWithReplies">
          <JCComment
            comment={comment}
            className="jc-Comment"
            onBodyClick={onBodyClick}
            onDeleteClick={onDeleteClick}
          />
          <div className="jc-Replies">
            {comment.replies.map(reply => (
              <JCComment
                comment={reply}
                className="jc-Comment jc-Reply"
                onBodyClick={onBodyClick}
                onDeleteClick={onDeleteClick}
                key={reply.id}
              />
            ))}
          </div>
          <textarea
            className="jc-InputArea"
            hidden={isHidden}
            onKeyDown={onInputKeydown}
          />
        </div>
      );
    };

    const CommentWrapper = _CommentWrapper.bind(this);

    return <CommentWrapper comment={this.comment!} />;
  }

  protected _deleteComment(e: React.MouseEvent): void {
    const comments = this._metadata.get('comments');

    if (comments == null) {
      console.warn('comment source has no comments');
      this.dispose();
      return;
    }

    const target = (e.target as HTMLElement).closest('.jc-Comment');
    if (target == null) {
      console.warn("event target isn't descended from .jc-Comment element");
      return;
    }

    const commentList = comments as any as IComment[];
    const commentIndex = commentList.findIndex(c => c.id === this.commentID);

    if (commentIndex === -1) {
      console.warn(
        'comment source does not have comment with id',
        this.commentID
      );
      this.dispose();
      return;
    }

    const comment = commentList[commentIndex];

    if (target.id === comment.id) {
      // deleting main comment
      commentList.splice(commentIndex, 1);
      this._metadata.set('comments', commentList);
      this.dispose();
    } else {
      // deleting reply
      const replyIndex = comment.replies.findIndex(r => r.id === target.id);
      if (replyIndex === -1) {
        console.warn('comment does not have reply with id', target.id);
        return;
      }

      comment.replies.splice(replyIndex, 1);
      commentList[commentIndex] = comment;
      this._metadata.set('comments', commentList);
    }
  }

  get comment(): IComment | undefined {
    console.log('getting comment with id', this.commentID);
    const comments = this._metadata.get('comments');
    if (comments == null) {
      return undefined;
    }

    const commentList = comments as any as IComment[];

    return commentList.find(
      comment => comment.id != null && comment.id === this.commentID
    );
  }

  get target(): T {
    return this._target;
  }

  get identity(): string {
    return this._identity;
  }

  get type(): CommentType | undefined {
    return this.comment?.type;
  }

  get text(): string | undefined {
    return this.comment?.text;
  }

  get replies(): IComment[] | undefined {
    return this.comment?.replies;
  }

  get commentID(): string {
    return this._commentID;
  }

  private _identity: string;
  private _commentID: string;
  private _target: T;
  private _metadata: IObservableJSON;
}

export namespace CommentWidget {
  export interface IOptions<T> {
    identity: string;

    id: string;

    metadata: IObservableJSON;

    target: T;
  }
}
