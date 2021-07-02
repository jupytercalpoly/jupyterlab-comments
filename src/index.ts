import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { InputDialog, WidgetTracker } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { addComment, deleteComment, deleteReply } from './comments';
import { UUID } from '@lumino/coreutils';
import { IComment } from './commentformat';
import { YNotebook } from '@jupyterlab/shared-models';
import { Awareness } from 'y-protocols/awareness';
import { getCommentTimeString, getIdentity } from './utils';
import { CommentPanel } from './panel';
import { CommentWidget } from './widget';

namespace CommandIDs {
  export const addComment = 'jl-chat:add-comment';
  export const deleteComment = 'jl-chat:delete-comment';
}

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, nbTracker: INotebookTracker) => {
    const commentTracker = new WidgetTracker<CommentWidget<any>>({
      namespace: 'comment-widgets'
    });

    const panel = new CommentPanel({
      tracker: nbTracker,
      commands: app.commands
    });
    app.shell.add(panel, 'right', { rank: 500 });

    panel.commentAdded.connect((_, comment) => {
      void commentTracker.add(comment);
    });

    nbTracker.activeCellChanged.connect((_, cells) => {
      panel.update();
    });

    addCommands(app, nbTracker, commentTracker, panel);

    panel.commentMenu.addItem({ command: CommandIDs.deleteComment });

    app.contextMenu.addItem({
      command: CommandIDs.addComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 13
    });

    app.contextMenu.addItem({
      command: CommandIDs.deleteComment,
      selector: '.jp-Notebook .jp-Cell',
      rank: 0
    });
  }
};

function addCommands(
  app: JupyterFrontEnd,
  nbTracker: INotebookTracker,
  commentTracker: WidgetTracker<CommentWidget<any>>,
  panel: CommentPanel
): void {
  const getAwareness = (): Awareness | undefined => {
    return (nbTracker.currentWidget?.model?.sharedModel as YNotebook).awareness;
  };

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
            identity: getIdentity(getAwareness()!),
            replies: [],
            text: value.value,
            time: getCommentTimeString()
          };

          addComment(cell.model.metadata, comment);

          panel.update();
        }
      });
    }
  });

  app.commands.addCommand(CommandIDs.deleteComment, {
    label: 'Delete Comment',
    execute: () => {
      const currentComment = commentTracker.currentWidget;
      if (currentComment != null) {
        const id = currentComment.activeID;
        const metadata = currentComment.metadata;
        if (id === currentComment.commentID) {
          deleteComment(metadata, id);
        } else {
          deleteReply(metadata, id, currentComment.commentID);
        }
        panel.update();
      }
    }
  });
}

export default plugin;
