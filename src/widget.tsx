import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import * as React from 'react';
import { ellipsesIcon } from '@jupyterlab/ui-components';
import {
  IComment,
  IIdentity,
  IReply
} from './commentformat';
import {
  addReply,
  deleteComment,
  deleteReply,
  edit,
  getCommentByID,
  ISharedMetadatedText
} from './comments';
import { Awareness } from 'y-protocols/awareness';
import { getIdentity } from './utils';
import { Menu } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ICellModel } from '@jupyterlab/cells';
import { ACommentFactory } from './factory';

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
  target?: any;
  factory: ACommentFactory;
};

type CommentWithRepliesProps = {
  comment: IComment;
  editID: string;
  className?: string;
  target?: any;
  factory: ACommentFactory;
};

type CommentWrapperProps = {
  commentWidget: CommentWidget<any>;
  className?: string;
};

type ReplyAreaProps = {
  hidden: boolean;
  className?: string;
};

type PreviewProps = {
  comment: IComment;
  target: any;
  factory: ACommentFactory;
};

type ReplyProps = {
  reply: IReply;
  className?: string;
  editable?: boolean;
};

function Jdiv(props: any): JSX.Element {
  return <div {...props}>{props.children}</div>;
}

function Jspan(props: any): JSX.Element {
  return <span {...props}>{props.children}</span>;
}

function JCPreview(props: PreviewProps): JSX.Element {
  const { comment, target, factory } = props;

  // Assuming factory is the proper cellfactory or cellselectionfactory;
  let previewText = factory.getPreviewText(comment, target);

  return (
    <div className="jc-Preview">
      <div className="jc-PreviewBar" />
      <span className="jc-PreviewText">{previewText}</span>
    </div>
  );
}

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
  const target = props.target;
  const factory = props.factory;

  return (
    <Jdiv
      className={'jc-Comment ' + className}
      id={comment.id}
      jcEventArea="other"
    >
      <Jdiv className="jc-ProfilePicContainer">
        <Jdiv
          className="jc-ProfilePic"
          style={{ backgroundColor: comment.identity.color }}
          jcEventArea="user"
        />
      </Jdiv>
      <span className="jc-Nametag">{comment.identity.name}</span>

      <Jspan className="jc-IconContainer" jcEventArea="dropdown">
        <ellipsesIcon.react className="jc-Ellipses" />
      </Jspan>

      <br />

      <span className="jc-Time">{comment.time}</span>

      {target != null && <JCPreview comment={comment} target={target} factory={factory}/>}

      <Jdiv
        className="jc-Body jc-EditInputArea"
        contentEditable={editable}
        suppressContentEditableWarning={true}
        jcEventArea="body"
        onFocus={() => document.execCommand('selectAll', false, undefined)}
      >
        {comment.text}
      </Jdiv>
    </Jdiv>
  );
}

function JCReply(props: ReplyProps): JSX.Element {
  const reply = props.reply;
  const className = props.className ?? '';
  const editable = props.editable;

  return (
    <Jdiv
      className={'jc-Comment jc-Reply ' + className}
      id={reply.id}
      jcEventArea="other"
    >
      <Jdiv className="jc-ProfilePicContainer">
        <Jdiv
          className="jc-ProfilePic"
          style={{ backgroundColor: reply.identity.color }}
          jcEventArea="user"
        />
      </Jdiv>
      <span className="jc-Nametag">{reply.identity.name}</span>

      <Jspan className="jc-IconContainer" jcEventArea="dropdown">
        <ellipsesIcon.react className="jc-Ellipses" />
      </Jspan>

      <br />

      <span className="jc-Time">{reply.time}</span>

      <Jdiv
        className="jc-Body jc-EditInputArea"
        contentEditable={editable}
        suppressContentEditableWarning={true}
        jcEventArea="body"
        onFocus={() => document.execCommand('selectAll', false, undefined)}
      >
        {reply.text}
      </Jdiv>
    </Jdiv>
  );
}

function JCCommentWithReplies(props: CommentWithRepliesProps): JSX.Element {
  const comment = props.comment;
  const className = props.className || '';
  const editID = props.editID;
  const target = props.target;
  const factory = props.factory;

  return (
    <div className={'jc-CommentWithReplies ' + className}>
      <JCComment
        comment={comment}
        editable={editID === comment.id}
        target={target}
        factory={factory}
      />
      <div className={'jc-Replies'}>
        {comment.replies.map(reply => (
          <JCReply
            reply={reply}
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
    <Jdiv
      className={'jc-ReplyInputArea ' + className}
      contentEditable={true}
      hidden={hidden}
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
        target={commentWidget.target}
        factory={commentWidget.factory}
      />
      <JCReplyArea hidden={commentWidget.replyAreaHidden} />
    </div>
  );
}

/**
 * A ReactWidget that renders a comment and its replies.
 */
export class CommentWidget<T = any> extends ReactWidget {
  constructor(options: CommentWidget.IOptions<T>) {
    super();

    const { awareness, id, target, sharedModel, menu, nbTracker, factory } =
      options;
    this._awareness = awareness;
    this._commentID = id;
    this._activeID = id;
    this._target = target;
    this._sharedModel = sharedModel;
    this._menu = menu;
    this._tracker = nbTracker;
    this._factory = factory;

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

    const cellModel = this.target as any as ICellModel;
    const notebook = this._tracker.currentWidget?.content;
    if (notebook == null) {
      return;
    }

    const cell = notebook.widgets.find(cell => cell.model.id === cellModel.id);
    if (cell != null) {
      cell.node.scrollIntoView({ behavior: 'smooth' });
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
    this._setClickFocus(event);
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
    } else if (event.shiftKey) {
      return;
    }

    const target = event.target as HTMLDivElement;
    event.preventDefault();
    event.stopPropagation();

    const reply = ACommentFactory.createReply({
      identity: getIdentity(this._awareness),
      awareness: this._awareness,
      text: target.innerText
    });

    addReply(this.sharedModel, reply, this.commentID);
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
        target.innerText = this.text!;
        this.editID = '';
        target.blur();
        break;
      case 'Enter':
        if (event.shiftKey) {
          break;
        }
        event.preventDefault();
        event.stopPropagation();
        if (target.innerText === '') {
          target.innerText = this.text!;
        } else {
          edit(
            this.sharedModel,
            this.commentID,
            this.activeID,
            target.innerText!
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
      deleteComment(this.sharedModel, this.commentID);
      this.dispose();
    } else {
      deleteReply(this.sharedModel, this.activeID, this.commentID);
    }
  }

  /**
   * The comment object being rendered by the widget.
   */
  get comment(): IComment | undefined {
    return getCommentByID(this.sharedModel, this.commentID);
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
  get type(): string | undefined {
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
  get replies(): IReply[] | undefined {
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
   * The shared model hosting the metadata hosting the comment.
   */
  get sharedModel(): ISharedMetadatedText {
    return this._sharedModel;
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

  get factory(): ACommentFactory{
    return this._factory;
  }

  private _awareness: Awareness;
  private _commentID: string;
  private _target: T;
  private _sharedModel: ISharedMetadatedText;
  private _activeID: string;
  private _menu: Menu;
  private _replyAreaHidden: boolean = true;
  private _editID: string = '';
  private _tracker: INotebookTracker;
  private _factory: ACommentFactory;
  private _renderNeeded: Signal<this, undefined> = new Signal<this, undefined>(
    this
  );
}

export namespace CommentWidget {
  export interface IOptions<T> {
    awareness: Awareness;

    id: string;

    sharedModel: ISharedMetadatedText;

    target: T;

    menu: Menu;

    nbTracker: INotebookTracker;

    factory: ACommentFactory;
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
