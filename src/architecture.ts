/**
 * ### About this file
 * **This is a high-level overview of how the generalized comment system will work in
 * JupyterLab. It's a living document and subject to change. Also, any code or interfaces
 * here shouldn't actually be used--it's just for mapping out ideas.**
 *
 * ### High-level overview
 * Comments are stored in .comment files in a dedicated folder server-side.
 * Each .comment file is named based on the hash of the target file's path.
 * The comment files contain an array of `IComment` objects that describe comments.
 *
 * When the comment panel is opened or the current document changes, the corresponding
 * .comment file is loaded into an `ICommentModel` and the array of `IComment` objects
 * is used to populate the panel.
 *
 * Each comment has a type and a target. The type is used to retrieve an `ICommentFactory`
 * from the `ICommentRegistry`. The factory is used to locate the target and render
 * an `ICommentWidget` based on the `IComment`. Changes to the comments (insertions,
 * deletions, edits, etc) are made in the shared ydoc of the `ICommentModel`. Changes also
 * cause a changed signal to be emitted by the model, which is listened to by each client's
 * `ICommentPanel` and used to update the comments in real-time.
 *
 * ### Adding comment support to other file types
 * Adding support for comments to files is accomplished with an `ICommentPanel` token.
 * The token gives access to the `ICommentRegistry`, as well as the current
 * `ICommentModel`. Factories for file-specific comment types are registered in the
 * comment registry, then the `addComment`, `deleteComment` etc methods of the current
 * comment model can be used.
 *
 * ### Some sticking points
 * Finding the original target of a comment can be difficult after it's loaded from a file.
 * The comment factory for each type of comment will have to describe some target->JSON and
 * JSON->target function. There should also be some easy way to scroll to/highlight the target.
 * A possible solution is to define two functions: one which returns the HTMLElement closest
 * assosciated with a target (for scrolling) and an optional one which defines a fragment/slice
 * of the HTMLElement target (for selecting). Both functions can take the JSON representation
 * of the target as an argument.
 */

import { IComment, IIdentity, IReply } from './commentformat';
import { ISignal } from '@lumino/signaling';
import { Menu } from '@lumino/widgets';
import * as models from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { CommentWidget } from './widget';
import { PartialJSONValue } from '@lumino/coreutils';
import { ICommentRegistry } from './registry';

/**
 * An object for interacting with a comment file. Manages the file's path, id, factories, etc.
 * Ideally, this represents a simple top-level API for commenting.
 */
export interface ICommentFileModel {
  // Create an `IComment` given `options` and the model's configuration.
  createComment: (options: ICommentOptions) => IComment;

  // Create an `IReply` given options and the model's configuration.
  createReply: (options: IReplyOptions) => IReply;

  // Same as `createComment` but also add the comment to the comment file.
  addComment: (options: ICommentOptions) => void;

  // Same as `createReply` but also add the reply to a comment in the comment file.
  addReply: (options: IReplyOptions) => void;

  // Delete the comment with id `id`
  deleteComment: (id: string) => void;

  // Delete the reply with id `id` (parentID is id of parent comment; optional)
  deleteReply: (id: string, parentID?: string) => void;

  // Apply the changes in `options` to the comment with id `id`
  editComment: (
    options: Partial<Exclude<ICommentOptions, 'id'>>,
    id: string
  ) => void;

  // Apply the changes in `options` to the reply with id `id` (parentID is id of parent comment; optional)
  editReply: (
    options: Partial<Exclude<IReplyOptions, 'id'>>,
    id: string,
    parentID?: string
  ) => void;

  // Path to the comment file.
  path: string;

  // Path to the file being commented on.
  sourcePath: string;

  // The id of the comment file.
  id: string;

  // The underlying object handling RTC.
  ydoc: models.YDocument<any>;

  // The in-memory representation of the comments being managed by the model.
  // Basically just `this.ydoc.getArray('comments')`
  comments: IComment[];

  // The dropdown menu for comment widgets. There will be a default menu.
  commentMenu: Menu;

  // The awareness associated with the file being commented on.
  awareness: Awareness;

  // Whether the model is currently rendered in the comment panel.
  inPanel: boolean;

  // The comment registry
  registry: ICommentRegistry;
}

/**
 * An object for displaying `CommentWidget`s.
 */
export interface ICommentPanel {
  // The file model containing the comments currently being rendered to the panel.
  model: ICommentFileModel;

  // A signal emitted when the current model changes.
  modelChanged: ISignal<this, IChangedArgs<ICommentFileModel>>;

  // A signal emitted when the panel is revealed.
  revealed: ISignal<this, undefined>;

  // A signal emitted when a comment widget is added.
  commentAdded: ISignal<this, CommentWidget>;

  // Scrolls to the comment with id `id`
  scrollToComment: (id: string) => void;

  // Adds a comment widget and emits the `commentAdded` signal.
  addCommentWidget: (widget: CommentWidget) => void;

  // An HTMLElement that when clicked opens a comment dialogue.
  indicator: HTMLElement;

  // The comment factory registry
  registry: ICommentRegistry;

  // If true, don't change the current model when the current document changes.
  lockModel: boolean;
}

/**
 * An object for creating a comment of a certain type.
 * T is the type of the target (the thing being commented on)
 */
export interface ICommentFactory<T> {
  // Create a comment based on `options` and the factory configuration.
  createComment: (options: Exclude<ICommentOptions, 'type'>) => IComment;

  // Serializes a target to be stored in the comment (cell ID, selection start/end, etc)
  targetToJSON: (target: T) => PartialJSONValue;

  // Finds a target given its serialized representation.
  JSONToTarget: (target: PartialJSONValue) => T | undefined;

  // Gets the text preview of a target given its serialized representation.
  // Providing a target of type T and some sort of "fragment object" could
  // be a better solution here (for example, providing source text and an
  // object describing a slice)
  getPreview: (target: PartialJSONValue) => string;

  // The type of comment created by the factory
  type: string;
}

// Options object for creating a comment.
export interface ICommentOptions {
  text: string;
  identity: IIdentity;
  type: string;
  target: any;
  replies?: IReply[];
  id?: string; // defaults to UUID.uuid4()
}

// Options object for creating a reply.
export interface IReplyOptions {
  parentID: string;
  text: string;
  identity: IIdentity;
  id?: string; // defaults to UUID.uuid4()
}

/**
 * A type used to represent a changed value.
 */
export interface IChangedArgs<T> {
  name: string;
  old: T | undefined;
  new: T | undefined;
}
