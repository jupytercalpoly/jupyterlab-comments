import { Menu, Panel } from '@lumino/widgets';
import { each } from '@lumino/algorithm';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { listIcon } from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CommentFileWidget, CommentWidget } from './widget';
import { getComments } from './comments';
import { ICellModel } from '@jupyterlab/cells';
import { YDocument } from '@jupyterlab/shared-models';
import { Signal } from '@lumino/signaling';
import { CommandRegistry } from '@lumino/commands';
import { Awareness } from 'y-protocols/awareness';
import { ISelection } from './commentformat';
import { ICommentRegistry } from './registry';
import { CommentFactory } from './factory';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Context } from '@jupyterlab/docregistry';
import { hashString } from './utils';
import { CommentFileModel } from './model';

export interface ICommentPanel extends Panel {
  /**
   * Add a comment widget and emit the `commentAdded` signal.
   */
  addComment: (widget: CommentWidget<any>) => void;

  /**
   * Scroll the comment with the given id into view.
   */
  scrollToComment: (id: string) => void;

  /**
   * A signal emitted when a comment is added to the panel.
   */
  commentAdded: Signal<this, CommentWidget<any>>;

  /**
   * The dropdown menu for comment widgets.
   */
  commentMenu: Menu;

  /**
   * A signal emitted when the panel is about to be shown.
   */
  revealed: Signal<this, undefined>;

  awareness: Awareness | undefined;

  nbTracker: INotebookTracker;
}

export class CommentPanel extends Panel implements ICommentPanel {
  constructor(options: CommentPanel.IOptions) {
    super(options);

    this._tracker = options.tracker;
    this._registry = options.registry;
    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = listIcon;
    this.addClass('jc-CommentPanel');

    this._commentMenu = new Menu({ commands: options.commands });
  }

  onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
  }

  onAfterDetach(msg: Message): void {
    super.onAfterDetach(msg);
  }

  /**
   * Re-render the comment widgets when an `update` message is recieved.
   */
  onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);

    const tracker = this._tracker;
    const model = tracker.currentWidget?.model;

    if (model == null) {
      console.warn(
        'Either no current widget or no widget model; aborting panel render'
      );
      return;
    }

    const awareness = this.awareness;
    if (awareness == null) {
      console.warn('No awareness; aborting panel render');
      return;
    }

    while (this.widgets.length > 0) {
      this.widgets[0].dispose();
    }

    each(model.cells, cell => {
      const sharedModel = cell.sharedModel;
      const comments = getComments(sharedModel);
      if (comments == null) {
        return;
      }

      let t1: string = '';
      let t2: string = '';
      let f1: CommentFactory<any> | undefined;
      let f2: CommentFactory<any> | undefined;
      let factory: CommentFactory<any> | undefined;

      let selections = [];

      // TODO: Make this not re-create the comment widget every time.
      // (Update it instead?)
      for (let comment of comments) {
        // Simple factory/type "cache" to speed up panel updates
        if (comment.type === '') {
          console.warn('empty comment type is not allowed');
          continue;
        } else if (t1 === comment.type) {
          factory = f1;
        } else if (t2 === comment.type) {
          factory = f2;
          [f2, f1] = [f1, f2];
          [t2, t1] = [t1, t2];
        } else {
          factory = this._registry.getFactory(comment.type);
          [f2, t2] = [f1, t1];
          [f1, t1] = [factory, comment.type];
        }

        if (factory == null) {
          console.warn('no factory found for comment with type', comment.type);
          continue;
        }

        const widget = new CommentWidget<ICellModel>({
          awareness,
          id: comment.id,
          target: cell,
          sharedModel,
          menu: this._commentMenu,
          nbTracker: this._tracker,
          factory
        });

        this.addComment(widget);

        if (comment.type == 'cell-selection') {
          const { start, end } = comment.target as any as ISelection;
          selections.push({
            start,
            end,
            style: {
              className: 'jc-Highlight',
              color: 'black',
              displayName: comment.identity.name
            },
            uuid: comment.id
          });
        }
      }
      cell.selections.set(cell.id, selections);
    });
  }

  /**
   * Add a comment widget and emit the `commentAdded` signal.
   */
  addComment(widget: CommentWidget<any>): void {
    this.addWidget(widget);
    this._commentAdded.emit(widget);
  }

  /**
   * Scroll the comment with the given id into view.
   */
  scrollToComment(id: string): void {
    const node = document.getElementById(id);
    if (node == null) {
      return;
    }

    node.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Show the widget, make it visible to its parent widget, and emit the
   * `revealed` signal.
   *
   * ### Notes
   * This causes the [[isHidden]] property to be false.
   * If the widget is not explicitly hidden, this is a no-op.
   */
  show(): void {
    if (this.isHidden) {
      this._revealed.emit(undefined);
      super.show();
    }
  }

  /**
   * A signal emitted when a comment is added to the panel.
   */
  get commentAdded(): Signal<this, CommentWidget<any>> {
    return this._commentAdded;
  }

  /**
   * The dropdown menu for comment widgets.
   */
  get commentMenu(): Menu {
    return this._commentMenu;
  }

  /**
   * A signal emitted when the panel is about to be shown.
   */
  get revealed(): Signal<this, undefined> {
    return this._revealed;
  }

  get awareness(): Awareness | undefined {
    const sharedModel = this._tracker.currentWidget?.context.model.sharedModel;
    if (sharedModel == null) {
      return undefined;
    }
    return (sharedModel as any as YDocument<any>).awareness;
  }

  get nbTracker(): INotebookTracker {
    return this._tracker;
  }

  get registry(): ICommentRegistry {
    return this._registry;
  }

  private _tracker: INotebookTracker;
  private _commentAdded = new Signal<this, CommentWidget<any>>(this);
  private _revealed = new Signal<this, undefined>(this);
  private _commentMenu: Menu;
  private _registry: ICommentRegistry;
}

export namespace CommentPanel {
  export interface IOptions extends Panel.IOptions {
    tracker: INotebookTracker;
    commands: CommandRegistry;
    registry: ICommentRegistry;
  }
}

export namespace CommentPanel2 {
  export interface IOptions extends CommentPanel.IOptions {
    docManager: IDocumentManager;
  }
}

export class CommentPanel2 extends CommentPanel {
  constructor(options: CommentPanel2.IOptions) {
    super(options);

    const { docManager } = options;

    this._docManager = docManager;
  }

  onUpdateRequest(msg: Message): void {
    if (this._docWidget == null) {
      console.log('this._docWidget is null');
      return;
    }

    this._docWidget.update();
  }

  loadModel(sourcePath: string): void {
    if (this._docWidget != null) {
      this._docWidget.dispose();
    }

    const path = hashString(sourcePath).toString() + '.comment';
    const factory = this._docManager.registry.getModelFactory('text');
    const preference = this._docManager.registry.getKernelPreference(
      path,
      'comment-factory',
      undefined
    );

    let context: Context;
    let isNew: boolean;
    // @ts-ignore
    context = this._docManager._findContext(path, 'comment-factory') || null;
    if (context == null) {
      // @ts-ignore
      context = this._docManager._createContext(path, factory, preference);
      isNew = true;
      console.log('created new context', context);
    } else {
      isNew = false;
      console.log('found existing context', context);
    }

    const content = new CommentFileWidget({
      path,
      sourcePath,
      context,
      registry: this.registry,
      commentMenu: this.commentMenu
    });

    void this._docManager.services.ready.then(
      () => void context!.initialize(isNew)
    );

    this._docWidget = content;
    this.addWidget(content);
    this.update();
  }

  get currentModel(): CommentFileModel | undefined {
    const docWidget = this._docWidget;
    if (docWidget == null) {
      return;
    }
    return docWidget.model;
  }

  private _docWidget: CommentFileWidget | undefined = undefined;
  private _docManager: IDocumentManager;
}
