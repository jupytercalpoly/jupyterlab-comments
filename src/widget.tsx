import { ReactWidget } from '@jupyterlab/apputils';
import * as React from 'react';
import { ellipsesIcon } from '@jupyterlab/ui-components';
import { CommentType, IComment, IIdentity } from './commentformat';
import { IObservableJSON } from '@jupyterlab/observables';
import { UUID } from '@lumino/coreutils';
import { addReply } from './comments';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { Menu } from '@lumino/widgets';

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
  onDropdownClick: React.MouseEventHandler;
};

type CommentWrapperProps = {
  comment: IComment;
};

function JCComment(props: CommentProps): JSX.Element {
  const { comment, className, onBodyClick, onDropdownClick } = props;

  return (
    <div className={className || ''} id={comment.id} onClick={onBodyClick}>
      <div className="jc-ProfilePicContainer">
        <div
          className="jc-ProfilePic"
          style={{ backgroundColor: comment.identity.color }}
        />
      </div>
      <span className="jc-Nametag">{comment.identity.name}</span>
      <span onClick={onDropdownClick}>
        <ellipsesIcon.react className="jc-Ellipses" tag="span" />
      </span>
      <br />
      <span className="jc-Time">{comment.time}</span>
      <br />
      <br />
      <p className="jc-Body">{comment.text}</p>
      <br />
    </div>
  );
}

export class CommentWidget<T> extends ReactWidget {
  constructor(options: CommentWidget.IOptions<T>) {
    super();

    const { awareness, id, target, metadata, menu } = options;
    this._awareness = awareness;
    this._commentID = id;
    this._activeID = id;
    this._target = target;
    this._metadata = metadata;
    this._menu = menu;

    this.addClass('jc-CommentWidget');
    this.node.tabIndex = 0;
  }

  render(): ReactRenderElement {
    const metadata = this._metadata;
    const commentID = this.commentID;

    const _CommentWrapper = (props: CommentWrapperProps): JSX.Element => {
      const { comment } = props;
      const [isHidden, setIsHidden] = React.useState(true);

      const onBodyClick = (e: React.MouseEvent): void => {
        const target = e.target as HTMLElement;
        const newID = Private.getClickID(target);
        if (newID != null) {
          this._activeID = newID;
        }

        if (target.closest('.jc-Ellipses') == null) {
          setIsHidden(!isHidden);
        }
      };

      const focusComment = (): void => this.node.focus();

      const onInputKeydown = (e: React.KeyboardEvent): void => {
        if (e.key != 'Enter') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLDivElement;

        const reply: IComment = {
          id: UUID.uuid4(),
          type: 'cell',
          identity: getIdentity(this._awareness),
          replies: [],
          text: target.textContent!,
          time: getCommentTimeString()
        };

        addReply(metadata, reply, commentID);
        target.textContent = '';
        setIsHidden(true);
      };

      const onDropdownClick = (e: React.MouseEvent): void => {
        this._menu.open(e.pageX, e.pageY);
      };

      if (comment == null) {
        return <div className="jc-MissingComment" />;
      }

      return (
        <>
          <div className="jc-CommentWithReplies" onClick={focusComment}>
            <JCComment
              comment={comment}
              className="jc-Comment"
              onBodyClick={onBodyClick}
              onDropdownClick={onDropdownClick}
            />
            <div className="jc-Replies">
              {comment.replies.map(reply => (
                <JCComment
                  comment={reply}
                  className="jc-Comment jc-Reply"
                  onBodyClick={onBodyClick}
                  onDropdownClick={onDropdownClick}
                  key={reply.id}
                />
              ))}
            </div>
          </div>
          <div
            className="jc-InputArea"
            hidden={isHidden}
            onKeyDown={onInputKeydown}
            contentEditable={true}
          />
        </>
      );
    };

    return <_CommentWrapper comment={this.comment!} />;
  }

  get comment(): IComment | undefined {
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

  get activeID(): string {
    return this._activeID;
  }

  get metadata(): IObservableJSON {
    return this._metadata;
  }

  private _awareness: Awareness;
  private _commentID: string;
  private _target: T;
  private _metadata: IObservableJSON;
  private _activeID: string;
  private _menu: Menu;
}

export namespace CommentWidget {
  export interface IOptions<T> {
    awareness: Awareness;

    id: string;

    metadata: IObservableJSON;

    target: T;

    menu: Menu;
  }
}

export namespace Private {
  /**
   * Get the ID of a comment that a target lies within.
   */
  export function getClickID(target: HTMLElement): string | undefined {
    const comment = target.closest('.jc-Comment');
    if (comment == null) {
      return undefined;
    }
    return comment.id;
  }
}
