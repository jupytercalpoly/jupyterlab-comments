import { Menu, Panel, Widget } from '@lumino/widgets';
import { each } from '@lumino/algorithm';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { listIcon } from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CommentWidget } from './widget';
import { addComment, getComments } from './comments';
import { ICellModel } from '@jupyterlab/cells';
import { YDocument } from '@jupyterlab/shared-models';
import { getCommentTimeString, getIdentity } from './utils';
import { Signal } from '@lumino/signaling';
import { CommandRegistry } from '@lumino/commands';
import { Awareness } from 'y-protocols/awareness';
import { ISelection } from './commentformat';

export class CommentPanel extends Panel {
  constructor(options: CommentPanel.IOptions) {
    super(options);

    this._tracker = options.tracker;
    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = listIcon;
    this.addClass('jc-CommentPanel');

    // Create the input element for adding new commentgs
    const node = document.createElement('div');
    node.setAttribute('contentEditable', 'true');
    node.classList.add('jc-CommentInput');
    const inputWidget = (this._inputWidget = new Widget({ node }));
    this.addWidget(inputWidget);

    this._commentMenu = new Menu({ commands: options.commands });
  }

  onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this._inputWidget.node.addEventListener('keydown', this);
  }

  onAfterDetach(msg: Message): void {
    super.onAfterDetach(msg);
    this._inputWidget.node.removeEventListener('keydown', this);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case 'keydown':
        this._handleKeydown(event as KeyboardEvent);
        break;
      default:
        return;
    }
  }

  private _handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    } else if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const cellModel = this._tracker.activeCell?.model.sharedModel;
    if (cellModel == null) {
      return;
    }

    const comments = getComments(cellModel);
    if (comments == null) {
      return;
    }

    const awareness = this.awareness;
    if (awareness == null) {
      console.warn('no Awareness found while adding cell comment');
      return;
    }

    addComment(cellModel, {
      id: UUID.uuid4(),
      type: 'cell',
      identity: getIdentity(awareness),
      replies: [],
      text: this._inputWidget.node.innerText,
      time: getCommentTimeString()
    });

    this._inputWidget.node.textContent = '';
    this.update();
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
          menu: this._commentMenu,
          nbTracker: this._tracker
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

  private _tracker: INotebookTracker;
  private _inputWidget: Widget;
  private _commentAdded = new Signal<this, CommentWidget<any>>(this);
  private _revealed = new Signal<this, undefined>(this);
  private _commentMenu: Menu;
}

export namespace CommentPanel {
  export interface IOptions extends Panel.IOptions {
    tracker: INotebookTracker;
    commands: CommandRegistry;
  }
}
