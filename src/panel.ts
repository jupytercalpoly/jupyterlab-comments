import { Panel, Widget } from '@lumino/widgets';
import { UUID } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { listIcon } from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CommentWidget } from './widget';
import { addComment, getComments } from './comments';
import { Cell } from '@jupyterlab/cells';
import { YBaseCell } from '@jupyterlab/shared-models';
import { getIdentity } from './utils';

export class CommentPanel extends Panel {
  constructor(options: CommentPanel.IOptions) {
    super(options);

    this._tracker = options.tracker;
    this.id = `CommentPanel-${UUID.uuid4()}`;
    this.title.icon = listIcon;
    this.addClass('jc-CommentPanel');

    const node = document.createElement('div');
    node.setAttribute('contentEditable', 'true');
    node.classList.add('jc-CommentInput');
    const inputWidget = (this._inputWidget = new Widget({ node }));
    this.addWidget(inputWidget);
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
    }

    event.preventDefault();
    event.stopPropagation();

    const cellModel = this._tracker.activeCell?.model;
    if (cellModel == null) {
      return;
    }

    const comments = getComments(cellModel.metadata);
    if (comments == null) {
      return;
    }

    const awareness = (cellModel.sharedModel as YBaseCell<any>).awareness;
    if (awareness == null) {
      console.warn('no Awareness found while adding cell comment');
      return;
    }

    addComment(cellModel.metadata, {
      id: UUID.uuid4(),
      type: 'cell',
      identity: getIdentity(awareness),
      replies: [],
      text: this._inputWidget.node.textContent!,
      time: new Date(new Date().getTime()).toLocaleString()
    });

    this._inputWidget.node.textContent = '';
    this.update();
  }

  onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);

    const tracker = this._tracker;

    while (this.widgets.length > 1) {
      this.widgets[1].dispose();
    }

    const cell = tracker.activeCell;
    if (cell == null) {
      console.log('no active cell; aborting panel render');
      return;
    }

    const cellModel = cell.model;
    const comments = getComments(cellModel.metadata);
    if (comments == null) {
      console.log('no comments; aborting panel render');
      return;
    }

    const awareness = (cellModel.sharedModel as YBaseCell<any>).awareness;
    if (awareness == null) {
      console.warn('no Awareness found; aborting panel render');
      return;
    }

    // T is currently always 'Cell' for CommentWidget<T>
    // Will have to be made generic in the future
    // (switch statement on comment.type?)
    for (let comment of comments) {
      const widget = new CommentWidget<Cell>({
        awareness,
        id: comment.id,
        target: cell,
        metadata: cellModel.metadata
      });
      this.addWidget(widget);
    }
  }

  private _tracker: INotebookTracker;
  private _inputWidget: Widget;
}

export namespace CommentPanel {
  export interface IOptions extends Panel.IOptions {
    tracker: INotebookTracker;
  }
}
