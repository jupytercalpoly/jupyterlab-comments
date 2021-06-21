import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

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
    app.commands.addCommand(CommandIDs.addComment, {
      label: 'Add Comment',
      execute: async () => {
        const cell = nbTracker.currentWidget?.content.activeCell;
        if (cell == null) {
          return;
        }

        InputDialog.getText({
          title: 'Enter Comment'
        }).then(value => {
          if (value.value != null) {
            cell.model.metadata.set('comment', value.value);
            console.log('set metadata of cell', cell.model.id);
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

        const comment = cell.model.metadata.get('comment');
        if (comment != null) {
          alert(comment);
        }
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
