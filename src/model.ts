import { IComment, IIdentity, IReply } from './commentformat';
import { CommentFactory } from './factory';
import { ICommentRegistry } from './registry';
import { ISharedDocument, YDocument } from '@jupyterlab/shared-models';
import * as Y from 'yjs';
import { PartialJSONValue } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { Awareness } from 'y-protocols/awareness';
import { Menu } from '@lumino/widgets';
import { Context, DocumentRegistry } from '@jupyterlab/docregistry';
import { IModelDB, ModelDB } from '@jupyterlab/observables';
import { IChangedArgs } from '@jupyterlab/coreutils';

/**
 * The default model for comment files.
 */
export class CommentFileModel implements DocumentRegistry.IModel {
  /**
   * Construct a new `CommentFileModel`.
   */
  constructor(options: CommentFileModel.IOptions) {
    const { registry, sourcePath, commentMenu, path, context } = options;

    this.registry = registry;
    this._sourcePath = sourcePath;
    this._path = path;
    this._commentMenu = commentMenu;
    this._context = context;
    this.ymodel = context.model.sharedModel as YDocument<any>;

    this.comments.observe(this._commentsObserver);
  }

  /**
   * Dispose of the model and its resources.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this.comments.unobserve(this._commentsObserver);
    // Remove all signal connections from the model.
    Signal.clearData(this);
  }

  /**
   * Serialize the model to JSON.
   */
  toJSON(): PartialJSONValue {
    return this.comments.toJSON();
  }

  /**
   * Deserialize the model from JSON.
   */
  fromJSON(value: PartialJSONValue): void {
    this.ymodel.transact(() => {
      const comments = this.comments;
      comments.delete(0, comments.length);
      comments.push(value as any as IComment[]);
    });

    this._contentChanged.emit();
  }

  /**
   * Serialize the model to a string.
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Deserialize the model from a string.
   */
  fromString(value: string): void {
    this.fromJSON(JSON.parse(value));
  }

  private _commentsObserver = (event: Y.YArrayEvent<IComment>): void => {
    // In the future, this should emit a signal describing changes made to the comments.
    // I don't understand YArrayEvent well enough yet so I'm just logging it here.
    console.log(event);
  };

  /**
   * Create a comment from an `ICommentOptions` object.
   *
   * ### Notes
   * This will fail if there's no factory for the given comment type.
   */
  createComment(options: ICommentOptions): IComment | undefined {
    const factory = this.registry.getFactory(options.type);
    if (factory == null) {
      return;
    }

    return factory.createComment(options);
  }

  /**
   * Create a reply from an `IReplyOptions` object.
   */
  createReply(options: Exclude<IReplyOptions, 'parentID'>): IReply {
    return CommentFactory.createReply(options);
  }

  /**
   * Create a comment from `options` and inserts it in `this.comments` at `index`.
   */
  insertComment(options: ICommentOptions, index: number): void {
    const comment = this.createComment(options);
    if (comment == null) {
      return;
    }

    this.comments.insert(index, [comment]);
    this._contentChanged.emit();
  }

  /**
   * Creates a comment from `options` and inserts it at the end of `this.comments`.
   */
  addComment(options: ICommentOptions): void {
    const comment = this.createComment(options);
    if (comment == null) {
      return;
    }

    this.comments.push([comment]);
    this._contentChanged.emit();
  }

  /**
   * Creates a reply from `options` and inserts it in the replies of the comment
   * with id `parentID` at `index`.
   */
  insertReply(options: IReplyOptions, parentID: string, index: number): void {
    const parentComment = this.getComment(parentID);
    if (parentComment == null) {
      return;
    }

    const reply = this.createReply(options);
    parentComment.replies.splice(index, 0, reply);
    this._contentChanged.emit();
  }

  /**
   * Creates a reply from `options` and appends it to the replies of the comment
   * with id `parentID`.
   */
  addReply(options: IReplyOptions, parentID: string): void {
    const parentComment = this.getComment(parentID);
    if (parentComment == null) {
      return;
    }

    const reply = this.createReply(options);
    parentComment.replies.push(reply);
    this._contentChanged.emit();
  }

  /**
   * Deletes the comment with id `id` from `this.comments`.
   */
  deleteComment(id: string): void {
    const comments = this.comments;
    for (let i = 0; i < comments.length; i++) {
      const comment = comments.get(i);
      if (comment.id === id) {
        comments.delete(i);
        this._contentChanged.emit();
        return;
      }
    }
  }

  /**
   * Deletes the reply with id `id` from `this.comments`.
   *
   * If a `parentID` is given, it will be used to locate the parent comment.
   * Otherwise, all comments will be searched for the reply with the given id.
   */
  deleteReply(id: string, parentID?: string): void {
    if (parentID != null) {
      const comment = this.getComment(parentID);
      if (comment == null) {
        return;
      }

      const replyIndex = comment.replies.findIndex(reply => reply.id === id);
      if (replyIndex !== -1) {
        comment.replies.splice(replyIndex, 1);
        this._contentChanged.emit();
      }
      return;
    }

    const comments = this.comments;
    for (let comment of comments) {
      const replyIndex = comment.replies.findIndex(reply => reply.id === id);
      if (replyIndex !== -1) {
        comment.replies.splice(replyIndex, 1);
        this._contentChanged.emit();
        return;
      }
    }
  }

  /**
   * Applies the changes in `options` to the comment with id `id`.
   */
  editComment(
    options: Partial<Exclude<ICommentOptions, 'id'>>,
    id: string
  ): void {
    const comment = this.getComment(id);
    if (comment == null) {
      return;
    }

    Object.assign(comment, comment, options);
    this._contentChanged.emit();
  }

  /**
   * Applies the changes in `options` to the reply with id `id`.
   *
   * If a `parentID` is given, it will be used to locate the parent comment.
   * Otherwise, all comments will be searched for the reply with the given id.
   */
  editReply(
    options: Partial<Exclude<IReplyOptions, 'id'>>,
    id: string,
    parentID?: string
  ): void {
    const reply = this.getReply(id, parentID);
    if (reply == null) {
      return;
    }

    Object.assign(reply, reply, options);
    this._contentChanged.emit();
  }

  /**
   * Get the comment with id `id`. Returns undefined if not found.
   */
  getComment(id: string): IComment | undefined {
    const comments = this.comments;
    for (let comment of comments) {
      if (comment.id === id) {
        return comment;
      }
    }

    return;
  }

  /**
   * The the reply with id `id`. Returns undefined if not found.
   *
   * If a `parentID` is given, it will be used to locate the parent comment.
   * Otherwise, all comments will be searched for the reply with the given id.
   */
  getReply(id: string, parentID?: string): IReply | undefined {
    if (parentID != null) {
      const comment = this.getComment(parentID);
      if (comment == null) {
        return;
      }

      return comment.replies.find(reply => reply.id === id);
    }

    const comments = this.comments;
    for (let comment of comments) {
      const reply = comment.replies.find(reply => reply.id === id);
      if (reply != null) {
        return reply;
      }
    }

    return;
  }

  initialize(): void {
    return;
  }

  /**
   * The comments associated with the model.
   */
  get comments(): Y.Array<IComment> {
    return this.ymodel.ydoc.getArray('comments');
  }

  /**
   * The registry containing the comment factories needed to create the model's comments.
   */
  readonly registry: ICommentRegistry;

  /**
   * The underlying model handling RTC between clients.
   */
  readonly ymodel: YDocument<any>;

  /**
   * The awareness associated with the document being commented on.
   */
  get awareness(): Awareness {
    return this.ymodel.awareness;
  }

  /**
   * The path to the document being commented on.
   */
  get sourcePath(): string {
    return this._sourcePath;
  }

  /**
   * The dropdown menu for comment widgets.
   */
  get commentMenu(): Menu | undefined {
    return this._commentMenu;
  }

  /**
   * TODO: A signal emitted when the model is changed.
   * See the notes on `CommentFileModel.IChange` below.
   */
  get changed(): ISignal<this, CommentFileModel.IChange> {
    return this._changed;
  }

  /**
   * The path to the comment file.
   */
  get path(): string {
    return this._path;
  }

  get sharedModel(): ISharedDocument {
    return this.ymodel;
  }

  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(newVal: boolean) {
    const oldVal = this.readOnly;
    if (newVal !== oldVal) {
      this._readOnly = newVal;
      this._signalStateChange(oldVal, newVal, 'readOnly');
    }
  }

  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(newVal: boolean) {
    const oldVal = this.dirty;
    if (newVal !== oldVal) {
      this._dirty = newVal;
      this._signalStateChange(oldVal, newVal, 'dirty');
    }
  }

  get stateChanged(): ISignal<this, IChangedArgs<any>> {
    return this._stateChanged;
  }

  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get context(): Context {
    return this._context;
  }

  private _signalStateChange(oldValue: any, newValue: any, name: string): void {
    this._stateChanged.emit({
      oldValue,
      newValue,
      name
    });
  }

  // These are never used--just here to satisfy the interface requirements.
  readonly modelDB: IModelDB = new ModelDB();
  readonly defaultKernelLanguage = '';
  readonly defaultKernelName = '';

  private _dirty: boolean = false;
  private _readOnly: boolean = false;
  private _isDisposed: boolean = false;
  private _sourcePath: string;
  private _path: string;
  private _commentMenu: Menu | undefined;
  private _changed = new Signal<this, CommentFileModel.IChange>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _contentChanged = new Signal<this, void>(this);
  private _context: Context;
}

export namespace CommentFileModel {
  export interface IOptions {
    registry: ICommentRegistry;
    path: string;
    sourcePath: string;
    context: Context;
    commentMenu?: Menu;
  }

  /**
   * TODO: An interface that describes a change to a model.
   * This will be filled out once `YArrayEvent` is better understood.
   */
  export interface IChange {
    commentChange: any;
  }
}

/**
 * Options object for creating a comment.
 */
export interface ICommentOptions {
  text: string;
  identity: IIdentity;
  type: string;
  target: any;
  replies?: IReply[];
  id?: string; // defaults to UUID.uuid4()
}

/**
 * Options object for creating a reply.
 */
export interface IReplyOptions {
  text: string;
  identity: IIdentity;
  id?: string; // defaults to UUID.uuid4()
}
