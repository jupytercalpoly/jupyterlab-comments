import { Menu, Panel, Widget } from '@lumino/widgets';
import { each } from '@lumino/algorithm';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { listIcon } from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CommentWidget } from './widget';
import { getComments } from './comments';
import { ICellModel } from '@jupyterlab/cells';
import { YDocument } from '@jupyterlab/shared-models';
import { Signal } from '@lumino/signaling';
import { CommandRegistry } from '@lumino/commands';
import { Awareness } from 'y-protocols/awareness';
import { ISelection } from './commentformat';
import { PanelHeader } from './panelHeaderWidget';
import { ILabShell } from '@jupyterlab/application';


export class CommentPanel extends Panel {
  constructor(options: CommentPanel.IOptions) {
    super(options);

    this._tracker = options.tracker;
    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = listIcon;
    this.addClass('jc-CommentPanel');

    const panelHeader: PanelHeader = new PanelHeader({ shell: options.labShell});

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
    this._panelHeader.renderNeeded.emit(awareness)

    while (this.widgets.length > 1) {
      this.widgets[1].dispose();
    }

    each(model.cells, cell => {
      const sharedModel = cell.sharedModel;
      const comments = getComments(sharedModel);
      if (comments == null) {
        return;
      }

      // T is currently always 'ICellModel' for CommentWidget<T>
      // Will have to be made generic in the future
      // (switch statement on comment.type?)
      //
      // TODO: Make this not re-create the comment widget every time.
      // (Update it instead?)
      let selections = [];
      for (let comment of comments) {
        const widget = new CommentWidget<ICellModel>({
          awareness,
          id: comment.id,
          target: cell,
          sharedModel,
          menu: this._commentMenu
        });

        this.addComment(widget);
        if (comment.type == 'text') {
          selections.push({
            start: (comment as ISelection).start,
            end: (comment as ISelection).end,
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

  get panelHeader(): PanelHeader {
    return this._panelHeader;
  }

  get awareness(): Awareness | undefined {
    const sharedModel = this._tracker.currentWidget?.context.model.sharedModel;
    if (sharedModel == null) {
      return undefined;
    }
    this._panelHeader.renderNeeded.emit((sharedModel as any as YDocument<any>).awareness);
    return (sharedModel as any as YDocument<any>).awareness;
  }

  private _tracker: INotebookTracker;
  private _commentAdded = new Signal<this, CommentWidget<any>>(this);
  private _revealed = new Signal<this, undefined>(this);
  private _commentMenu: Menu;
  private _panelHeader: PanelHeader;
}

export namespace CommentPanel {
  export interface IOptions extends Panel.IOptions {
    tracker: INotebookTracker;
    commands: CommandRegistry;
    labShell: ILabShell
  }
}
