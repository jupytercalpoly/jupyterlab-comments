import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import * as React from 'react';
import { ellipsesIcon } from '@jupyterlab/ui-components';
import { IComment, IIdentity, IReply } from './commentformat';
import { getIdentity } from './utils';
import { Menu, Panel } from '@lumino/widgets';
import { ISignal, Signal } from '@lumino/signaling';
import { ACommentFactory } from './factory';
import { CommentFileModel } from './model';
import { Context } from '@jupyterlab/docregistry';
import { Message } from '@lumino/messaging';
import {
  IRenderMime,
  IRenderMimeRegistry,
  renderMarkdown
} from '@jupyterlab/rendermime';
import { PartialJSONValue } from '@lumino/coreutils';
import { UserIcons } from './icons';

/**
 * This type comes from @jupyterlab/apputils/vdom.ts but isn't exported.
 */
type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

type JMarkdownRendererProps = {
  text: string;
  registry: IRenderMimeRegistry;
  isAttached: boolean;
};

type SubmitButtonsProps = {
  hidden: boolean | undefined;
};

type ReactMarkdownRendererProps = {
  source: string;
  latexTypesetter: IRenderMime.ILatexTypesetter | null;
  linkHandler: IRenderMime.ILinkHandler | null;
  resolver: IRenderMime.IResolver | null;
  sanitizer: IRenderMime.ISanitizer;
  shouldTypeset: boolean;
};

type CommentProps = {
  renderer: IRenderMimeRegistry;
  comment: IComment;
  className?: string;
  editable?: boolean;
  target?: any;
  factory: ACommentFactory;
  isAttached: boolean;
};

type CommentWithRepliesProps = {
  renderer: IRenderMimeRegistry;
  isAttached: boolean;
  collapsed: boolean;
  comment: IComment;
  editID: string;
  activeID: string;
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
  renderer: IRenderMimeRegistry;
  isAttached: boolean;
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

  let previewText = factory.getPreviewText(comment, target);

  return (
    <div className="jc-Preview">
      <div className="jc-PreviewBar" />
      <span className="jc-PreviewText">{previewText}</span>
    </div>
  );
}

/**
 * Generalizable React Component that hooks into the markdown renderer that jupyterlab provides
 */ 

function ReactMarkdownRenderer(props: ReactMarkdownRendererProps): JSX.Element {
  const {
    source,
    latexTypesetter,
    linkHandler,
    resolver,
    sanitizer,
    shouldTypeset
  } = props;
  let node: HTMLElement = document.createElement('div');
  const [renderElement, SetRenderElement] = React.useState(<div></div>);
  React.useEffect(() => {
    const markdownRender = async () => {
      await renderMarkdown({
        host: node as HTMLElement,
        trusted: false,
        source,
        latexTypesetter,
        linkHandler,
        resolver,
        sanitizer,
        shouldTypeset
      });
      SetRenderElement(
        <div
          className="jc-MarkdownBody"
          dangerouslySetInnerHTML={{
            __html: (node as HTMLElement).innerHTML
          }}
        ></div>
      );
    };
    void markdownRender();
  }, []);
  return renderElement;
}

/**
 * JMarkdownRender calls the generalizable ReactMarkdownRenderer for our implementation
 */

function JMarkdownRenderer(props: JMarkdownRendererProps): JSX.Element {
  const { registry, isAttached, text } = props;
  return (
    <ReactMarkdownRenderer
      source={text}
      latexTypesetter={registry.latexTypesetter}
      linkHandler={registry.linkHandler}
      resolver={registry.resolver}
      sanitizer={registry.sanitizer}
      shouldTypeset={isAttached}
    />
  );
}

/**
 * SubmitButtons returns the set of buttons (submit and cancel) that a comment/reply uses to take in input
 */

function SubmitButtons(props: SubmitButtonsProps): JSX.Element {
  const { hidden } = props;
  return (
    <Jdiv hidden={hidden} className="jc-SubmitButtons">
      <Jdiv hidden={hidden} className="jc-SubmitButton" jcEventArea="submit">
        Submit
      </Jdiv>
      <Jdiv hidden={hidden} className="jc-CancelButton" jcEventArea="cancel">
        Cancel
      </Jdiv>
    </Jdiv>
  );
}

function JCComment(props: CommentProps): JSX.Element {
  const comment = props.comment;
  const className = props.className || '';
  const editable = props.editable;
  const target = props.target;
  const factory = props.factory;
  const icon = UserIcons[comment.identity.icon] ?? UserIcons[0];
  const renderer = props.renderer;
  const isAttached = props.isAttached;

  return (
    <Jdiv
      className={'jc-Comment jc-mod-focus-border' + className}
      id={comment.id}
      jcEventArea="other"
    >
      <Jdiv className="jc-CommentProfilePicContainer">
        <Jdiv
          className="jc-CommentProfilePic"
          style={{ backgroundColor: comment.identity.color }}
          jcEventArea="user"
        >
          <icon.react className="jc-MoonIcon" />
        </Jdiv>
      </Jdiv>
      <span className="jc-Nametag">{comment.identity.name}</span>

      <Jspan className="jc-IconContainer" jcEventArea="dropdown">
        <ellipsesIcon.react className="jc-Ellipses" />
      </Jspan>

      <br />

      <span className="jc-Time">{comment.time}</span>

      {target != null && (
        <JCPreview comment={comment} target={target} factory={factory} />
      )}

      <Jdiv
        className="jc-Body"
        contentEditable={editable}
        suppressContentEditableWarning={true}
        jcEventArea="body"
        onFocus={(event: React.MouseEvent) => {
          const e = event.target as HTMLElement;
          e.innerHTML = `<p>${comment.text}</p>`;
          document.execCommand('selectAll', false, undefined);
        }}
      >
        <JMarkdownRenderer
          text={comment.text}
          registry={renderer}
          isAttached={isAttached}
        />
      </Jdiv>
      <SubmitButtons hidden={!editable} />
    </Jdiv>
  );
}

function JCReply(props: ReplyProps): JSX.Element {
  const reply = props.reply;
  const className = props.className ?? '';
  const editable = props.editable;
  const icon = UserIcons[reply.identity.icon] ?? UserIcons[0];
  const renderer = props.renderer;
  const isAttached = props.isAttached;

  return (
    <Jdiv
      className={'jc-Comment jc-Reply jc-mod-focus-border' + className}
      id={reply.id}
      jcEventArea="other"
    >
      <Jdiv className="jc-ReplyPicContainer">
        <Jdiv
          className="jc-ReplyPic"
          style={{ backgroundColor: reply.identity.color }}
          jcEventArea="user"
        >
          <icon.react className="jc-MoonIcon" />
        </Jdiv>
      </Jdiv>
      <span className="jc-Nametag">{reply.identity.name}</span>

      <Jspan className="jc-IconContainer" jcEventArea="dropdown">
        <ellipsesIcon.react className="jc-Ellipses" />
      </Jspan>

      <br />

      <div className="jc-ReplySpacer" />

      <Jdiv
        className="jc-Body"
        contentEditable={editable}
        suppressContentEditableWarning={true}
        jcEventArea="body"
        onFocus={(e: React.MouseEvent) => {
          (e.target as HTMLElement).innerHTML = `<p>${reply.text}</p>`;
          document.execCommand('selectAll', false, undefined);
        }}
      >
        <JMarkdownRenderer
          text={reply.text}
          registry={renderer}
          isAttached={isAttached}
        />
      </Jdiv>
      <SubmitButtons hidden={!editable} />
    </Jdiv>
  );
}

function JCCommentWithReplies(props: CommentWithRepliesProps): JSX.Element {
  const comment = props.comment;
  const className = props.className || '';
  const editID = props.editID;
  const target = props.target;
  const factory = props.factory;
  const collapsed = props.collapsed;
  const renderer = props.renderer;
  const isAttached = props.isAttached;

  let RepliesComponent = (): JSX.Element => {
    if (!collapsed || comment.replies.length < 4) {
      return (
        <>
          <JCComment
            comment={comment}
            isAttached={isAttached}
            editable={editID === comment.id}
            renderer={renderer}
            target={target}
            factory={factory}
          />
          <div className={'jc-Replies'}>
            {comment.replies.map(reply => (
              <JCReply
                reply={reply}
                isAttached={isAttached}
                editable={editID === reply.id}
                renderer={renderer}
                key={reply.id}
              />
            ))}
          </div>
        </>
      );
    } else {
      return (
        <>
          <JCComment
            comment={comment}
            isAttached={isAttached}
            editable={editID === comment.id}
            renderer={renderer}
            target={target}
            factory={factory}
          />
          <div className={'jc-Replies'}>
            <Jdiv
              className="jc-Replies-breaker jc-mod-focus-border"
              jcEventArea="collapser"
            >
              <div className="jc-Replies-breaker-left">expand thread</div>
              <div className="jc-RepliesSpacer" />
              <div className="jc-Replies-breaker-right">
                <hr />
                <hr />
                <div className="jc-Replies-breaker-number jc-mod-focus-border">
                  {comment.replies.length - 1}
                </div>
              </div>
            </Jdiv>
            <JCReply
              reply={comment.replies[comment.replies.length - 1]}
              editable={
                editID === comment.replies[comment.replies.length - 1].id
              }
              isAttached={isAttached}
              renderer={renderer}
              key={comment.replies[comment.replies.length - 1].id}
            />
          </div>
        </>
      );
    }
  };

  return (
    <Jdiv className={'jc-CommentWithReplies ' + className}>
      <RepliesComponent />
    </Jdiv>
  );
}

function JCReplyArea(props: ReplyAreaProps): JSX.Element {
  const hidden = props.hidden;
  const className = props.className || '';

  return (
    <div hidden={hidden}>
      <Jdiv
        className={'jc-ReplyInputArea jc-mod-focus-border' + className}
        contentEditable={true}
        jcEventArea="reply"
        onFocus={() => document.execCommand('selectAll', false, undefined)}
        data-placeholder="reply"
      />
      <SubmitButtons hidden={hidden} />
    </div>
  );
}

function JCCommentWrapper(props: CommentWrapperProps): JSX.Element {
  const commentWidget = props.commentWidget;
  const className = props.className || '';

  const eventHandler = commentWidget.handleEvent.bind(commentWidget);

  const comment = commentWidget.comment;
  if (comment == null) {
    return <div className="jc-Error" />;
  }
  return (
    <div className={className} onClick={eventHandler} onKeyDown={eventHandler}>
      <JCCommentWithReplies
        isAttached={commentWidget.isAttached}
        comment={comment}
        renderer={commentWidget.renderer}
        editID={commentWidget.editID}
        activeID={commentWidget.activeID}
        target={commentWidget.target}
        factory={commentWidget.factory}
        collapsed={commentWidget.collapsed}
      />
      <JCReplyArea hidden={commentWidget.replyAreaHidden} />
    </div>
  );
}

export interface ICommentWidget<T> {
  revealReply: () => void;
  openEditActive: () => void;
  editActive: (text: string) => void;
  deleteActive: () => void;
  comment: IComment | undefined;
  target: T;
  replies: IReply[] | undefined;
  commentID: string;
  identity: IIdentity | undefined;
  text: string | undefined;
  type: string | undefined;
  menu: Menu | undefined;
  replyAreaHidden: boolean;
  activeID: string;
  renderer: IRenderMimeRegistry;
  editID: string;
  factory: ACommentFactory;
  renderNeeded: ISignal<this, undefined>;
  handleEvent: (event: React.SyntheticEvent | Event) => void;
  collapsed: boolean;
}

/**
 * A React widget that can render a comment and its replies.
 */
export class CommentWidget<T> extends ReactWidget implements ICommentWidget<T> {
  constructor(options: CommentWidget.IOptions<T>) {
    super();

    const { id, target, model, factory } = options;
    this._commentID = id;
    this._activeID = id;
    this._target = target;
    this._factory = factory;
    this._model = model;

    this.id = id;

    this.addClass('jc-CommentWidget');
    this.node.tabIndex = 0;
  }

  handleEvent(event: React.SyntheticEvent | Event): void {
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
  protected _handleClick(event: React.MouseEvent): void {
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
      case 'collapser':
        this._handleCollapserClick(event);
        break;
      case 'submit':
        this._handleSubmitClick(event);
        break;
      case 'cancel':
        this._handleCancelClick(event);
        break;
      case 'none':
        break;
      default:
        break;
    }
  }

  private _handleCollapserClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    this.collapsed = false;
    this.revealReply();
  }

  /**
   * Collapses and hides the reply area of other comment widgets in the same panel.
   */
  private _collapseOtherComments(): void {
    const parent = this.parent;
    if (parent == null) {
      return;
    }

    const commentFileWidget = parent as CommentFileWidget;
    if (commentFileWidget.expandedCommentID === this.id) {
      return;
    }

    const widgets = commentFileWidget.widgets as CommentWidget<any>[];
    widgets.forEach(widget => {
      if (widget.id !== this.id) {
        widget.collapsed = true;
        widget.replyAreaHidden = true;
        widget.editID = '';
      }
    });

    commentFileWidget.expandedCommentID = this.id;
  }

  /**
   * Scrolls to the comment's target, if it exists
   */
  private _scrollToTarget(): void {
    const element = this.factory.getElement(this.comment!);
    if (element != null) {
      element.scrollIntoView({ behavior: 'smooth' });
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

    this._collapseOtherComments();
  }

  /**
   * Handle a click on the submit button when commenting.
   */
  protected _handleSubmitClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    const target = event.target as HTMLDivElement;
    event.preventDefault();
    event.stopPropagation();
    const element = target.parentNode!.previousSibling as HTMLDivElement;

    if (element == null) {
      return;
    }

    // Code to be added for the change in color when inactive
    // if (element.textContent == ''){
    //   target.className = 'jc-SubmitButtonInactive'
    //   return;
    // }
    if (element.classList.contains('jc-ReplyInputArea')) {
      //  reply
      if (element.innerText == ''){
        return;
      }
      this.model.addReply(
        {
          identity: getIdentity(this.model.awareness),
          text: element.innerText
        },
        this.commentID
      );
      this.editID = '';
      element.textContent = '';
      this.replyAreaHidden = true;
      return;
    }

    if (element.innerText === '') {
      element.innerText = this.text!;
    } else {
      this.editActive(element.innerText);
    }
    this.editID = '';
  }

  /**
   * Handle a click on the cancel button when commenting.
   */
  protected _handleCancelClick(event: React.MouseEvent): void {
    this._setClickFocus(event);

    const target = event.target as HTMLDivElement;
    event.preventDefault();
    event.stopPropagation();
    const element = target.parentNode!.previousSibling as HTMLDivElement;
    if (element == null) {
      return;
    }

    if (element.classList.contains('jc-ReplyInputArea')) {
      this.replyAreaHidden = true;
    }
    this.editID = '';
    element.blur();
  }

  /**
   * Handle a click on the dropdown (ellipses) area of a widget.
   */
  protected _handleDropdownClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    const menu = this.menu;
    if (menu != null) {
      menu.open(event.pageX, event.pageY);
    }
  }

  /**
   * Handle a click on the user icon area of a widget.
   *
   * ### Note
   * Currently just acts as an `other` click.
   */
  protected _handleUserClick(event: React.MouseEvent): void {
    console.log('clicked user photo!');
    this._setClickFocus(event);
    this._scrollToTarget();
  }

  /**
   * Handle a click on the widget but not on a specific area.
   */
  protected _handleOtherClick(event: React.MouseEvent): void {
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

    this._scrollToTarget();
  }

  /**
   * Handle a click on the widget's reply area.
   */
  protected _handleReplyClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    this._scrollToTarget();
  }

  /**
   * Handle a click on the widget's body.
   */
  protected _handleBodyClick(event: React.MouseEvent): void {
    this._setClickFocus(event);
    this._scrollToTarget(
  }

  /**
   * Handle `keydown` events on the widget.
   */
  protected _handleKeydown(event: React.KeyboardEvent): void {
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
  protected _handleReplyKeydown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.replyAreaHidden = true;
      return;
    } else if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertHTML', false, '&#009');
      return;
    } else if (event.key !== 'Enter') {
      return;
    } else if (event.shiftKey) {
      const target = event.target as HTMLDivElement;
      event.preventDefault();
      event.stopPropagation();
      if (target.innerText == ''){
        return;
      }

      this.model.addReply(
        {
          identity: getIdentity(this.model.awareness),
          text: target.innerText
        },
        this.commentID
      );

      this.editID = ''
      target.textContent = '';
      this.replyAreaHidden = true;
    }
  }

  /**
   * Handle a keydown on the widget's body.
   */
  protected _handleBodyKeydown(event: React.KeyboardEvent): void {
    if (this.editID === '') {
      return;
    }

    const target = event.target as HTMLDivElement;

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        document.execCommand('insertHTML', false, '&#009');
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        target.innerText = this.text!;
        this.editID = '';
        target.blur();
        break;
      case 'Enter':
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          if (target.innerText === '') {
            target.innerText = this.text!;
          } else {
            this.editActive(target.innerText);
          }
          this.editID = '';
          target.blur();
        }
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
  openEditActive(): void {
    if (this.isAttached === false) {
      return;
    }

    this.editID = this.activeID;
    const comment = document.getElementById(this.activeID);
    if (comment == null) {
      return;
    }

    const elements = comment.getElementsByClassName(
      'jc-Body'
    ) as HTMLCollectionOf<HTMLDivElement>;
    const target = elements[0];
    target.focus();
  }

  editActive(text: string): void {
    if (this.activeID === this.commentID) {
      this.model.editComment({ text }, this.commentID);
    } else {
      this.model.editReply({ text }, this.activeID, this.commentID);
    }
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
      this.model.deleteComment(this.commentID);
      this.dispose();
    } else {
      this.model.deleteReply(this.activeID, this.commentID);
    }
  }

  /**
   * The comment object being rendered by the widget.
   */
  get comment(): IComment | undefined {
    return this.model.getComment(this.commentID)?.comment;
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

  get model(): CommentFileModel {
    return this._model;
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

  get collapsed(): boolean {
    return this._collapsed;
  }
  set collapsed(newVal: boolean) {
    if (newVal !== this.collapsed) {
      this._collapsed = newVal;
      this._renderNeeded.emit(undefined);
    }
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

  get factory(): ACommentFactory {
    return this._factory;
  }

  get menu(): Menu | undefined {
    return this.model.commentMenu;
  }

  get renderer(): IRenderMimeRegistry {
    return (this.parent as CommentFileWidget).renderer;
  }

  private _model: CommentFileModel;
  private _commentID: string;
  private _target: T;
  private _activeID: string;
  private _replyAreaHidden: boolean = true;
  private _editID: string = '';
  private _factory: ACommentFactory;
  private _renderNeeded: Signal<this, undefined> = new Signal<this, undefined>(
    this
  );
  private _collapsed: boolean = true;
}

export namespace CommentWidget {
  export interface IOptions<T> {
    id: string;
    model: CommentFileModel;
    target: T;
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
    | 'none'
    | 'collapser'
    | 'submit'
    | 'cancel';

  /**
   * Whether a string is a type of `EventArea`
   */
  export function isEventArea(input: string): input is EventArea {
    return [
      'dropdown',
      'body',
      'user',
      'reply',
      'other',
      'collapser',
      'submit',
      'cancel'
    ].includes(input);
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

export namespace MockCommentWidget {
  export interface IOptions<T> {
    model: CommentFileModel;
    factory: ACommentFactory;
    target: T;
    comment: IComment;
  }
}

export class MockCommentWidget<T> extends CommentWidget<T> {
  constructor(options: MockCommentWidget.IOptions<T>) {
    super({ ...options, id: options.comment.id });

    const comment = options.comment;

    this._comment = comment;

    const commands = this.model.commentMenu?.commands;
    if (commands == null) {
      return;
    }

    this._menu = new Menu({ commands });
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.openEditActive();
  }

  protected onAfterDetach(msg: Message): void {
    super.onAfterDetach(msg);
  }

  populate(text: string): void {
    let index = 0;
    let node = this.node as ChildNode;
    while (node.previousSibling != null) {
      index++;
      node = node.previousSibling;
    }

    this.hide();

    const { target, identity, type } = this.comment;

    this.model.insertComment(
      {
        text,
        identity,
        type,
        target
      },
      index
    );

    this.dispose();
  }
  protected _handleSubmitClick(event: React.MouseEvent): void {
    if (this.editID == '') {
      return;
    }
    const target = event.target as HTMLDivElement;
    event.preventDefault();
    event.stopPropagation();
    console.log(target.parentElement);
    console.log(target.parentNode?.previousSibling);
    const element = target.parentNode!.previousSibling as HTMLDivElement;

    if (element == null) {
      return;
    }
    if (element.innerText === '') {
      this.dispose();
    } else {
      this.populate(element.innerText);
    }
    this.editID = '';
  }

  /**
   * Handle a click on the cancel button when commenting.
   */
  protected _handleCancelClick(event: React.MouseEvent): void {
    this.dispose();
  }

  protected _handleBodyKeydown(event: React.KeyboardEvent): void {
    if (this.editID === '') {
      return;
    }
    const target = event.target as HTMLDivElement;

    switch (event.key) {
      case 'Escape':
        this.dispose();
        break;
      case 'Enter':
        if (event.shiftKey) {
          if (target.innerText === ''){
            this.dispose()
          }
          this.populate(target.innerText);
        }
        break;
      default:
        break;
    }
  }

  get comment(): IComment {
    return this._comment;
  }

  get menu(): Menu | undefined {
    return this._menu;
  }

  private _comment: IComment;
  private _menu: Menu | undefined;
}

/**
 * A widget that hosts and displays a list of `CommentWidget`s
 */
export class CommentFileWidget extends Panel {
  renderer: IRenderMimeRegistry;

  constructor(
    options: CommentFileWidget.IOptions,
    renderer: IRenderMimeRegistry
  ) {
    super();

    const { context } = options;
    this._context = context;
    this._model = context.model as CommentFileModel;

    this.id = `Comments-${context.path}`;
    this.addClass('jc-CommentFileWidget');

    this.renderer = renderer;
  }

  insertComment(comment: IComment, index: number): void {
    const factory = this.model.registry.getFactory(comment.type);
    if (factory == null) {
      return;
    }

    const widget = factory.createWidget(comment, this.model);

    if (widget != null) {
      this.insertWidget(index, widget);
      this._commentAdded.emit(widget);
    }
  }

  initialize(): void {
    while (this.widgets.length > 0) {
      this.widgets[0].dispose();
    }

    this.model.comments.forEach(comment => this.addComment(comment));
  }

  addComment(comment: IComment) {
    this.insertComment(comment, this.widgets.length);
  }

  get model(): CommentFileModel {
    return this._model;
  }

  get context(): Context {
    return this._context;
  }

  get registry(): IRenderMimeRegistry {
    return this.renderer;
  }

  get commentAdded(): ISignal<this, CommentWidget<any>> {
    return this._commentAdded;
  }

  get expandedCommentID(): string | undefined {
    return this._expandedCommentID;
  }
  set expandedCommentID(newVal: string | undefined) {
    this._expandedCommentID = newVal;
  }

  private _model: CommentFileModel;
  private _context: Context;
  private _commentAdded = new Signal<this, CommentWidget<any>>(this);
  private _expandedCommentID: string | undefined;
}

export namespace CommentFileWidget {
  export interface IOptions {
    context: Context;
  }

  export interface IBaseMockCommentOptions {
    identity: IIdentity;
    type: string;
  }

  export type IMockCommentOptions = (
    | { target: PartialJSONValue }
    | { source: any }
  ) &
    IBaseMockCommentOptions;
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
