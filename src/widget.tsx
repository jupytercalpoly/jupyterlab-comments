import { ReactWidget } from '@jupyterlab/apputils';
import * as React from 'react';
import { ellipsesIcon } from '@jupyterlab/ui-components';
import { CommentType, IComment, IIdentity } from './commentformat';
import { IObservableJSON } from '@jupyterlab/observables';
import { UUID } from '@lumino/coreutils';
import { addReply, edit } from './comments';
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
  content: ReactRenderElement;
  onEditClick: React.MouseEventHandler;
  onBodyClick: React.MouseEventHandler;
  onDropdownClick: React.MouseEventHandler;
};

type CommentWrapperProps = {
  comment: IComment;
};

/**
 * A React component that renders a single comment or reply.
 *
 * @param comment - the comment object to render. Note: Replies will
 * not be rendered.
 *
 * @param className - a string that will be used as the className of the
 * container element.
 *
 * @param onBodyClick - a function that will be run when the comment is clicked.
 *
 * @param onDropdownClick - a function that will be run when the comment's
 * dropdown (ellipses) menu is clicked.
 */
function JCComment(props: CommentProps): JSX.Element {
  const {
    comment,
    className,
    content,
    onBodyClick,
    onDropdownClick,
    onEditClick
  } = props;

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
        <ellipsesIcon.react className="jc-Ellipses jc-no-reply" tag="span" />
      </span>
      <br />
      <span className="jc-Time">{comment.time}</span>
      <br />

      {/* the actual content */}
      <div className="jc-ContentContainer jc-no-reply" onClick={onEditClick}>
        {content}
      </div>

      <br />
    </div>
  );
}

/**
 * A ReactWidget that renders a comment and its replies.
 */
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
    let editID: IComment['id'];

    const _CommentWrapper = (props: CommentWrapperProps): JSX.Element => {
      const { comment } = props;
      const [isHidden, setIsHidden] = React.useState(true);
      const [isEditable, setIsEditable] = React.useState(false);

      const onEditClick = (item_id: IComment['id']): void => {
        setIsEditable(true);
        editID = item_id;
      };

      const onBodyClick = (e: React.MouseEvent): void => {
        const target = e.target as HTMLElement;
        const newID = Private.getClickID(target);
        if (newID != null) {
          this._activeID = newID;
        }

        if (target.closest('.jc-no-reply') == null) {
          setIsHidden(!isHidden);
          setIsEditable(false);
        }
      };

      const focusComment = (e: React.MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (target.closest('.jc-no-reply') == null) {
          this.node.focus();
        }
      };

      const onInputKeydown = (e: React.KeyboardEvent): void => {
        if (e.key != 'Enter') {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLDivElement;

        if (!isEditable && !isHidden) {
          const reply: IComment = {
            id: UUID.uuid4(),
            type: 'cell',
            identity: getIdentity(this._awareness),
            replies: [],
            text: target.textContent!,
            time: getCommentTimeString()
          };

          addReply(metadata, reply, commentID);
          target.textContent! = '';
          setIsHidden(true);
        } else {
          edit(metadata, commentID, editID, target.textContent!);
          target.textContent! = '';
          editID = '';
          setIsEditable(false);
        }
      };

      const onDropdownClick = (e: React.MouseEvent): void => {
        this._menu.open(e.pageX, e.pageY);
      };

      if (comment == null) {
        return <div className="jc-MissingComment" />;
      }

      function getContent(c: IComment) {
        let normal = (
          <div className="jc-Body" onClick={onBodyClick}>
            {c.text}
          </div>
        );
        let edit_box = (
          <div className="jc-Body" onClick={onBodyClick}>
            <div
              className="jc-InputArea"
              onKeyDown={onInputKeydown}
              contentEditable={true}
              suppressContentEditableWarning={true}
            >
              {c.text}
            </div>
          </div>
        );
        if (editID == c.id && isEditable) {
          return edit_box;
        } else {
          return normal;
        }
      }

      return (
        <>
          <div className="jc-CommentWithReplies" onClick={focusComment}>
            <JCComment
              comment={comment}
              content={getContent(comment)}
              className="jc-Comment"
              onEditClick={onEditClick.bind(this, comment.id)}
              onBodyClick={onBodyClick}
              onDropdownClick={onDropdownClick}
            />
            <div className="jc-Replies">
              {comment.replies.map(reply => (
                <JCComment
                  comment={reply}
                  content={getContent(reply)}
                  className="jc-Comment jc-Reply"
                  onEditClick={onEditClick.bind(this, reply.id)}
                  onDropdownClick={onDropdownClick}
                  onBodyClick={onBodyClick}
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

  /**
   * The comment object being rendered by the widget.
   */
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

  /**
   * The target of the comment (what is being commented on).
   */
  get target(): T {
    return this._target;
  }

  /**
   * Information about the author of the comment.
   */
  get identity(): IIdentity | undefined {
    return this.comment?.identity;
  }

  /**
   * The type of the comment.
   */
  get type(): CommentType | undefined {
    return this.comment?.type;
  }

  /**
   * The plain body text of the comment.
   */
  get text(): string | undefined {
    return this.comment?.text;
  }

  /**
   * An array of replies to the comment.
   */
  get replies(): IComment[] | undefined {
    return this.comment?.replies;
  }

  /**
   * The ID of the main comment.
   */
  get commentID(): string {
    return this._commentID;
  }

  /**
   * The ID of the last-focused comment or reply.
   */
  get activeID(): string {
    return this._activeID;
  }

  /**
   * The metadata object hosting the comment.
   */
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
