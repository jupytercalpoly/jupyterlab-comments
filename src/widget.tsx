import { ReactWidget } from '@jupyterlab/apputils';
import * as React from 'react';
import { closeIcon, editIcon } from '@jupyterlab/ui-components';
import { CommentType, IComment, IIdentity } from './commentformat';
import { IObservableJSON } from '@jupyterlab/observables';
import { UUID } from '@lumino/coreutils';
import { addReply, deleteComment, deleteReply, editComment } from './comments';
import { Awareness } from 'y-protocols/awareness';
import { getIdentity } from './utils';

/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type CommentProps = {
  comment: IComment;
  className: string;
  content: ReactRenderElement; 
  onDeleteClick: React.MouseEventHandler;
  onEditClick: React.MouseEventHandler;
};

type CommentWrapperProps = {
  comment: IComment;
};

function JCComment(props: CommentProps): JSX.Element {
  const {
    comment,
    className,
    content,
    onEditClick,
    onDeleteClick,
  } = props;

  return (
    <div className={className || ''} id={comment.id}>
      <div className="jc-ProfilePicContainer">
        <div
          className="jc-ProfilePic"
          style={{ backgroundColor: comment.identity.color }}
        />
      </div>
      <span className="jc-Nametag">{comment.identity.name}</span>
      <br />
      <span className="jc-Time">{comment.time}</span>
      <br />
      <br />
      <p className="jc-Time">{comment.time}</p>

      {/* the actual content */}
      {content}

      <br />
      <button
        className="jc-DeleteButton jp-Button bp3-button bp3-minimal"
        onClick={onDeleteClick}
      >
        <closeIcon.react />
      </button>
      <button
        className="jc-EditButton jp-Button bp3-button bp3-minimal"
        onClick={onEditClick}
      >
        <editIcon.react />
      </button>
    </div>
  );
}

export class CommentWidget<T> extends ReactWidget {
  constructor(options: CommentWidget.IOptions<T>) {
    super();

    const { awareness, id, target, metadata } = options;
    this._awareness = awareness;
    this._commentID = id;
    this._target = target;
    this._metadata = metadata;
  }

  render(): ReactRenderElement {
    const metadata = this._metadata;
    const commentID = this.commentID;

    const _CommentWrapper = (props: CommentWrapperProps): JSX.Element => {
      const { comment } = props;
      const [replies, setReplies] = React.useState(comment.replies);
      const [isHidden, setIsHidden] = React.useState(true);
      const [isEditable, setIsEditable] = React.useState(false);
      const onBodyClick = (): void => setIsHidden(!isHidden);
      const onEditClick = (): void => setIsEditable(!isEditable);
      const onDeleteClick = (): void => {
        deleteComment(metadata, commentID);
        this.dispose();
      };
      const onDeleteReplyClick = (item_id: IComment['id']): void => {
        const data = replies.filter(r => r.id !== item_id);
        deleteReply(metadata, item_id, commentID);
        setReplies(data);
      };

      const onInputKeydown = (e: React.KeyboardEvent): void => {
        if (e.key != 'Enter') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLDivElement;

        if (!isEditable && !isHidden){
          console.log(target.textContent)
          const reply: IComment = {
            id: UUID.uuid4(),
            type: 'cell',
            identity: getIdentity(this._awareness),
            replies: [],
            text: target.textContent!,
            time: new Date(new Date().getTime()).toLocaleString()
          };

          addReply(metadata, reply, commentID);
          target.textContent! = '';
          setIsHidden(true);
          console.log('hihih')
        }
        else {
          editComment(metadata, commentID, target.textContent!)
          target.textContent! = '';
          setIsEditable(!isEditable);
          console.log(target.textContent)
        }
      };

      if (comment == null) {
        return <div className="jc-MissingComment" />;
      }

      function getContent(c: IComment): ReactRenderElement{
        if (!isEditable ) {
          return  (
            <p className="jc-Body" onClick={onBodyClick}>
              {c.text}
            </p>
          );
        } else {
          return (
            <p className="jc-Body" onClick={onBodyClick}>
              <div
                className="jc-InputArea"
                onKeyDown={onInputKeydown}
                contentEditable={true}
              >
                {c.text}
              </div>
            </p>
          );
        }

      }

      return (
        <div className="jc-CommentWithReplies">
          <JCComment
            comment={comment}
            content={getContent(comment)}
            className="jc-Comment"
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick.bind(this)}
          />
          <div className="jc-Replies">
            {replies.map(reply => (
              <JCComment
                comment={reply}
                content={getContent(reply)}
                className="jc-Comment jc-Reply"
                onEditClick={onEditClick}
                onDeleteClick={onDeleteReplyClick.bind(this, reply.id)}
                key={reply.id}
              />
            ))}
          </div>
          <div
            className="jc-InputArea"
            hidden={isHidden}
            onKeyDown={onInputKeydown}
            contentEditable={true}
          />
        </div>
      );
    };

    return <_CommentWrapper comment={this.comment!} />;
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

  get identity(): IIdentity | undefined {
    return this.comment?.identity;
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

  private _awareness: Awareness;
  private _commentID: string;
  private _target: T;
  private _metadata: IObservableJSON;
}

export namespace CommentWidget {
  export interface IOptions<T> {
    awareness: Awareness;

    id: string;

    metadata: IObservableJSON;

    target: T;
  }
}
