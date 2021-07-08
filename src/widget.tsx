import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import * as React from 'react';
import { ellipsesIcon } from '@jupyterlab/ui-components';
import { CommentType, IComment, IIdentity } from './commentformat';
import { IObservableJSON } from '@jupyterlab/observables';
import { UUID } from '@lumino/coreutils';
import { addReply, deleteComment, deleteReply, edit } from './comments';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { Menu } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';

/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type CommentProps = {
  comment: IComment;
  className?: string;
  editable?: boolean;
};

type CommentWithRepliesProps = {
  comment: IComment;
  editID: string;
  className?: string;
};

type CommentWrapperProps = {
  commentWidget: CommentWidget<any>;
  className?: string;
};

type ReplyAreaProps = {
  hidden: boolean;
  className?: string;
};

/**
 * A React component that renders a single comment or reply.
 *
 * @param comment - the comment object to render. Note: Replies will
 * not be rendered.
 *
 * @param className - a string that will be used as the className of the
 * container element.
 */
function JCComment(props: CommentProps): JSX.Element {
  const comment = props.comment;
  const className = props.className || '';
  const editable = props.editable;

  return (
    <div
      className={'jc-Comment ' + className}
      id={comment.id}
      //@ts-ignore (TypeScript doesn't know about custom attributes)
      jcEventArea="other"
    >
      <div className="jc-ProfilePicContainer">
        <div
          className="jc-ProfilePic"
          style={{ backgroundColor: comment.identity.color }}
          //@ts-ignore (TypeScript doesn't know about custom attributes)
          jcEventArea="user"
        />
      </div>
      <span className="jc-Nametag">{comment.identity.name}</span>

      <span
        className="jc-IconContainer"
        //@ts-ignore (TypeScript doesn't know about custom attributes)
        jcEventArea="dropdown"
      >
        <ellipsesIcon.react className="jc-Ellipses" />
      </span>

      <br />

      <span className="jc-Time">{comment.time}</span>

      <br />

      <div
        className="jc-Body jc-EditInputArea"
        contentEditable={editable}
        suppressContentEditableWarning={true}
        //@ts-ignore (TypeScript doesn't know about custom attributes)
        jcEventArea="body"
        onFocus={() => document.execCommand('selectAll', false, undefined)}
      >
        {comment.text}
      </div>

      <br />
    </div>
  );
}

function JCCommentWithReplies(props: CommentWithRepliesProps): JSX.Element {
  const comment = props.comment;
  const className = props.className || '';
  const editID = props.editID;

  return (
    <div className={'jc-CommentWithReplies ' + className}>
      <JCComment comment={comment} editable={editID === comment.id} />
      <div className={'jc-Replies'}>
        {comment.replies.map(reply => (
          <JCComment
            comment={reply}
            className="jc-Reply"
            editable={editID === reply.id}
            key={reply.id}
          />
        ))}
      </div>
    </div>
  );
}

function JCReplyArea(props: ReplyAreaProps): JSX.Element {
  const hidden = props.hidden;
  const className = props.className || '';

  return (
    <div
      className={'jc-ReplyInputArea ' + className}
      contentEditable={true}
      hidden={hidden}
      //@ts-ignore (TypeScript doesn't know about custom attributes)
      jcEventArea="reply"
      onFocus={() => document.execCommand('selectAll', false, undefined)}
      data-placeholder="reply"
    />
  );
}

function JCCommentWrapper(props: CommentWrapperProps): JSX.Element {
  const commentWidget = props.commentWidget;
  const className = props.className || '';

  const onClick = commentWidget.handleEvent.bind(commentWidget);
  const onKeyDown = onClick;

  return (
    <div className={className} onClick={onClick} onKeyDown={onKeyDown}>
      <JCCommentWithReplies
        comment={commentWidget.comment!}
        editID={commentWidget.editID}
      />
      <JCReplyArea hidden={commentWidget.replyAreaHidden} />
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

  handleEvent(event: React.SyntheticEvent): void {
    switch (event.type) {
      case 'click':
        this._handleClick(event as React.MouseEvent);
        break;
      case 'keydown':
        this._handleKeydown(event as React.KeyboardEvent);
        break;
    }
  }

  /**
   * Handle `click` events on the widget.
   */
  private _handleClick(event: React.MouseEvent): void {
    switch (CommentWidget.getEventArea(event)) {
      case 'body':
        this._handleBodyClick(event);
        break;
      case 'dropdown':
        this._handleDropdownClick(event);
        break;
      case 'reply':
        this._handleReplyClick(event);
        break;
      case 'user':
        this._handleUserClick(event);
        break;
      case 'other':
        this._handleOtherClick(event);
        break;
      case 'none':
        break;
      default:
        break;
    }
  }

  /**
   * Sets the widget focus and active id on click.
   *
   * A building block of other click handlers.
   */
  private _setClickFocus(event: React.MouseEvent): void {
    const oldActive = document.activeElement;
    const target = event.target as HTMLElement;
    const clickID = Private.getClickID(target);

    if (clickID != null) {
      this.activeID = clickID;
    }

    if (oldActive == null || !this.node.contains(oldActive)) {
      this.node.focus();
    }
  }

  /**
   * Handle a click on the dropdown (ellipses) area of a widget.
   */
  private _handleDropdownClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    this._menu.open(event.pageX, event.pageY);
  }

  /**
   * Handle a click on the user icon area of a widget.
   *
   * ### Note
   * Currently just acts as an `other` click.
   */
  private _handleUserClick(event: React.MouseEvent): void {
    console.log('clicked user photo!');
    this._handleOtherClick(event);
  }

  /**
   * Handle a click on the widget but not on a specific area.
   */
  private _handleOtherClick(event: React.MouseEvent): void {
    this._setClickFocus(event);

    const target = event.target as HTMLElement;
    const clickID = Private.getClickID(target);
    if (clickID == null) {
      return;
    }

    this.editID = '';

    if (this.replyAreaHidden) {
      this.revealReply();
    } else {
      this.replyAreaHidden = true;
    }
  }

  /**
   * Handle a click on the widget's reply area.
   */
  private _handleReplyClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
  }

  /**
   * Handle a click on the widget's body.
   */
  private _handleBodyClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    this.editActive();
  }

  /**
   * Handle `keydown` events on the widget.
   */
  private _handleKeydown(event: React.KeyboardEvent): void {
    switch (CommentWidget.getEventArea(event)) {
      case 'reply':
        this._handleReplyKeydown(event);
        break;
      case 'body':
        this._handleBodyKeydown(event);
        break;
      default:
        break;
    }
  }

  /**
   * Handle a keydown on the widget's reply area.
   */
  private _handleReplyKeydown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.replyAreaHidden = true;
      return;
    } else if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLDivElement;

    const reply: IComment = {
      id: UUID.uuid4(),
      type: 'cell',
      identity: getIdentity(this._awareness),
      replies: [],
      text: target.textContent!,
      time: getCommentTimeString()
    };

    addReply(this.metadata, reply, this.commentID);
    target.textContent = '';
    this.replyAreaHidden = true;
  }

  /**
   * Handle a keydown on the widget's body.
   */
  private _handleBodyKeydown(event: React.KeyboardEvent): void {
    if (this.editID === '') {
      return;
    }

    const target = event.target as HTMLDivElement;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        target.textContent = this.text!;
        this.editID = '';
        target.blur();
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (target.textContent === '') {
          target.textContent = this.text!;
        } else {
          edit(
            this.metadata,
            this.commentID,
            this.activeID,
            target.textContent!
          );
        }
        this.editID = '';
        target.blur();
        break;
      default:
        break;
    }
  }

  render(): ReactRenderElement {
    return (
      <UseSignal signal={this.renderNeeded}>
        {() => <JCCommentWrapper commentWidget={this} />}
      </UseSignal>
    );
  }

  /**
   * Open the widget's reply area and focus on it.
   */
  revealReply(): void {
    if (this.isAttached === false) {
      return;
    }

    this.replyAreaHidden = false;
    const nodes = this.node.getElementsByClassName(
      'jc-ReplyInputArea'
    ) as HTMLCollectionOf<HTMLDivElement>;
    nodes[0].focus();
  }

  /**
   * Select the body area of the currently active comment for editing.
   */
  editActive(): void {
    if (this.isAttached === false) {
      return;
    }

    const comment = document.getElementById(this.activeID);
    if (comment == null) {
      return;
    }

    this.editID = this.activeID;
    const elements = comment.getElementsByClassName(
      'jc-Body'
    ) as HTMLCollectionOf<HTMLDivElement>;
    const target = elements[0];
    target.focus();
  }

  /**
   * Delete the currently active comment or reply.
   *
   * ### Notes
   * If the base comment is deleted, the widget will be disposed.
   */
  deleteActive(): void {
    if (this.isAttached === false) {
      return;
    }

    if (this.activeID === this.commentID) {
      deleteComment(this.metadata, this.commentID);
      this.dispose();
    } else {
      deleteReply(this.metadata, this.activeID, this.commentID);
    }
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
  set activeID(newVal: string) {
    if (newVal !== this.activeID) {
      this._activeID = newVal;
      this._renderNeeded.emit(undefined);
    }
  }

  /**
   * The metadata object hosting the comment.
   */
  get metadata(): IObservableJSON {
    return this._metadata;
  }

  /**
   * Whether to show the reply area or not
   */
  get replyAreaHidden(): boolean {
    return this._replyAreaHidden;
  }
  set replyAreaHidden(newVal: boolean) {
    if (newVal !== this.replyAreaHidden) {
      this._replyAreaHidden = newVal;
      this._renderNeeded.emit(undefined);
    }
  }

  /**
   * A signal emitted when a React re-render is required.
   */
  get renderNeeded(): Signal<this, undefined> {
    return this._renderNeeded;
  }

  /**
   * The ID of the managed comment being edited, or the empty string if none.
   */
  get editID(): string {
    return this._editID;
  }
  set editID(newVal: string) {
    if (this.editID !== newVal) {
      this._editID = newVal;
      this._renderNeeded.emit(undefined);
    }
  }

  private _awareness: Awareness;
  private _commentID: string;
  private _target: T;
  private _metadata: IObservableJSON;
  private _activeID: string;
  private _menu: Menu;
  private _replyAreaHidden: boolean = true;
  private _editID: string = '';
  private _renderNeeded: Signal<this, undefined> = new Signal<this, undefined>(
    this
  );
}

export namespace CommentWidget {
  export interface IOptions<T> {
    awareness: Awareness;

    id: string;

    metadata: IObservableJSON;

    target: T;

    menu: Menu;
  }

  /**
   * A type referring to an area of a `CommentWidget`
   */
  export type EventArea =
    | 'dropdown'
    | 'body'
    | 'user'
    | 'reply'
    | 'other'
    | 'none';

  /**
   * Whether a string is a type of `EventArea`
   */
  export function isEventArea(input: string): input is EventArea {
    return ['dropdown', 'body', 'user', 'reply', 'other', 'none'].includes(
      input
    );
  }

  /**
   * Gets the `EventArea` of an event on a `CommentWidget`.
   *
   * Returns `none` if the event has no ancestors with the `jcEventArea` attribute,
   * and returns `other` if `jcEventArea` is set but the value is unrecognized.
   *
   * ### Notes
   * Also sets the target of the event to the first ancestor of the target with
   * the `jcEventArea` attribute set.
   */
  export function getEventArea(event: React.SyntheticEvent): EventArea {
    const target = event.target as HTMLElement;
    const areaElement = target.closest('[jcEventArea]');
    if (areaElement == null) {
      return 'none';
    }

    const area = areaElement.getAttribute('jcEventArea');
    if (area == null) {
      return 'other';
    }

    event.target = areaElement;

    return isEventArea(area) ? area : 'other';
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
