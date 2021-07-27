import { Menu, Panel, Widget } from '@lumino/widgets';
import { each } from '@lumino/algorithm';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { listIcon } from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CommentFileWidget, CommentWidget } from './widget';
import { getComments } from './comments';
import { Cell } from '@jupyterlab/cells';
import { YDocument } from '@jupyterlab/shared-models';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandRegistry } from '@lumino/commands';
import { Awareness } from 'y-protocols/awareness';
import { ISelection } from './commentformat';
import { ICommentRegistry } from './registry';
import { ACommentFactory } from './factory';
import { ILabShell } from '@jupyterlab/application';
import { PanelHeader } from './panelHeaderWidget';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Context } from '@jupyterlab/docregistry';
import { hashString } from './utils';
import { CommentFileModel } from './model';
import * as Y from 'yjs';

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

    const panelHeader: PanelHeader = new PanelHeader({ shell: options.shell });

    this.addWidget(panelHeader as Widget);

    this._panelHeader = panelHeader;
    // Dropdown for identity
    this._commentMenu = new Menu({ commands: options.commands });
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
    this._panelHeader.awareness = awareness;

    while (this.widgets.length > 1) {
      this.widgets[1].dispose();
    }

    each(tracker.currentWidget!.content.widgets, cell => {
      const sharedModel = cell.model.sharedModel;
      const comments = getComments(sharedModel);
      if (comments == null) {
        return;
      }

      let t1: string = '';
      let t2: string = '';
      let f1: ACommentFactory | undefined;
      let f2: ACommentFactory | undefined;
      let factory: ACommentFactory | undefined;

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

        const widget = new CommentWidget<Cell>({
          awareness,
          id: comment.id,
          target: cell,
          sharedModel,
          menu: this._commentMenu,
          nbTracker: this._tracker,
          factory
        });

        this.addComment(widget);

        if (comment.type === 'cell-selection') {
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
      cell.model.selections.set(cell.model.id, selections);
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

  get panelHeader(): PanelHeader {
    return this._panelHeader;
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
  private _panelHeader: PanelHeader;
}

export namespace CommentPanel {
  export interface IOptions extends Panel.IOptions {
    tracker: INotebookTracker;
    commands: CommandRegistry;
    registry: ICommentRegistry;
    shell: ILabShell;
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
    if (this._fileWidget == null) {
      console.log('this._fileWidget is null');
      return;
    }

    const awareness = this.awareness;
    if (awareness != null) {
      console.log('new awareness', awareness);
      this.panelHeader.awareness = awareness;
    }
    this._fileWidget.update();
  }

  async pathExists(path: string): Promise<boolean> {
    const contents = this._docManager.services.contents;

    try {
      void (await contents.get(path));
      return true;
    } catch (e) {
      return false;
    }
  }

  async getContext(path: string): Promise<Context> {
    const factory = this._docManager.registry.getModelFactory('comment-file');
    const preference = this._docManager.registry.getKernelPreference(
      path,
      'comment-factory',
      undefined
    );

    let context: Context;
    let isNew: boolean = false;
    // @ts-ignore
    context = this._docManager._findContext(path, 'comment-file') || null;
    if (context == null) {
      isNew = !(await this.pathExists(path));
      // @ts-ignore
      context = this._docManager._createContext(path, factory, preference);
    }

    void this._docManager.services.ready.then(
      () => void context!.initialize(isNew)
    );

    return context;
  }

  async loadModel(sourcePath: string): Promise<void> {
    if (this._fileWidget != null) {
      this._fileWidget.dispose();
    }

    const path = hashString(sourcePath).toString() + '.comment';
    const context = await this.getContext(path);
    const content = new CommentFileWidget({ context });

    this._fileWidget = content;
    this.currentModel!.comments.observeDeep(this._onChange.bind(this));

    this.addWidget(content);
    this._modelChanged.emit(content);
    this.update();
  }

  private _onChange(changes: Y.YEvent[]): void {
    this.update();
  }

  get ymodel(): YDocument<any> | undefined {
    if (this._fileWidget == null) {
      return;
    }
    return this._fileWidget.context.model.sharedModel as YDocument<any>;
  }

  get currentModel(): CommentFileModel | undefined {
    const docWidget = this._fileWidget;
    if (docWidget == null) {
      return;
    }
    return docWidget.model;
  }

  get fileWidget(): CommentFileWidget | undefined {
    return this._fileWidget;
  }

  get modelChanged(): ISignal<this, CommentFileWidget | undefined> {
    return this._modelChanged;
  }

  get awareness(): Awareness | undefined {
    const currentModel = this.currentModel;
    if (currentModel == null) {
      return;
    }

    return (currentModel.sharedModel as YDocument<any>).awareness;
  }

  private _fileWidget: CommentFileWidget | undefined = undefined;
  private _docManager: IDocumentManager;
  private _modelChanged = new Signal<this, CommentFileWidget | undefined>(this);
}
