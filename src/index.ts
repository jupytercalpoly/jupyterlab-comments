import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog } from '@jupyterlab/apputils';
import * as Widgets from '@lumino/widgets';
import * as Icons from '@jupyterlab/ui-components';
import { INotebookTracker } from '@jupyterlab/notebook';
import { addComment, getComments } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { CommentWidget } from './widget';
import { Cell } from '@jupyterlab/cells';

namespace CommandIDs {
  export const addComment = 'jl-chat:add-comment';
  export const renderComment = 'jl-chat:render-comment';
}

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, nbTracker: INotebookTracker) => {
    let panel = new Widgets.Panel();
    panel.id = 'Comments';
    panel.title.icon = Icons.listIcon;
    app.shell.add(panel, 'right', { rank: 500 });
    panel.addClass('test');

    nbTracker.activeCellChanged.connect((_, cells) => {
      panelRender(panel, nbTracker);
    });

    app.commands.addCommand(CommandIDs.addComment, {
      label: 'Add Comment',
      execute: async () => {
        const cell = nbTracker.currentWidget?.content.activeCell;
        if (cell == null) {
          return;
        }

        void InputDialog.getText({
          title: 'Enter Comment'
        }).then(value => {
          if (value.value != null) {
            const comment: IComment = {
              id: UUID.uuid4(),
              type: 'cell',
              author: 'Bob',
              replies: [],
              text: value.value
            };

            addComment(cell.model.metadata, comment);

            console.log('set metadata of cell', cell.model.id);
            panelRender(panel, nbTracker);
          }
        });
      }
    });

    app.commands.addCommand(CommandIDs.renderComment, {
      label: 'Render Comment',
      execute: () => {
        const cell = nbTracker.currentWidget?.content.activeCell;
        if (cell == null) {
          return;
        }

        console.log(getComments(cell.model.metadata));
      }
    });

    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });

    app.contextMenu.addItem({
      command: CommandIDs.renderComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 14
    });
  }
};

export default plugin;

function panelRender(panels: Widgets.Panel, tracker: INotebookTracker) {
  panels.node.textContent = '';

  const cell = tracker.currentWidget?.content.activeCell;
  if (cell == null) {
    return;
  }

  const comments = getComments(cell.model.metadata);
  if (comments == null) {
    return;
  }

  console.log('comments', comments);

  for (let comment of comments) {
    const widget = new CommentWidget<Cell>({
      identity: comment.author,
      id: comment.id,
      target: cell,
      metadata: cell.model.metadata
    });
    panels.addWidget(widget);
  }
}
