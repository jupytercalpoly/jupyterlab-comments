import { Menu, Panel, Widget } from '@lumino/widgets';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { CommentFileWidget, CommentWidget, MockCommentWidget } from './widget';
import { YDocument } from '@jupyterlab/shared-models';
import { ISignal, Signal } from '@lumino/signaling';
import { CommandRegistry } from '@lumino/commands';
import { Awareness } from 'y-protocols/awareness';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ICommentRegistry } from './registry';
import { ILabShell } from '@jupyterlab/application';
import { PanelHeader } from './panelHeaderWidget';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Context } from '@jupyterlab/docregistry';
import { hashString, randomIdentity } from './utils';
import { CommentFileModel } from './model';
import { CommentsPanelIcon } from './icons';
import { NewCommentButton } from './button';
import { IIdentity } from './commentformat';

export interface ICommentPanel extends Panel {
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

  /**
   * The current awareness associated with the panel.
   */
  awareness: Awareness | undefined;

  /**
   * The current `CommentFileModel` associated with the panel.
   */
  model: CommentFileModel | undefined;

  button: NewCommentButton;

  fileWidget: CommentFileWidget | undefined;

  localIdentity: IIdentity;

  mockComment: (
    options: CommentFileWidget.IMockCommentOptions,
    index: number
  ) => MockCommentWidget<any> | undefined;
}

export class CommentPanel extends Panel implements ICommentPanel {
  renderer: IRenderMimeRegistry;

  constructor(options: CommentPanel.IOptions, renderer: IRenderMimeRegistry) {
    super();

    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = CommentsPanelIcon;
    this.addClass('jc-CommentPanel');

    const { docManager, registry, shell } = options;

    this._registry = registry;
    this._commentMenu = new Menu({ commands: options.commands });
    this._docManager = docManager;

    const panelHeader: PanelHeader = new PanelHeader({
      shell,
      panel: this
    });

    this.addWidget(panelHeader as Widget);

    this._panelHeader = panelHeader;
    this.renderer = renderer;

    this._boundOnChange = this._onChange.bind(this);

    this._localIdentity = randomIdentity();
  }

  onUpdateRequest(msg: Message): void {
    if (this._fileWidget == null) {
      return;
    }

    const awareness = this.awareness;
    if (awareness != null && awareness !== this.panelHeader.awareness) {
      this.panelHeader.awareness = awareness;
    }

    // this._fileWidget.update();
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
    // Lock to prevent multiple loads at the same time.
    if (this._loadingModel) {
      return;
    }

    if (sourcePath === '') {
      return;
    }

    this._loadingModel = true;

    if (this._fileWidget != null) {
      this.model!.changed.disconnect(this._boundOnChange);
      const oldWidget = this._fileWidget;
      void oldWidget.context.save().then(() => oldWidget.dispose());
    }

    const path =
      this.pathPrefix + hashString(sourcePath).toString() + '.comment';

    const context = await this.getContext(path);

    void context.ready.then(() => {
      const content = new CommentFileWidget({ context }, this.renderer);
      this._fileWidget = content;
      this.addWidget(content);

      content.commentAdded.connect((_, widget) =>
        this._commentAdded.emit(widget)
      );

      this.model!.changed.connect(this._boundOnChange);

      const { name, color, icon } = this._localIdentity;
      this.model!.awareness.setLocalStateField('user', {
        name,
        color,
        icon
      });

      this.update();
      content.initialize();
      this._modelChanged.emit(content);
    });

    this._loadingModel = false;
  }

  private _onChange(
    _: CommentFileModel,
    changes: CommentFileModel.IChange[]
  ): void {
    const fileWidget = this.fileWidget;
    if (fileWidget == null) {
      return;
    }

    const widgets = fileWidget.widgets;
    let index = 0;

    for (let change of changes) {
      console.log('changin!: ', change);
      if (change.retain != null) {
        index += change.retain;
      } else if (change.insert != null) {
        console.log('innnnsert: ', change.insert);
        change.insert.forEach(comment =>
          fileWidget.insertComment(comment, index++)
        );
      } else if (change.delete != null) {
        widgets
          .slice(index, index + change.delete)
          .forEach(widget => widget.dispose());
      } else if (change.update != null) {
        for (let i = 0; i < change.update; i++) {
          widgets[index++].update();
        }
      }
    }
  }

  get ymodel(): YDocument<any> | undefined {
    if (this._fileWidget == null) {
      return;
    }
    return this._fileWidget.context.model.sharedModel as YDocument<any>;
  }

  get model(): CommentFileModel | undefined {
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
    return this.model?.awareness;
  }

  get registry(): ICommentRegistry {
    return this._registry;
  }

  get pathPrefix(): string {
    return this._pathPrefix;
  }
  set pathPrefix(newValue: string) {
    this._pathPrefix = newValue;
  }

  mockComment(
    options: CommentFileWidget.IMockCommentOptions,
    index: number
  ): MockCommentWidget<any> | undefined {
    const model = this.model;
    if (model == null) {
      return;
    }

    const factory = this.registry.getFactory(options.type);
    if (factory == null) {
      return;
    }

    let source;
    let comment;
    if ('target' in options) {
      const target = options.target;
      source = factory.targetFromJSON(target);
      comment = factory.createComment({ ...options, text: '' }, target);
    } else {
      source = options.source;
      comment = factory.createComment({ ...options, text: '' });
    }

    const widget = new MockCommentWidget({
      comment,
      factory,
      model,
      target: source
    });

    this.fileWidget!.insertWidget(index, widget);
  }

  updateIdentity(id: number, newName: string): void {
    this._localIdentity.name = newName;

    const model = this.model;
    if (model == null) {
      return;
    }

    model.comments.forEach(comment => {
      if (comment.identity.id === id) {
        model.editComment(
          {
            identity: { ...comment.identity, name: newName }
          },
          comment.id
        );
      }

      comment.replies.forEach(reply => {
        if (reply.identity.id === id) {
          model.editReply(
            {
              identity: { ...reply.identity, name: newName }
            },
            reply.id,
            comment.id
          );
        }
      });
    });

    this.update();
  }

  get button(): NewCommentButton {
    return this._button;
  }

  get localIdentity(): IIdentity {
    return this._localIdentity;
  }

  private _commentAdded = new Signal<this, CommentWidget<any>>(this);
  private _revealed = new Signal<this, undefined>(this);
  private _commentMenu: Menu;
  private _registry: ICommentRegistry;
  private _panelHeader: PanelHeader;
  private _fileWidget: CommentFileWidget | undefined = undefined;
  private _docManager: IDocumentManager;
  private _modelChanged = new Signal<this, CommentFileWidget | undefined>(this);
  private _pathPrefix: string = 'comments/';
  private _button = new NewCommentButton();
  private _loadingModel = false;
  private _boundOnChange: (
    _: CommentFileModel,
    changes: CommentFileModel.IChange[]
  ) => void;
  private _localIdentity: IIdentity;
}

export namespace CommentPanel {
  export interface IOptions {
    docManager: IDocumentManager;
    commands: CommandRegistry;
    registry: ICommentRegistry;
    shell: ILabShell;
  }
}
